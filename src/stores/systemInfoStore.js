import { writable } from 'svelte/store';
import { send, connectionState } from './websocket.js';

// Debug logging (only in dev mode)
const DEBUG = import.meta.env.DEV;

// Initial state
export const systemInfo = writable({
    host: {
        cpu: {
            model: null,
            cores: 0,
            description: null
        },
        memory: {
            total: 0,
            units: 'kB'
        },
        distribution: {
            name: null,
            version: null
        },
        hostname: null
    },
    klipper: {
        version: null,
        state: null
    },
    mcus: {}, // Dynamic map of MCU objects
    isLoading: true,
    error: null
});

// WebSocket Integration
connectionState.subscribe((state) => {
    if (state === 'connected') {
        initializeSystemInfo();
    } else if (state === 'disconnected') {
        // Reset to loading state on disconnect
        systemInfo.update(s => ({
            ...s,
            isLoading: true,
            error: null
        }));
    }
});

const initializeSystemInfo = async () => {
    if (DEBUG) console.log('[SystemInfo] Initializing system info...');

    systemInfo.update(s => ({ ...s, isLoading: true, error: null }));

    try {
        // Fetch all data in parallel for better performance
        const [hostData, printerData, mcuData] = await Promise.allSettled([
            fetchHostInfo(),
            fetchKlipperInfo(),
            fetchMCUInfo()
        ]);

        systemInfo.update(s => {
            const newState = { ...s, isLoading: false };

            // Process host info
            if (hostData.status === 'fulfilled' && hostData.value) {
                newState.host = hostData.value;
            }

            // Process Klipper info
            if (printerData.status === 'fulfilled' && printerData.value) {
                newState.klipper = printerData.value;
            }

            // Process MCU info
            if (mcuData.status === 'fulfilled' && mcuData.value) {
                newState.mcus = mcuData.value;
            }

            // Set error only if all requests failed
            if (hostData.status === 'rejected' && printerData.status === 'rejected' && mcuData.status === 'rejected') {
                newState.error = 'Failed to fetch system information';
            }

            return newState;
        });

        if (DEBUG) console.log('[SystemInfo] System info initialized successfully');
    } catch (e) {
        console.error('[SystemInfo] Failed to initialize system info:', e);
        systemInfo.update(s => ({
            ...s,
            isLoading: false,
            error: 'Failed to fetch system information'
        }));
    }
};

// Fetch host system information
const fetchHostInfo = async () => {
    try {
        const response = await send('machine.system_info');

        if (response && response.system_info) {
            const info = response.system_info;

            return {
                cpu: {
                    model: info.cpu_info?.model || info.cpu_info?.cpu_desc || 'Unknown',
                    cores: info.cpu_info?.cpu_count || 0,
                    description: info.cpu_info?.processor || null
                },
                memory: {
                    total: info.cpu_info?.total_memory || 0,
                    units: info.cpu_info?.memory_units || 'kB'
                },
                distribution: {
                    name: info.distribution?.name || 'Unknown',
                    version: info.distribution?.version || null
                },
                hostname: info.hostname || null
            };
        }

        return null;
    } catch (e) {
        if (DEBUG) console.warn('[SystemInfo] Could not fetch host info:', e);
        throw e;
    }
};

// Fetch Klipper information
const fetchKlipperInfo = async () => {
    try {
        const response = await send('printer.info');

        if (response) {
            return {
                version: response.software_version || 'Unknown',
                state: response.state || 'unknown',
                hostname: response.hostname || null
            };
        }

        return null;
    } catch (e) {
        if (DEBUG) console.warn('[SystemInfo] Could not fetch Klipper info:', e);
        throw e;
    }
};

// Fetch MCU information
const fetchMCUInfo = async () => {
    try {
        // First, list all available objects to find MCUs
        const listResponse = await send('printer.objects.list');
        const allObjects = listResponse.objects || [];

        // Find all MCU objects (mcu, mcu linux, mcu secondary, etc.)
        const mcuObjects = allObjects.filter(obj =>
            obj === 'mcu' || obj.startsWith('mcu ')
        );

        if (mcuObjects.length === 0) {
            if (DEBUG) console.log('[SystemInfo] No MCU objects found');
            return {};
        }

        if (DEBUG) console.log('[SystemInfo] Found MCU objects:', mcuObjects);

        // Query all MCU objects for their information
        const queryParams = {};
        mcuObjects.forEach(mcu => {
            queryParams[mcu] = ['mcu_version', 'mcu_build_versions', 'mcu_constants'];
        });

        const queryResponse = await send('printer.objects.query', { objects: queryParams });
        const status = queryResponse.status || {};

        // Process MCU data
        const mcuData = {};
        mcuObjects.forEach(mcuName => {
            const mcuInfo = status[mcuName];
            if (mcuInfo) {
                mcuData[mcuName] = {
                    name: formatMCUName(mcuName),
                    version: mcuInfo.mcu_version || 'Unknown',
                    buildVersions: mcuInfo.mcu_build_versions || null,
                    type: mcuInfo.mcu_constants?.MCU || 'Unknown'
                };
            }
        });

        return mcuData;
    } catch (e) {
        if (DEBUG) console.warn('[SystemInfo] Could not fetch MCU info:', e);
        throw e;
    }
};

// Format MCU name for display
const formatMCUName = (rawName) => {
    // mcu -> MCU
    // mcu linux -> MCU (Linux)
    // mcu toolhead -> MCU (Toolhead)

    if (rawName === 'mcu') return 'MCU';

    const parts = rawName.split(' ');
    if (parts.length > 1) {
        const name = parts.slice(1).join(' ');
        return `MCU (${name.charAt(0).toUpperCase() + name.slice(1)})`;
    }

    return rawName.toUpperCase();
};

// Format memory size for display
export const formatMemory = (value, units) => {
    if (!value || value === 0) return 'N/A';

    // Convert to appropriate units
    if (units === 'kB') {
        const mb = value / 1024;
        if (mb >= 1024) {
            return `${(mb / 1024).toFixed(1)} GB`;
        }
        return `${mb.toFixed(0)} MB`;
    }

    return `${value} ${units}`;
};
