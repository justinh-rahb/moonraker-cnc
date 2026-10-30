import test from 'node:test';
import assert from 'node:assert/strict';
import { get } from 'svelte/store';
import { filePickerOpen, filePickerPath, settingsOpen, settingsTab, historyOpen, hostsOpen } from '../src/stores/uiStore.js';
import { initializeNavigation } from '../src/stores/navigation.js';
const flush = async () => { await new Promise(resolve => queueMicrotask(resolve)); await new Promise(resolve => queueMicrotask(resolve)); };
function browser(initial='') {
    const handlers = new Map();
    const entries = [{hash:initial,state:null}];
    let index=0, pushes=0, replacements=0, backs=0;
    const location={pathname:'/panel/',search:'?ip=printer',hash:initial};
    const hashFrom = url => url.includes('#') ? url.slice(url.indexOf('#')) : '';
    const history={
        get state(){return entries[index].state;},
        pushState(state,_title,url){pushes++;entries.splice(index+1);entries.push({hash:hashFrom(url),state});index++;location.hash=entries[index].hash;},
        replaceState(state,_title,url){replacements++;entries[index]={hash:hashFrom(url),state};location.hash=entries[index].hash;},
        back(){backs++;traverse(-1);}
    };
    function traverse(direction) {
        assert.ok(index+direction>=0 && index+direction<entries.length,'must not navigate outside the app-owned test history');
        index+=direction;location.hash=entries[index].hash;
        handlers.get('popstate')?.();handlers.get('hashchange')?.();
    }
    globalThis.window={location,history,addEventListener:(name,callback)=>handlers.set(name,callback),removeEventListener:name=>handlers.delete(name)};
    return {entries,handlers,traverse,location,get index(){return index;},get pushes(){return pushes;},get replacements(){return replacements;},get backs(){return backs;}};
}

test('settings tabs and file directories replace the current entry instead of growing Back history', async () => {
    const b=browser();const cleanup=initializeNavigation();
    settingsOpen.set(true);await flush();assert.equal(b.pushes,1);
    for (const tab of ['Cameras','Interface','Panels','Sysinfo']) {settingsTab.set(tab);await flush();}
    assert.equal(b.location.hash,'#/settings/sysinfo');assert.equal(b.pushes,1);assert.equal(b.entries.length,2);
    settingsOpen.set(false);await flush();
    assert.equal(b.backs,1);assert.equal(b.index,0);assert.equal(b.location.hash,'');
    filePickerOpen.set(true);await flush();assert.equal(b.pushes,2);
    for (const path of ['one','one/two','test prints/日本語','']) {filePickerPath.set(path);await flush();}
    assert.equal(b.location.hash,'#/files');assert.equal(b.entries.length,2);assert.equal(b.pushes,2);
    b.traverse(-1);await flush();assert.equal(get(filePickerOpen),false);assert.equal(b.location.hash,'');
    b.traverse(1);await flush();assert.equal(get(filePickerOpen),true);assert.equal(b.location.hash,'#/files');
    cleanup();assert.equal(b.handlers.size,0);
});

test('Hosts, settings, files and history restore exclusively on Back/Forward and reload', async () => {
    const b=browser();let cleanup=initializeNavigation();
    hostsOpen.set(true);await flush();assert.equal(b.location.hash,'#/hosts');
    settingsTab.set('Hosts');settingsOpen.set(true);assert.equal(get(settingsTab),'General');settingsTab.set('Interface');await flush();
    assert.equal(b.location.hash,'#/settings/interface');assert.equal(get(hostsOpen),false);
    filePickerPath.set('test prints/nested');filePickerOpen.set(true);await flush();
    assert.equal(b.location.hash,'#/files/test%20prints/nested');assert.equal(get(settingsOpen),false);
    historyOpen.set(true);await flush();assert.equal(b.location.hash,'#/history');
    b.traverse(-1);await flush();assert.equal(get(filePickerOpen),true);assert.equal(get(filePickerPath),'test prints/nested');
    b.traverse(-1);await flush();assert.equal(get(settingsOpen),true);assert.equal(get(settingsTab),'Interface');
    b.traverse(-1);await flush();assert.equal(get(hostsOpen),true);
    b.traverse(1);b.traverse(1);b.traverse(1);await flush();assert.equal(get(historyOpen),true);
    const count=b.entries.length;
    cleanup();hostsOpen.set(true);historyOpen.set(false);
    cleanup=initializeNavigation();await flush();
    assert.equal(get(hostsOpen),false);assert.equal(get(historyOpen),true);assert.equal(b.entries.length,count);
    cleanup();
});

test('closing a direct-linked view stays in the app and reload preserves owned close behavior', async () => {
    const direct=browser('#/settings/cameras');let cleanup=initializeNavigation();await flush();
    settingsTab.set('Interface');await flush();settingsOpen.set(false);await flush();
    assert.equal(direct.location.hash,'');assert.equal(direct.entries.length,1);assert.equal(direct.backs,0);
    cleanup();
    const owned=browser();cleanup=initializeNavigation();hostsOpen.set(true);await flush();cleanup();
    cleanup=initializeNavigation();hostsOpen.set(false);await flush();
    assert.equal(owned.location.hash,'');assert.equal(owned.backs,1);assert.equal(owned.pushes,1);
    cleanup();
});

test('browser traversal cancels queued UI writes without adding another entry', async () => {
    const b=browser();const cleanup=initializeNavigation();
    hostsOpen.set(true);await flush();
    filePickerOpen.set(true);b.traverse(-1);await flush();
    assert.equal(b.location.hash,'');assert.equal(get(filePickerOpen),false);assert.equal(get(hostsOpen),false);assert.equal(b.pushes,1);
    cleanup();
});

test('legacy Hosts links and malformed routes normalize in place', async () => {
    for (const [hash,canonical,view] of [['#/settings/hosts','#/hosts','hosts'],['#/settings/not-a-tab','#/settings/general','settings'],['#/files/..','','dashboard']]) {
        const b=browser(hash);const cleanup=initializeNavigation();await flush();
        assert.equal(b.location.hash,canonical);assert.equal(b.entries.length,1);assert.equal(b.pushes,0);
        assert.equal(get(hostsOpen),view==='hosts');assert.equal(get(settingsOpen),view==='settings');
        cleanup();
    }
});
