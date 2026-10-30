import { get } from 'svelte/store';
import { filePickerOpen, filePickerPath, settingsOpen, settingsTab, historyOpen, hostsOpen } from './uiStore.js';
import { parseRoute, routeHash, SETTINGS_TABS } from '../lib/navigation.js';

export function initializeNavigation() {
    let applying = false;
    let initializing = true;
    let disposed = false;
    let revision = 0;
    const views = {files:filePickerOpen,settings:settingsOpen,history:historyOpen,hosts:hostsOpen};
    const snapshot = () => ({files:get(filePickerOpen),path:get(filePickerPath),settings:get(settingsOpen),tab:get(settingsTab),history:get(historyOpen),hosts:get(hostsOpen)});
    const url = hash => window.location.pathname + window.location.search + hash;
    function read() {
        // A browser traversal supersedes any UI write queued in the same turn.
        revision++;
        applying = true;
        const route = parseRoute(window.location.hash);
        for (const [view,store] of Object.entries(views)) store.set(route.view === view);
        if (route.view === 'files') filePickerPath.set(route.path);
        if (route.view === 'settings') settingsTab.set(route.tab);
        applying = false;
        const canonical = routeHash(snapshot());
        if (canonical !== window.location.hash) window.history.replaceState(null,'',url(canonical));
    }
    function schedule() {
        const current = ++revision;
        queueMicrotask(() => {
            if (disposed || current !== revision) return;
            const hash = routeHash(snapshot());
            if (hash !== window.location.hash) window.history.pushState(null,'',url(hash));
        });
    }
    read();
    const subscriptions = Object.entries(views).map(([view,store]) => store.subscribe(open => {
        if (initializing || applying || disposed) return;
        // A newly opened view owns navigation; don't leave another modal behind it.
        if (open) {
            applying = true;
            if (view === 'settings' && !SETTINGS_TABS.includes(get(settingsTab))) settingsTab.set('General');
            for (const [other,otherStore] of Object.entries(views)) if (other !== view) otherStore.set(false);
            applying = false;
        }
        schedule();
    }));
    subscriptions.push(...[filePickerPath,settingsTab].map(store => store.subscribe(() => {
        if (!initializing && !applying && !disposed) schedule();
    })));
    initializing = false;
    window.addEventListener('popstate',read);
    window.addEventListener('hashchange',read);
    return () => {
        disposed = true; revision++;
        subscriptions.forEach(stop => stop());
        window.removeEventListener('popstate',read);
        window.removeEventListener('hashchange',read);
    };
}
