import { mergeConfig, validateConfig, brandingTitle } from './config.js';
export const databaseSettings = config => {
    const { server, ...settings } = config;
    return settings;
};
export function canonical(value) {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
    return JSON.stringify(value);
}
// Three-way comparison keeps offline edits from silently replacing another browser's changes.
export function reconcileSettings(local, remote, base) {
    const ours = canonical(local), theirs = canonical(remote);
    if (remote === null) return { action: 'upload' };
    if (ours === theirs) return { action: 'equal' };
    if (base === undefined) return { action: 'download' };
    const ancestor = canonical(base);
    if (ours === ancestor) return { action: 'download' };
    if (theirs === ancestor) return { action: 'upload' };
    return { action: 'conflict' };
}
export function validateRemote(value) {
    if (value?.version !== 1 || !value.settings || typeof value.settings !== 'object') throw new Error('Unsupported server settings format');
    validateConfig(value.settings);
    const settings = mergeConfig({}, value.settings);
    if (settings.title !== undefined) settings.title = brandingTitle(settings.title);
    return settings;
}
