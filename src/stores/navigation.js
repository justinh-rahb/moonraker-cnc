import { get } from 'svelte/store';
import { filePickerOpen, filePickerPath, settingsOpen, settingsTab, historyOpen, hostsOpen } from './uiStore.js';
import { parseRoute, routeHash, SETTINGS_TABS } from '../lib/navigation.js';

export function initializeNavigation() {
    let applying = false;
    let initializing = true;
    let disposed = false;
    let goingBack = false;
    let revision = 0;
    let currentView = 'dashboard';
    const views = {files:filePickerOpen,settings:settingsOpen,history:historyOpen,hosts:hostsOpen};
    const snapshot = () => ({files:get(filePickerOpen),path:get(filePickerPath),settings:get(settingsOpen),tab:get(settingsTab),history:get(historyOpen),hosts:get(hostsOpen)});
    const url = hash => window.location.pathname + window.location.search + hash;
    const marker = () => {
        const value = window.history.state?.retrogradeNavigation;
        return value?.version === 1 && value.route === window.location.hash ? value : null;
    };
    function state(hash,parent) {
        const existing = window.history.state;
        return {...(existing && typeof existing === 'object' ? existing : {}),retrogradeNavigation:{version:1,route:hash,parent}};
    }
    function read() {
        revision++; goingBack = false;
        applying = true;
        const route = parseRoute(window.location.hash);
        currentView = route.view;
        for (const [view,store] of Object.entries(views)) store.set(route.view === view);
        if (route.view === 'files') filePickerPath.set(route.path);
        if (route.view === 'settings') settingsTab.set(route.tab);
        applying = false;
        const canonical = routeHash(snapshot());
        const owned = marker();
        // Mark the existing entry; a reload/deep link never creates a new one.
        if (canonical !== window.location.hash || !owned) window.history.replaceState(state(canonical,owned?.parent === true),'',url(canonical));
    }
    function schedule() {
        if (goingBack) return;
        const current = ++revision;
        queueMicrotask(() => {
            if (disposed || goingBack || current !== revision) return;
            const hash = routeHash(snapshot());
            const nextView = parseRoute(hash).view;
            if (hash === window.location.hash) return;
            const owned = marker();
            if (nextView === 'dashboard' && currentView !== 'dashboard') {
                // Close a view by consuming its app-owned entry, not by adding a
                // second dashboard entry. Direct links close in place instead.
                if (owned?.parent === true) { goingBack = true; window.history.back(); return; }
                window.history.replaceState(state(hash,false),'',url(hash));
            } else if (nextView === currentView) {
                // Settings tabs and file directories are location refinements,
                // not extra Back-button stops.
                window.history.replaceState(state(hash,owned?.parent === true),'',url(hash));
            } else {
                window.history.pushState(state(hash,!!owned),'',url(hash));
            }
            currentView = nextView;
        });
    }
    read();
    const subscriptions = Object.entries(views).map(([view,store]) => store.subscribe(open => {
        if (initializing || applying || disposed) return;
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
