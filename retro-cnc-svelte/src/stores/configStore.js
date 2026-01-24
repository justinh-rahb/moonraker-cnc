import { writable } from 'svelte/store';

const STORAGE_KEY = 'retro_cnc_config_v1';

// Default configuration
const DEFAULT_CONFIG = {
    title: 'RETRO CNC PANEL',
    server: {
        ip: '192.168.2.241',
        port: '7125',
        autoConnect: false
    },
    macros: [
        // Motion Panel (4 buttons)
        { label: 'Z OFFSET TEST', gcode: 'TEST_Z_OFFSET' },
        { label: 'ZZ OFFSET TEST', gcode: 'TEST_ZZ_OFFSET' },
        { label: 'Z COMPENSATE', gcode: 'Z_COMPENSATE' },
        { label: 'PID EXTRUDER', gcode: 'PID_CALIBRATE HEATER=extruder TARGET=210' },

        // Power Panel (4 buttons)
        { label: 'POWEROFF NOW', gcode: 'M112', style: 'danger' },
        { label: 'POWEROFF CANCEL', gcode: 'M112', style: 'danger' }, // Placeholder
        { label: 'FIRMWARE RESTART', gcode: 'FIRMWARE_RESTART' },
        { label: 'SYSTEM INFO', gcode: 'M115' }
    ]
};

// Load initial config
const loadConfig = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            // Merge stored config with defaults to ensure new fields effectively exist
            return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
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

export const updateMacro = (index, label, gcode) => {
    configStore.update(s => {
        const newMacros = [...s.macros];
        if (newMacros[index]) {
            newMacros[index] = { ...newMacros[index], label, gcode };
        }
        return { ...s, macros: newMacros };
    });
};
