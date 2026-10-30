export const SETTINGS_TABS = ['General', 'Interface', 'Macros', 'Panels', 'Cameras', 'Sysinfo', 'Hosts'];
export function parseRoute(hash) {
    try {
        const [head, ...parts] = hash.replace(/^#\/?/, '').split('/');
        if (head === 'files') {
            const segments = parts.map(decodeURIComponent).filter(Boolean);
            if (segments.some(s => s === '..' || s === '.' || s.includes('/'))) return { view: 'dashboard' };
            return { view: 'files', path: segments.join('/') };
        }
        if (head === 'history') return { view: 'history' };
        if (head === 'settings') return { view: 'settings', tab: SETTINGS_TABS.find(t => t.toLowerCase() === (parts[0] || '').toLowerCase()) || 'General' };
    } catch { /* Invalid URL encoding falls back safely. */ }
    return { view: 'dashboard' };
}
export function routeHash({ files, path, settings, tab, history }) {
    if (settings) return `#/settings/${encodeURIComponent(tab.toLowerCase())}`;
    if (history) return '#/history';
    if (files) return '#/files' + (path ? '/' + path.split('/').map(encodeURIComponent).join('/') : '');
    return '';
}
