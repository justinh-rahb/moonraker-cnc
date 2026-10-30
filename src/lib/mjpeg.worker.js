import { MjpegParser, multipartBoundary } from './mjpeg.js';
let controller;
let retry;
let watchdog;
let renderTimer;
let generation = 0;
let latest;
let decoding = false;
let inFlight = false;
let lastDraw = 0;
let frames = 0;
let statsAt = 0;
let interval = 0;
let failures = 0;
function clearTimers() { clearTimeout(retry); clearTimeout(watchdog); clearTimeout(renderTimer); }
function stop() {
    generation++;
    controller?.abort(); controller = null;
    clearTimers(); latest = null; inFlight = false;
}
function armWatchdog() {
    clearTimeout(watchdog);
    watchdog = setTimeout(() => controller?.abort(), 15000);
}
async function render(session) {
    if (session !== generation || decoding || inFlight || !latest) return;
    const delay = interval - (performance.now() - lastDraw);
    if (delay > 1) { clearTimeout(renderTimer); renderTimer = setTimeout(() => render(session), delay); return; }
    const bytes = latest; latest = null; decoding = true;
    try {
        const bitmap = await createImageBitmap(new Blob([bytes], {type:'image/jpeg'}));
        if (session !== generation) { bitmap.close(); return; }
        lastDraw = performance.now(); frames++;
        inFlight = true;
        self.postMessage({type:'frame',bitmap}, [bitmap]);
        if (lastDraw - statsAt >= 1000) {
            self.postMessage({type:'fps',fps:frames * 1000 / (lastDraw - statsAt)});
            frames = 0; statsAt = lastDraw;
        }
    } catch (error) {
        if (session === generation) self.postMessage({type:'error',message:'Unable to decode camera frame'});
    } finally {
        if (session === generation) {
            decoding = false;
            if (latest) render(session);
        }
    }
}
async function stream(url, session) {
    controller = new AbortController();
    armWatchdog();
    let reader;
    try {
        const response = await fetch(url, {signal:controller.signal,cache:'no-store',credentials:'same-origin'});
        if (!response.ok) throw new Error(`Camera returned HTTP ${response.status}`);
        const parser = new MjpegParser(multipartBoundary(response.headers.get('content-type')));
        if (!response.body) throw new Error('Camera response has no stream');
        reader = response.body.getReader();
        statsAt = performance.now(); frames = 0; lastDraw = 0;
        while (session === generation) {
            const {done,value} = await reader.read();
            if (done) throw new Error('Camera stream ended');
            for (const frame of parser.push(value)) {
                latest = frame;
                failures = 0;
                armWatchdog();
            }
            // Keep only the newest pending frame; slow decoders never build a backlog.
            render(session);
        }
    } catch (error) {
        if (session !== generation) return;
        self.postMessage({type:'error',message:error.name === 'AbortError' ? 'Camera stalled; reconnecting…' : error.message, nativeFallback:error instanceof TypeError});
        retry = setTimeout(() => stream(url, session), Math.min(10000, 1000 * 2 ** Math.min(failures++,4)));
    } finally {
        try { await reader?.cancel(); } catch {}
        if (session === generation) {
            controller?.abort(); clearTimeout(watchdog);
            latest = null;
        }
    }
}
self.onmessage = ({data}) => {
    if (data.type === 'drawn') { inFlight = false; render(generation); return; }
    if (data.type === 'stop') { stop(); return; }
    if (data.type !== 'start') return;
    stop(); failures = 0; decoding = false;
    const rate = Number(data.maxFps);
    interval = Number.isFinite(rate) && rate > 0 ? 1000 / Math.max(1,Math.min(60,rate)) : 0;
    stream(data.url, generation);
};
