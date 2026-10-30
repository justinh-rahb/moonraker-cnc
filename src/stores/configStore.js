import { writable, get } from 'svelte/store';
import { mergeConfig, validateConfig, hostKey, brandingTitle } from '../lib/config.js';

// Persisted names remain stable across the Retrograde rebrand.
const STORAGE_KEY = 'retro_cnc_config_v1';

// Helper to generate unique IDs
const generateId = () => `id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Default configuration with panels structure
export const DEFAULT_CONFIG = {
    title: 'RETROGRADE',
    server: {
        ip: window.location.hostname || 'localhost',
        port: '7125',
        autoConnect: false,
        protocol: window.location.protocol === 'https:' ? 'https' : 'http'
    },
    panels: [
        {
            id: 'panel-calibration',
            title: 'CALIBRATION',
            order: 0,
            macros: [
                { id: 'macro-1', label: 'BED MESH CALIBRATE', gcode: 'BED_MESH_CALIBRATE', color: 'action', order: 0 },
                { id: 'macro-2', label: 'PROBE CALIBRATE', gcode: 'PROBE_CALIBRATE', color: 'action', order: 1 },
                { id: 'macro-3', label: 'PID EXTRUDER', gcode: 'PID_EXTRUDER', color: 'home', order: 2 },
                { id: 'macro-4', label: 'PID BED', gcode: 'PID_BED', color: 'home', order: 3 }
            ]
        },
        {
            id: 'panel-system',
            title: 'SYSTEM',
            order: 1,
            macros: [
                { id: 'macro-5', label: 'FIRMWARE RESTART', gcode: 'FIRMWARE_RESTART', color: 'action', order: 0 },
                { id: 'macro-6', label: 'SYSTEM INFO', gcode: 'M115', color: 'action', order: 1 }
            ]
        }
    ],
    temperature: {
        autoscale: true,
        showGraph: true,
        hideMonitors: false
    },
    tempPresets: [
        { id: 'pla', name: 'PLA', bed: 60, extruder: 200 },
        { id: 'petg', name: 'PETG', bed: 80, extruder: 240 },
        { id: 'abs', name: 'ABS', bed: 100, extruder: 250 }
    ],
    filament: {
        loadMacro: 'LOAD_FILAMENT',
        unloadMacro: 'UNLOAD_FILAMENT',
        distanceParam: 'DISTANCE',
        speedParam: 'SPEED',
        tempParam: 'TEMP'
    },
    printControl: {
        pauseMacro: 'PAUSE',
        resumeMacro: 'RESUME',
        cancelMacro: 'CANCEL_PRINT',
        confirmPause: false,
        confirmCancel: true,
        confirmStartPrint: true
    },
    console: {
        newestFirst: true,
        maxHistory: 500
    },
    cameras: [],
    gauges: {
        maxFlowRate: 30,
        flowRedline: 20,
        maxSpeedOverride: null,
        speedRedlinePercent: 90,
        showGaugeGraphics: true
    },
    power: {
        selectedDevice: 'OFF',
        confirmToggle: true
    }
};

// Migration function to convert old macros array to new panels structure
const migrateConfig = (config) => {
    // If already has panels structure, return as-is
    if (config.title !== undefined) config = { ...config, title: brandingTitle(config.title) };
    if (config.panels) {
        return config;
    }

    // Migrate old macros array to panels
    if (config.macros && Array.isArray(config.macros)) {
        const calibrationMacros = config.macros.slice(0, 4).map((macro, idx) => ({
            id: generateId(),
            label: macro.label || '',
            gcode: macro.gcode || '',
            color: macro.style || 'action',
            order: idx
        }));

        const systemMacros = config.macros.slice(4).map((macro, idx) => ({
            id: generateId(),
            label: macro.label || '',
            gcode: macro.gcode || '',
            color: macro.style || 'action',
            order: idx
        }));

        return {
            ...config,
            panels: [
                {
                    id: 'panel-calibration',
                    title: 'CALIBRATION',
                    order: 0,
                    macros: calibrationMacros
                },
                {
                    id: 'panel-system',
                    title: 'SYSTEM',
                    order: 1,
                    macros: systemMacros
                }
            ]
        };
    }

    return config;
};

// Printer settings and UX belong to each host; the registry and build theme are global.
const WORKSPACE_KEY = 'retro_cnc_workspace_v2';
const buildDefaults = typeof __DEFAULT_CONFIG__ === 'undefined' ? {} : __DEFAULT_CONFIG__;
const defaults = mergeConfig(DEFAULT_CONFIG, migrateConfig(buildDefaults));
const freshConfig = (server = defaults.server) => mergeConfig(defaults, { server });
function loadWorkspace() {
    try {
        const saved = JSON.parse(localStorage.getItem(WORKSPACE_KEY) || 'null');
        if (saved?.version === 2 && Array.isArray(saved.hosts) && saved.hosts.length) {
            saved.hosts.forEach(h => { h.name = brandingTitle(h.name); validateConfig(h.config); h.config = mergeConfig(defaults, migrateConfig(h.config)); });
            if (!saved.hosts.some(h => h.id === saved.activeHostId)) saved.activeHostId = saved.hosts[0].id;
            return saved;
        }
        const legacy = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
        const config = legacy ? mergeConfig(defaults, migrateConfig(legacy)) : freshConfig();
        validateConfig(config);
        const id = generateId();
        return { version: 2, activeHostId: id, global: { theme: 'retro' }, hosts: [{ id, name: config.title, config }] };
    } catch (error) {
        console.error('Unable to restore settings; original storage preserved', error);
        try { const original = localStorage.getItem(WORKSPACE_KEY); if (original) localStorage.setItem(WORKSPACE_KEY + '_recovery_' + Date.now(), original); } catch { /* Storage may be full or unavailable. */ }
        const id = generateId();
        return { version: 2, activeHostId: id, global: { theme: 'retro' }, hosts: [{ id, name: defaults.title, config: freshConfig() }] };
    }
}
export const workspaceStore = writable(loadWorkspace());
export const configStore = writable(get(workspaceStore).hosts.find(h => h.id === get(workspaceStore).activeHostId).config);
let applyingHost = false;
workspaceStore.subscribe(value => {
    try { localStorage.setItem(WORKSPACE_KEY, JSON.stringify(value)); }
    catch (error) { console.error('Unable to save settings', error); }
});
configStore.subscribe(config => {
    if (applyingHost) return;
    workspaceStore.update(w => ({ ...w, hosts: w.hosts.map(h => h.id === w.activeHostId ? { ...h, config } : h) }));
});
export function switchHost(id) {
    const w = get(workspaceStore);
    const host = w.hosts.find(h => h.id === id);
    if (!host) throw new Error('Unknown host');
    applyingHost = true;
    workspaceStore.set({ ...w, activeHostId: id });
    configStore.set(host.config);
    applyingHost = false;
}
export function addHost(name, server) {
    validateConfig({ server });
    const w = get(workspaceStore);
    if (w.hosts.some(h => hostKey(h.config.server) === hostKey(server))) throw new Error('This host already exists');
    const id = generateId();
    workspaceStore.update(w => ({ ...w, hosts: [...w.hosts, { id, name: name.trim() || server.ip, config: { ...freshConfig(server), title:name.trim() || server.ip } }] }));
    switchHost(id);
    return id;
}
export function editHost(id, name, server) {
    validateConfig({ server });
    const w = get(workspaceStore);
    if (w.hosts.some(h => h.id !== id && hostKey(h.config.server) === hostKey(server))) throw new Error('This host already exists');
    workspaceStore.update(w => ({ ...w, hosts: w.hosts.map(h => h.id === id ? { ...h, name: name.trim() || server.ip, config: { ...h.config, server } } : h) }));
    if (w.activeHostId === id) switchHost(id);
}
export function removeHost(id) {
    const w = get(workspaceStore);
    if (w.hosts.length < 2) throw new Error('Keep at least one host');
    if (id === w.activeHostId) switchHost(w.hosts.find(h => h.id !== id).id);
    workspaceStore.update(w => ({ ...w, hosts: w.hosts.filter(h => h.id !== id) }));
}
export const exportWorkspace = () => JSON.stringify(get(workspaceStore), null, 2);

// Helper to update specific sections (cleaner API)
export const updateServerConfig = (ip, port, autoConnect) => {
    const current = get(configStore);
    const server = { ...current.server, ip:ip.trim(), port:String(port || ''), autoConnect };
    validateConfig({server});
    if (hostKey(server) !== hostKey(current.server)) {
        const existing = get(workspaceStore).hosts.find(h => hostKey(h.config.server) === hostKey(server));
        if (existing) switchHost(existing.id);
        else addHost(server.ip, server);
    }
    configStore.update(s => ({...s,server}));
};

export const updateTitle = (title) => {
    configStore.update(s => ({ ...s, title }));
};

export const updateFilamentConfig = (updates) => {
    configStore.update(s => ({
        ...s,
        filament: { ...(s.filament || DEFAULT_CONFIG.filament), ...updates }
    }));
};

export const updatePrintControlConfig = (updates) => {
    configStore.update(s => ({
        ...s,
        printControl: { ...(s.printControl || DEFAULT_CONFIG.printControl), ...updates }
    }));
};

export const updateConsoleConfig = (updates) => {
    configStore.update(s => ({
        ...s,
        console: { ...(s.console || DEFAULT_CONFIG.console), ...updates }
    }));
};

export const updateGaugeConfig = (updates) => {
    configStore.update(s => ({
        ...s,
        gauges: { ...(s.gauges || DEFAULT_CONFIG.gauges), ...updates }
    }));
};

// ============ CAMERA MANAGEMENT ============

export const addCamera = () => {
    configStore.update(s => ({
        ...s,
        cameras: [
            ...(s.cameras || []),
            {
                id: generateId(),
                name: 'NEW CAMERA',
                enabled: false,
                streamUrl: '',
                snapshotUrl: '',
                streamType: 'mjpeg',
                aspectRatio: '16:9',
                flipH: false,
                flipV: false,
                rotation: 0,
                showFps: false,
                targetRefreshRate: 5
            }
        ]
    }));
};

export const deleteCamera = (cameraId) => {
    configStore.update(s => ({
        ...s,
        cameras: (s.cameras || []).filter(c => c.id !== cameraId)
    }));
};

export const updateCamera = (cameraId, updates) => {
    configStore.update(s => ({
        ...s,
        cameras: (s.cameras || []).map(c =>
            c.id === cameraId ? { ...c, ...updates } : c
        )
    }));
};

// ============ PANEL MANAGEMENT ============

export const createPanel = (title = 'NEW PANEL') => {
    configStore.update(s => {
        const newPanel = {
            id: generateId(),
            title,
            order: s.panels.length,
            macros: []
        };
        return { ...s, panels: [...s.panels, newPanel] };
    });
};

export const deletePanel = (panelId) => {
    configStore.update(s => ({
        ...s,
        panels: s.panels.filter(p => p.id !== panelId)
    }));
};

export const renamePanel = (panelId, newTitle) => {
    configStore.update(s => ({
        ...s,
        panels: s.panels.map(p =>
            p.id === panelId ? { ...p, title: newTitle } : p
        )
    }));
};

export const reorderPanels = (panelIds) => {
    configStore.update(s => {
        const panelMap = new Map(s.panels.map(p => [p.id, p]));
        const reorderedPanels = panelIds
            .map((id, idx) => {
                const panel = panelMap.get(id);
                return panel ? { ...panel, order: idx } : null;
            })
            .filter(Boolean);
        return { ...s, panels: reorderedPanels };
    });
};

// ============ POWER DEVICE MANAGEMENT ============

export const updatePowerConfig = (updates) => {
    configStore.update(s => ({
        ...s,
        power: { ...(s.power || DEFAULT_CONFIG.power), ...updates }
    }));
};

// ============ MACRO MANAGEMENT ============

export const addMacroToPanel = (panelId, macro = {}) => {
    configStore.update(s => {
        const panels = s.panels.map(p => {
            if (p.id === panelId) {
                const newMacro = {
                    id: generateId(),
                    label: macro.label || 'NEW MACRO',
                    gcode: macro.gcode || '',
                    color: macro.color || 'action',
                    order: p.macros.length
                };
                return { ...p, macros: [...p.macros, newMacro] };
            }
            return p;
        });
        return { ...s, panels };
    });
};

export const deleteMacro = (panelId, macroId) => {
    configStore.update(s => ({
        ...s,
        panels: s.panels.map(p =>
            p.id === panelId
                ? { ...p, macros: p.macros.filter(m => m.id !== macroId) }
                : p
        )
    }));
};

export const updateMacro = (panelId, macroId, updates) => {
    configStore.update(s => ({
        ...s,
        panels: s.panels.map(p =>
            p.id === panelId
                ? {
                    ...p,
                    macros: p.macros.map(m =>
                        m.id === macroId ? { ...m, ...updates } : m
                    )
                }
                : p
        )
    }));
};

export const reorderMacros = (panelId, macroIds) => {
    configStore.update(s => ({
        ...s,
        panels: s.panels.map(p => {
            if (p.id === panelId) {
                const macroMap = new Map(p.macros.map(m => [m.id, m]));
                const reorderedMacros = macroIds
                    .map((id, idx) => {
                        const macro = macroMap.get(id);
                        return macro ? { ...macro, order: idx } : null;
                    })
                    .filter(Boolean);
                return { ...p, macros: reorderedMacros };
            }
            return p;
        })
    }));
};

export const moveMacro = (sourcePanelId, targetPanelId, macroId, targetIndex = -1) => {
    configStore.update(s => {
        let movedMacro = null;

        // Remove from source panel
        const panels = s.panels.map(p => {
            if (p.id === sourcePanelId) {
                movedMacro = p.macros.find(m => m.id === macroId);
                return { ...p, macros: p.macros.filter(m => m.id !== macroId) };
            }
            return p;
        });

        // Add to target panel
        const finalPanels = panels.map(p => {
            if (p.id === targetPanelId && movedMacro) {
                const newMacros = [...p.macros];
                const insertIndex = targetIndex >= 0 ? targetIndex : newMacros.length;
                newMacros.splice(insertIndex, 0, { ...movedMacro, order: insertIndex });
                // Reorder remaining macros
                return {
                    ...p,
                    macros: newMacros.map((m, idx) => ({ ...m, order: idx }))
                };
            }
            return p;
        });

        return { ...s, panels: finalPanels };
    });
};

// ============ PRESET MANAGEMENT ============

export const addPreset = () => {
    configStore.update(s => ({
        ...s,
        tempPresets: [
            ...(s.tempPresets || []),
            { id: generateId(), name: 'NEW PRESET', bed: 60, extruder: 200 }
        ]
    }));
};

export const deletePreset = (presetId) => {
    configStore.update(s => ({
        ...s,
        tempPresets: s.tempPresets.filter(p => p.id !== presetId)
    }));
};

export const updatePreset = (presetId, updates) => {
    configStore.update(s => ({
        ...s,
        tempPresets: s.tempPresets.map(p =>
            p.id === presetId ? { ...p, ...updates } : p
        )
    }));
};

// Legacy support - kept for backward compatibility with existing components
export const updateMacroLegacy = (index, label, gcode) => {
    // This will be removed once all components are updated
    console.warn('updateMacroLegacy is deprecated. Use updateMacro instead.');
};

// ============ IMPORT / EXPORT ============

export const exportConfig = () => {
    let currentConfig;
    configStore.subscribe(val => currentConfig = val)();
    return JSON.stringify(currentConfig, null, 2);
};

export const importConfig = (jsonString) => {
    try {
        const parsed = JSON.parse(jsonString);

        if (parsed?.version === 2 && Array.isArray(parsed.hosts)) {
            if (!parsed.hosts.length) throw new Error('Export contains no hosts');
            const ids = new Set();
            const endpoints = new Set();
            const hosts = parsed.hosts.map(h => {
                if (!h.id || ids.has(h.id)) throw new Error('Invalid or duplicate host ID');
                ids.add(h.id);
                validateConfig(h.config);
                const key = hostKey(h.config.server);
                if (endpoints.has(key)) throw new Error('Duplicate host address');
                endpoints.add(key);
                return { id: h.id, name: brandingTitle(String(h.name || h.config.title || h.config.server.ip)), config: mergeConfig(defaults, migrateConfig(h.config)) };
            });
            const activeHostId = ids.has(parsed.activeHostId) ? parsed.activeHostId : hosts[0].id;
            applyingHost = true;
            workspaceStore.set({ version: 2, activeHostId, hosts, global: { theme: 'retro', ...parsed.global } });
            configStore.set(hosts.find(h => h.id === activeHostId).config);
            applyingHost = false;
        } else {
            validateConfig(parsed);
            const merged = mergeConfig(defaults, migrateConfig(parsed));
            // Legacy exports describe one printer. Never overwrite a different printer.
            const w = get(workspaceStore);
            const match = w.hosts.find(h => hostKey(h.config.server) === hostKey(merged.server));
            const id = match?.id || generateId();
            workspaceStore.update(w => ({ ...w, hosts: match ? w.hosts.map(h => h.id === id ? { ...h, config: merged } : h) : [...w.hosts, { id, name: merged.title, config: merged }] }));
            switchHost(id);
        }

        return { success: true };
    } catch (e) {
        console.error('Failed to import config', e);
        return { success: false, error: e.message };
    }
};
