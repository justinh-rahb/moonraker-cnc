import { writable, derived, get } from 'svelte/store';
import { send, onNotification, connectionState, getConnectionGeneration } from './websocket.js';
import { configStore } from './configStore.js';
import { notificationStore } from './notificationStore.js';
import { machineState } from './machineStore.js';

// Internal state for power devices
const powerState = writable({
    devices: [],
    deviceStatuses: {},
    isInitialized: false,
    lastError: null
});

// Initialize power device monitoring when connected
let cleanupNotification = null;
let pollInterval = null;

// Fetch available power devices from Moonraker
const fetchDevices = async () => {
    const generation = getConnectionGeneration();
    try {
        const result = await send('machine.device_power.devices');
        return result.devices || [];
    } catch (error) {
        // Silently handle if device_power plugin is not available (Method not found)
        if (error.code === -32601) {
            // Method not found - device_power plugin not configured
            return [];
        }
        if (generation !== getConnectionGeneration()) return [];
        console.warn('Failed to fetch power devices:', error);
        powerState.update(s => ({ ...s, lastError: error.message || 'Failed to fetch devices' }));
        return [];
    }
};

// Fetch status for a specific device
const fetchDeviceStatus = async (deviceName) => {
    try {
        const result = await send('machine.device_power.status', { [deviceName]: null });
        return result[deviceName];
    } catch (error) {
        // Silently handle if device_power plugin is not available
        if (error.code === -32601) {
            return 'unavailable';
        }
        console.warn(`Failed to fetch status for ${deviceName}:`, error);
        return 'error';
    }
};

// Initialize power device system
const initializePowerDevices = async () => {
    const generation = getConnectionGeneration();
    const devices = await fetchDevices();
    if (generation !== getConnectionGeneration()) return;
    
    if (devices.length === 0) {
        powerState.set({
            devices: [],
            deviceStatuses: {},
            isInitialized: true,
            lastError: null
        });
        return;
    }

    // Fetch initial status for all devices
    const statuses = {};
    for (const device of devices) {
        const status = await fetchDeviceStatus(device.device);
        if (generation !== getConnectionGeneration()) return;
        statuses[device.device] = {
            status: device.status || status,
            locked: device.locked_while_printing || false,
            type: device.type || 'unknown'
        };
    }

    powerState.set({
        devices,
        deviceStatuses: statuses,
        isInitialized: true,
        lastError: null
    });

    // Subscribe to power change notifications
    if (cleanupNotification) {
        cleanupNotification();
    }
    cleanupNotification = onNotification((method, params) => {
        if (method === 'notify_power_changed') {
            handlePowerNotification(params);
        }
    });
};

// Handle power change notifications from websocket
const handlePowerNotification = (params) => {
    if (!params || !params[0]) return;
    
    const entry = params[0];
    const updates = entry.device ? { [entry.device]: entry } : entry;
    powerState.update(s => {
        const newStatuses = { ...s.deviceStatuses };
        
        for (const [deviceName, deviceInfo] of Object.entries(updates)) {
            newStatuses[deviceName] = {
                status: deviceInfo.status,
                locked: deviceInfo.locked_while_printing || false,
                type: deviceInfo.type || 'unknown'
            };
        }
        
        return { ...s, deviceStatuses: newStatuses };
    });
};

// Poll device statuses periodically
const pollDeviceStatuses = async () => {
    const generation = getConnectionGeneration();
    const state = get(powerState);
    if (!state.isInitialized || state.devices.length === 0) {
        return;
    }

    for (const device of state.devices) {
        const status = await fetchDeviceStatus(device.device);
        if (generation !== getConnectionGeneration()) return;
        powerState.update(s => ({
            ...s,
            deviceStatuses: {
                ...s.deviceStatuses,
                [device.device]: {
                    ...s.deviceStatuses[device.device],
                    status: status
                }
            }
        }));
    }
};

// Start polling for status updates
const startPolling = () => {
    if (pollInterval) {
        clearInterval(pollInterval);
    }
    // Poll every 5 seconds
    pollInterval = setInterval(pollDeviceStatuses, 5000);
};

