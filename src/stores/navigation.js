import { get } from 'svelte/store';
import { filePickerOpen, filePickerPath, settingsOpen, settingsTab, historyOpen } from './uiStore.js';
import { parseRoute, routeHash } from '../lib/navigation.js';

export function initializeNavigation() {
    let applying = false;
    let scheduled = false;
    let disposed = false;
    function read() {
        applying = true;
        const route = parseRoute(window.location.hash);
        filePickerOpen.set(route.view === 'files');
        settingsOpen.set(route.view === 'settings');
        historyOpen.set(route.view === 'history');
        if (route.view === 'files') filePickerPath.set(route.path);
        if (route.view === 'settings') settingsTab.set(route.tab);
        applying = false;
    }
    read();
    const subscriptions = [filePickerOpen, filePickerPath, settingsOpen, settingsTab, historyOpen].map(store => store.subscribe(() => {
        if (applying || scheduled) return;
        scheduled = true;
        queueMicrotask(() => {
            scheduled = false;
            if (disposed) return;
            const hash = routeHash({ files: get(filePickerOpen), path: get(filePickerPath), settings: get(settingsOpen), tab: get(settingsTab), history: get(historyOpen) });
            if (hash !== window.location.hash) window.history.pushState(null, '', window.location.pathname + window.location.search + hash);
        });
    }));
    window.addEventListener('popstate', read);
    window.addEventListener('hashchange', read);
    return () => { disposed = true; subscriptions.forEach(fn => fn()); window.removeEventListener('popstate', read); window.removeEventListener('hashchange', read); };
}
