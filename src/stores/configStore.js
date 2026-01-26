import { writable } from 'svelte/store';

const STORAGE_KEY = 'retro_cnc_config_v1';

// Helper to generate unique IDs
const generateId = () => `id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Default configuration with panels structure
const DEFAULT_CONFIG = {
    title: 'RETRO CNC PANEL',
    server: {
        ip: window.location.hostname || 'localhost',
        port: '7125',
        autoConnect: false
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

        const systemMacros = config.macros.slice(4, 8).map((macro, idx) => ({
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

    return {
        ...config,
        tempPresets: config.tempPresets || DEFAULT_CONFIG.tempPresets,
        power: config.power || DEFAULT_CONFIG.power,
        panels: [
            // ... (rest of logic handles panels)
        ]
    };
};

// Load initial config
const loadConfig = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            const migrated = migrateConfig(parsed);
            // Merge with defaults to ensure new fields exist
            return { ...DEFAULT_CONFIG, ...migrated };
        }
    } catch (e) {
        console.error('Failed to load config', e);
    }
    return DEFAULT_CONFIG;
};

export const configStore = writable(loadConfig());

// Subscribe and save on change
configStore.subscribe(val => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(val));
    } catch (e) {
        console.error('Failed to save config', e);
    }
});

// Helper to update specific sections (cleaner API)
export const updateServerConfig = (ip, port, autoConnect) => {
    configStore.update(s => ({
        ...s,
        server: { ip, port, autoConnect }
    }));
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

        // Basic validation - check for required fields
        if (typeof parsed !== 'object' || parsed === null) {
            throw new Error('Invalid configuration format');
        }

        // Migrate if needed and merge with defaults
        const migrated = migrateConfig(parsed);
        const merged = { ...DEFAULT_CONFIG, ...migrated };

        // Update the store
        configStore.set(merged);

        return { success: true };
    } catch (e) {
        console.error('Failed to import config', e);
        return { success: false, error: e.message };
    }
};