// Derived store for the currently selected device
export const currentPowerDevice = derived(
    [powerState, configStore, machineState],
    ([$powerState, $config, $machineState]) => {
        if (!$powerState.isInitialized || $powerState.devices.length === 0) {
            return {
                deviceName: null,
                status: 'unavailable',
                locked: false,
                isOn: false,
                isAvailable: false,
                displayName: 'No Power Devices',
                error: $powerState.lastError
            };
        }

        const selectedDevice = $config.power?.selectedDevice || 'OFF';
        if (selectedDevice === 'OFF') return { isAvailable:false, isOn:false, locked:false, displayName:'Power control disabled' };
        let targetDevice = null;

        if (selectedDevice === 'AUTO') {
            // Try to find a device named "printer" first, otherwise use first device
            targetDevice = $powerState.devices.find(d => d.device.toLowerCase() === 'printer')
                || $powerState.devices[0];
        } else {
            // Find the specifically selected device
            targetDevice = $powerState.devices.find(d => d.device === selectedDevice);
            
            // Fallback to AUTO behavior if selected device not found
            if (!targetDevice) {
                targetDevice = $powerState.devices.find(d => d.device.toLowerCase() === 'printer')
                    || $powerState.devices[0];
            }
        }

        if (!targetDevice) {
            return {
                deviceName: null,
                status: 'unavailable',
                locked: false,
                isOn: false,
                isAvailable: false,
                displayName: 'No Device Selected',
                error: null
            };
        }

        const deviceStatus = $powerState.deviceStatuses[targetDevice.device] || {};
        const status = deviceStatus.status || 'init';
        const locked = deviceStatus.locked && ($machineState.printStatsState === 'printing' || $machineState.printStatsState === 'paused');

        return {
            deviceName: targetDevice.device,
            status,
            locked,
            isOn: status === 'on',
            isAvailable: status !== 'error' && status !== 'unavailable',
            displayName: targetDevice.device,
            error: status === 'error' ? 'Device Error' : null,
            type: deviceStatus.type || 'unknown'
        };
    }
);

// Toggle power for the current device
export const togglePower = async () => {
    const generation = getConnectionGeneration();
    const device = get(currentPowerDevice);
    
    if (!device.isAvailable || device.locked || !device.deviceName) {
        console.warn('Cannot toggle power - device not available or locked');
        return false;
    }

    const action = device.isOn ? 'off' : 'on';
    
    try {
        await send(`machine.device_power.${action}`, { [device.deviceName]: null });
        // Wait for websocket notification to update state (graceful recovery)
        return true;
    } catch (error) {
        if (generation !== getConnectionGeneration()) return false;
        console.error(`Failed to toggle power for ${device.deviceName}:`, error);
        notificationStore.addError({
            message: `Failed to turn ${action} ${device.deviceName}: ${error.message || 'Unknown error'}`,
            code: error.code || 'POWER_ERROR'
        });
        
        // Re-fetch status for graceful recovery
        const currentStatus = await fetchDeviceStatus(device.deviceName);
        if (generation !== getConnectionGeneration()) return false;
        powerState.update(s => ({
            ...s,
            deviceStatuses: {
                ...s.deviceStatuses,
                [device.deviceName]: {
                    ...s.deviceStatuses[device.deviceName],
                    status: currentStatus
                }
            }
        }));
        
        return false;
    }
};

// Export the raw state for settings UI
export const availablePowerDevices = derived(
    powerState,
    ($powerState) => $powerState.devices.map(d => d.device)
);

// Re-initialize power devices (useful for settings changes)
export const refreshPowerDevices = async () => {
    if (get(connectionState) === 'connected') {
        await initializePowerDevices();
    }
};

connectionState.subscribe(async (state) => {
    if (state === 'connected') {
        const generation = getConnectionGeneration();
        await initializePowerDevices();
        if (generation === getConnectionGeneration()) startPolling();
    } else {
        // Cleanup notification listener
        if (cleanupNotification) {
            cleanupNotification();
            cleanupNotification = null;
        }
        // Stop polling
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
        powerState.set({
            devices: [],
            deviceStatuses: {},
            isInitialized: false,
            lastError: null
        });
    }
});
