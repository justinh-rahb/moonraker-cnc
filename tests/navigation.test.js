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
