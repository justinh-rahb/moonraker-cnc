import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { MjpegParser, multipartBoundary } from '../src/lib/mjpeg.js';
const encode = value => new TextEncoder().encode(value);
const part = (value, length = true) => `--camera\r\nContent-Type: image/jpeg\r\n${length ? `Content-Length: ${value.length}\r\n` : ''}\r\n${value}\r\n`;
const tick = () => new Promise(resolve => setImmediate(resolve));
test('MJPEG parses split headers, boundaries, and JPEG payloads without relying on network chunk sizes', () => {
    const data = encode(part('jpeg-one') + part('jpeg-two',false) + '--camera--\r\n');
    for (const size of [1,2,7,37,data.length]) {
        const parser = new MjpegParser('camera');
        const result = [];
        for (let i = 0; i < data.length; i += size) result.push(...parser.push(data.slice(i,i+size)));
        assert.deepEqual(result.map(bytes => new TextDecoder().decode(bytes)),['jpeg-one','jpeg-two']);
    }
    assert.equal(multipartBoundary('multipart/x-mixed-replace; boundary="camera"'),'camera');
    assert.throws(() => multipartBoundary('text/html'));
    assert.throws(() => new MjpegParser('camera').push(encode('--camera\r\nContent-Length: 999999999\r\n\r\n')));
});
async function harness() {
    const source = (await readFile(new URL('../src/lib/mjpeg.worker.js',import.meta.url),'utf8')).replace(/^import .*\n/,'');
    const messages = [], calls = [], timers = new Map();
    let incoming;
    let timerId = 0;
    const self = {postMessage: message => messages.push(message)};
    const context = {self,MjpegParser,multipartBoundary,AbortController,Blob,performance,
        createImageBitmap: async blob => ({text:await blob.text(),width:10,height:10,close() {}}),
        setTimeout:(fn,delay) => { const id = ++timerId; timers.set(id,{fn,delay}); return id; },
        clearTimeout:id => timers.delete(id),
        fetch:async (url,options) => {
            calls.push({url,signal:options.signal});
            const body = new ReadableStream({start(controller) {
                incoming = controller;
                options.signal.addEventListener('abort',() => controller.error(new DOMException('Aborted','AbortError')),{once:true});
            }});
            return {ok:true,headers:new Headers({'content-type':'multipart/x-mixed-replace; boundary=camera'}),body};
        }};
    vm.runInNewContext(source,context);
    return {messages,calls,timers,send:data => self.onmessage({data}),frame:value => incoming.enqueue(encode(part(value))), fail:() => incoming.error(new Error('Disconnected'))};
}
test('worker keeps one stream open, bounds pending frames, and aborts without retry when stopped', async () => {
    const h = await harness();
    h.send({type:'start',url:'http://printer/webcam/',maxFps:0}); await tick();
    h.frame('one'); await tick(); await tick();
    assert.equal(h.messages.filter(m => m.type === 'frame').length,1);
    h.frame('two'); h.frame('three'); await tick(); await tick();
    assert.equal(h.messages.filter(m => m.type === 'frame').length,1,'waits for display acknowledgement');
    h.send({type:'drawn'}); await tick(); await tick();
    assert.deepEqual(h.messages.filter(m => m.type === 'frame').map(m => m.bitmap.text),['one','three']);
    assert.equal(h.calls.length,1,'frames do not reopen HTTP requests');
    h.send({type:'stop'}); await tick();
    assert.equal(h.calls[0].signal.aborted,true);
    assert.equal(h.timers.size,0,'hidden/unmounted player has no retry or render timer');
});
test('switching cameras aborts the old request before opening the new one', async () => {
    const h = await harness();
    h.send({type:'start',url:'http://printer/bed',maxFps:0}); await tick();
    h.send({type:'start',url:'http://printer/nozzle',maxFps:0}); await tick();
    assert.equal(h.calls[0].signal.aborted,true);
    assert.equal(h.calls[1].signal.aborted,false);
    h.frame('new-camera'); await tick(); await tick();
    assert.equal(h.messages.filter(m => m.type === 'frame')[0].bitmap.text,'new-camera');
    h.send({type:'stop'}); await tick();
    assert.equal(h.timers.size,0);
});


test('a dropped stream retries with backoff, while stopping cancels the retry', async () => {
    const h = await harness();
    h.send({type:'start',url:'http://printer/webcam/',maxFps:0}); await tick();
    h.fail(); await tick(); await tick();
    const retry = [...h.timers.entries()].find(([,timer]) => timer.delay === 1000);
    assert.ok(retry);
    h.timers.delete(retry[0]); retry[1].fn(); await tick();
    assert.equal(h.calls.length,2);
    h.fail(); await tick(); await tick();
    assert.ok([...h.timers.values()].some(timer => timer.delay === 2000));
    h.send({type:'stop'}); await tick();
    assert.equal(h.timers.size,0);
});
