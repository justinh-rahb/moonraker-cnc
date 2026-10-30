import { writable, get } from 'svelte/store';
import { configStore, workspaceStore } from './configStore.js';
import { send, connectionState, getConnectionGeneration } from './websocket.js';
import { databaseSettings, canonical, reconcileSettings, validateRemote } from '../lib/settingsSync.js';
import { mergeConfig } from '../lib/config.js';

export const settingsSyncState = writable({ status:'offline', message:'Settings cached locally' });
const namespace = 'retro_cnc_panel';
const key = 'settings';
let timer, running = false, rerun = false, applying = false;
let conflict;
let lastHost, lastSettings, previousSettings;
const readOnly = import.meta.env?.VITE_READ_ONLY === 'true';
const currentHost = () => { const w = get(workspaceStore); return w.hosts.find(h => h.id === w.activeHostId); };
function base(settings) {
    const id = currentHost().id;
    workspaceStore.update(w => ({ ...w, hosts: w.hosts.map(h => h.id === id ? { ...h, syncBase: settings } : h) }));
}
async function readRemote() {
    // Inspect namespaces so a missing first-run setting is not reported as an error.
    const list = await send('server.database.list', {}, {silent:true});
    if (!list.namespaces?.includes(namespace)) return null;
    const result = await send('server.database.get_item', {namespace}, {silent:true});
    const value = result.value?.[key];
    return value ? validateRemote(value) : null;
}
function schedule() { clearTimeout(timer); timer = setTimeout(syncSettings,700); }
export async function syncSettings(resolution) {
    if (get(connectionState) !== 'connected') return;
    if (running) { rerun = true; return; }
    running = true;
    const generation = getConnectionGeneration(), id = currentHost().id;
    const same = () => generation === getConnectionGeneration() && id === currentHost().id && get(connectionState) === 'connected';
    try {
        settingsSyncState.set({status:'syncing', message:'Synchronizing settings'});
        const remote = await readRemote();
        if (!same()) return;
        const local = databaseSettings(get(configStore));
        let action = reconcileSettings(local, remote, currentHost().syncBase).action;
        if (resolution && conflict && canonical(remote) === canonical(conflict.remote)) action = resolution === 'local' ? 'upload' : 'download';
        conflict = null;
        if (action === 'conflict') {
            conflict = {remote};
            settingsSyncState.set({status:'conflict', message:'Settings changed here and in another browser. Choose which copy to keep.'});
            return;
        }
        if (action === 'download') {
            applying = true;
            configStore.update(c => ({ ...mergeConfig(c,remote), server:c.server }));
            applying = false;
            base(remote);
        } else if (action === 'upload') {
            if (readOnly) { settingsSyncState.set({status:'local', message:'Read-only validation: settings saved locally'}); return; }
            await send('server.database.post_item', {namespace,key,value:{version:1,settings:local}}, {silent:true});
            if (!same()) return;
            base(local);
            if (canonical(databaseSettings(get(configStore))) !== canonical(local)) rerun = true;
        } else base(local);
        settingsSyncState.set({status:'synced', message:'Settings saved to Moonraker'});
    } catch(error) {
        if (same()) settingsSyncState.set({status:'local', message:`Local settings retained: ${error.message || 'Database unavailable'}`});
    } finally {
        running = false;
        if (rerun) { rerun = false; schedule(); }
    }
}
export const resolveSettingsConflict = choice => syncSettings(choice);
const stopConfig = configStore.subscribe(config => {
    const id = currentHost().id, settings = canonical(databaseSettings(config));
    if (id !== lastHost) { lastHost = id; lastSettings = settings; previousSettings = settings; return; }
    if (settings === lastSettings) return;
    lastSettings = settings;
    if (!applying) {
        // Preserve the prior local snapshot as an ancestor even before first connection.
        if (currentHost().syncBase === undefined) base(JSON.parse(previousSettings || settings));
        if (get(connectionState) === 'connected') schedule();
    }
    previousSettings = settings;
});
previousSettings = canonical(databaseSettings(get(configStore)));
const stopConnection = connectionState.subscribe(state => {
    clearTimeout(timer);
    if (state === 'connected') syncSettings();
    else { conflict = null; settingsSyncState.set({status:'offline', message:'Settings cached locally'}); }
});

function refreshOnFocus() { syncSettings(); }
function refreshOnVisible() { if(document.visibilityState === 'visible') syncSettings(); }
if (typeof window !== 'undefined') {
    window.addEventListener('focus',refreshOnFocus);
    document.addEventListener('visibilitychange',refreshOnVisible);
}
if (import.meta.hot) import.meta.hot.dispose(() => {
    clearTimeout(timer);
    stopConfig(); stopConnection();
    window.removeEventListener('focus',refreshOnFocus);
    document.removeEventListener('visibilitychange',refreshOnVisible);
});
