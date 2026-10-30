// Only merge plain JSON objects; arrays are intentional replacements.
export function mergeConfig(base, override) {
    const result = structuredClone(base);
    if (!override || typeof override !== 'object') return result;
    for (const [key, value] of Object.entries(override)) {
        if (['__proto__', 'prototype', 'constructor'].includes(key)) continue;
        result[key] = value && typeof value === 'object' && !Array.isArray(value)
            ? mergeConfig(base?.[key] || {}, value) : structuredClone(value);
    }
    return result;
}
export function serverUrl(server) {
    const raw = server.ip.trim();
    const url = new URL(raw.includes('://') ? raw : `${server.protocol || 'http'}://${raw}`);
    if (!['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Use an HTTP(S) host address without credentials or query parameters');
    url.protocol = ['https:', 'wss:'].includes(url.protocol) ? 'https:' : 'http:';
    if (server.port) url.port = String(server.port);
    return url.href.replace(/\/$/, '');
}
export const hostKey = server => serverUrl(server);
export function validateConfig(config) {
    if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('Configuration must be an object');
    if (config.server !== undefined) {
        if (!config.server || typeof config.server !== 'object' || Array.isArray(config.server)) throw new Error('Invalid server configuration');
        if (typeof config.server.ip !== 'string' || !config.server.ip.trim()) throw new Error('Host address is required');
        if (config.server.port && (!/^\d+$/.test(String(config.server.port)) || +config.server.port < 1 || +config.server.port > 65535)) throw new Error('Port must be between 1 and 65535');
        serverUrl(config.server);
    }
    for (const key of ['cameras', 'panels', 'tempPresets', 'macros']) if (config[key] !== undefined && !Array.isArray(config[key])) throw new Error(`${key} must be an array`);
    for (const key of ['dashboard']) if (config[key]) for (const value of Object.values(config[key])) if (!Array.isArray(value) || value.some(v => typeof v !== 'string')) throw new Error('Invalid dashboard layout');
    const uniqueIds = (items, label) => {
        const ids = new Set();
        for (const item of items) { if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id)) throw new Error(`Invalid or duplicate ${label} ID`); ids.add(item.id); }
    };
    uniqueIds(config.panels || [], 'panel');
    uniqueIds(config.cameras || [], 'camera');
    uniqueIds(config.tempPresets || [], 'preset');
    for (const panel of config.panels || []) {
        if (!Array.isArray(panel.macros) || typeof panel.title !== 'string') throw new Error('Invalid macro panel');
        uniqueIds(panel.macros, 'macro');
        for(const macro of panel.macros) if(typeof macro.label !== 'string' || typeof macro.gcode !== 'string') throw new Error('Invalid macro');
    }
    for (const macro of config.macros || []) if (!macro || typeof macro.label !== 'string' || typeof macro.gcode !== 'string') throw new Error('Invalid legacy macro');
    for (const preset of config.tempPresets || []) {
        if (typeof preset.name !== 'string' || !Number.isFinite(preset.bed) || !Number.isFinite(preset.extruder) || preset.bed < 0 || preset.extruder < 0) throw new Error('Invalid temperature preset');
    }
    for (const camera of config.cameras || []) if (!camera || typeof camera.id !== 'string' || typeof camera.name !== 'string') throw new Error('Invalid camera');
    for (const camera of config.cameras || []) {
        for (const key of ['streamUrl', 'snapshotUrl', 'aspectRatio']) if (camera[key] !== undefined && typeof camera[key] !== 'string') throw new Error('Invalid camera URL or aspect ratio');
    }
    for (const [key,value] of Object.entries(config.increments || {})) if (!Number.isFinite(value) || value <= 0 || (key === 'zOffsetIncrement' && value > 1)) throw new Error('Invalid control increment');
    if (config.console?.maxHistory !== undefined && (!Number.isInteger(config.console.maxHistory) || config.console.maxHistory < 1 || config.console.maxHistory > 10000)) throw new Error('Invalid console history limit');
    if (config.title !== undefined && typeof config.title !== 'string') throw new Error('Title must be text');
    for (const key of ['temperature', 'filament', 'printControl', 'console', 'gauges', 'power', 'dashboard', 'increments']) if (config[key] !== undefined && (!config[key] || typeof config[key] !== 'object' || Array.isArray(config[key]))) throw new Error(`${key} must be an object`);
}
