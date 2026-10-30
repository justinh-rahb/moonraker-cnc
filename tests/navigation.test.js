import test from 'node:test';
import assert from 'node:assert/strict';
import { get } from 'svelte/store';
import { filePickerOpen, filePickerPath, settingsOpen, settingsTab, historyOpen } from '../src/stores/uiStore.js';
import { initializeNavigation } from '../src/stores/navigation.js';

test('History controller restores overlays without adding entries during Back/Forward', async () => {
    const handlers = new Map(), pushes = [];
    globalThis.window = {
        location:{pathname:'/',search:'?ip=printer',hash:'#/settings/cameras'},
        history:{pushState(_state,_title,url) {pushes.push(url);window.location.hash = url.includes('#') ? url.slice(url.indexOf('#')) : '';}},
        addEventListener:(name,callback) => handlers.set(name,callback),
        removeEventListener:name => handlers.delete(name)
    };
    const flush = () => new Promise(resolve => queueMicrotask(resolve));
    const cleanup = initializeNavigation();
    await flush();
    assert.equal(get(settingsOpen),true); assert.equal(get(settingsTab),'Cameras');
    assert.equal(pushes.length,0);
    settingsOpen.set(false);filePickerPath.set('test prints/nested');filePickerOpen.set(true);
    await flush();
    assert.equal(window.location.hash,'#/files/test%20prints/nested');
    assert.equal(pushes.length,1);
    window.location.hash = '#/settings/cameras';handlers.get('popstate')();await flush();
    assert.equal(get(settingsOpen),true);assert.equal(get(filePickerOpen),false);
    assert.equal(pushes.length,1);
    window.location.hash = '';handlers.get('popstate')();await flush();
    assert.equal(get(settingsOpen),false);assert.equal(get(filePickerOpen),false);assert.equal(get(historyOpen),false);
    assert.equal(pushes.length,1);
    window.location.hash = '#/files/a%20b/c';handlers.get('popstate')();await flush();
    assert.equal(get(filePickerOpen),true);assert.equal(get(filePickerPath),'a b/c');
    assert.equal(pushes.length,1);
    cleanup();assert.equal(handlers.size,0);
});

test('Hosts routes, exclusive views, Back/Forward and reload retain the correct state', async () => {
    const handlers = new Map(), entries = ['#/hosts'];
    let index = 0, pushes = 0;
    const apply = hash => window.location.hash = hash;
    globalThis.window = {
        location:{pathname:'/panel/',search:'?ip=printer',hash:entries[0]},
        history:{
            pushState(_s,_t,url) { pushes++; entries.splice(index+1);entries.push(url.includes('#')?url.slice(url.indexOf('#')):'');index++;apply(entries[index]); },
            replaceState(_s,_t,url) { entries[index] = url.includes('#')?url.slice(url.indexOf('#')):'';apply(entries[index]); }
        },
        addEventListener:(name,callback) => handlers.set(name,callback),removeEventListener:name=>handlers.delete(name)
    };
    const {hostsOpen} = await import('../src/stores/uiStore.js');
    const flush = () => new Promise(resolve=>queueMicrotask(resolve));
    const traverse = direction => {index+=direction;apply(entries[index]);handlers.get('popstate')();handlers.get('hashchange')();};
    let cleanup = initializeNavigation(); await flush();
    assert.equal(get(hostsOpen),true);assert.equal(pushes,0);
    settingsTab.set('Hosts');settingsOpen.set(true);assert.equal(get(settingsTab),'General');settingsTab.set('Interface');await flush();
    assert.equal(window.location.hash,'#/settings/interface');assert.equal(get(hostsOpen),false);
    filePickerPath.set('test prints/nested');filePickerOpen.set(true);await flush();
    assert.equal(window.location.hash,'#/files/test%20prints/nested');assert.equal(get(settingsOpen),false);
    traverse(-1);await flush();assert.equal(get(settingsOpen),true);assert.equal(get(settingsTab),'Interface');
    traverse(-1);await flush();assert.equal(get(hostsOpen),true);assert.equal(get(settingsOpen),false);
    traverse(1);traverse(1);await flush();assert.equal(get(filePickerOpen),true);assert.equal(get(filePickerPath),'test prints/nested');
    assert.equal(pushes,2);
    cleanup();hostsOpen.set(true);filePickerPath.set('wrong');
    cleanup=initializeNavigation();await flush();
    assert.equal(get(hostsOpen),false);assert.equal(get(filePickerOpen),true);assert.equal(get(filePickerPath),'test prints/nested');assert.equal(pushes,2);
    cleanup();
});

test('browser traversal cancels a queued UI navigation instead of pushing an extra entry', async () => {
    const handlers=new Map(),pushes=[];
    globalThis.window={location:{pathname:'/',search:'',hash:''},history:{pushState(_s,_t,url){pushes.push(url);},replaceState(){}},addEventListener:(name,cb)=>handlers.set(name,cb),removeEventListener:name=>handlers.delete(name)};
    const cleanup=initializeNavigation();
    filePickerOpen.set(true);
    window.location.hash='#/history';handlers.get('popstate')();
    await new Promise(resolve=>queueMicrotask(resolve));
    assert.equal(get(historyOpen),true);assert.equal(get(filePickerOpen),false);assert.equal(pushes.length,0);
    cleanup();
});

test('legacy Hosts links and invalid routes are normalized without creating history entries', async () => {
    const {hostsOpen}=await import('../src/stores/uiStore.js');
    for (const [hash,canonical,view] of [['#/settings/hosts','#/hosts','hosts'],['#/settings/not-a-tab','#/settings/general','settings'],['#/files/..','','dashboard']]) {
        const pushes=[],replacements=[];
        globalThis.window={location:{pathname:'/',search:'',hash},history:{pushState(...args){pushes.push(args);},replaceState(_s,_t,url){replacements.push(url);window.location.hash=url.includes('#')?url.slice(url.indexOf('#')):'';}},addEventListener(){},removeEventListener(){}};
        const cleanup=initializeNavigation();await new Promise(resolve=>queueMicrotask(resolve));
        assert.equal(window.location.hash,canonical);assert.equal(pushes.length,0);assert.equal(replacements.length,1);
        assert.equal(get(hostsOpen),view==='hosts');assert.equal(get(settingsOpen),view==='settings');
        cleanup();
    }
});
