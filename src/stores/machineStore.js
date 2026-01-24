import { writable, get } from 'svelte/store';
import { send, onNotification, connectionState } from './websocket.js';

// Initial state
export const machineState = writable({
    status: 'STANDBY',
    isEmergencyStop: false,

    // Coordinates (toolhead)
    position: { x: 0.00, y: 0.00, z: 0.00, e: 0.00 },

    // Temperatures - Dynamic map now
    // format: { [sensorName]: { current: 0, target: 0, label: 'Friendly Name' } }
    temperatures: {},

    // History for graphing
    // format: [ { timestamp: 12345, sensors: { [name]: temp } } ]
    tempHistory: [],

    // Multi-Extruder Support
    availableExtruders: [], // Populated on connect
    activeExtruder: 'extruder',

    // Factors
    speedFactor: 100, // %
    extrusionFactor: 100, // %

    // Selected options
    jogDistance: 10,
});

const HISTORY_points = 300; // Keep last ~5-10 mins depending on update rate

// Helper actions
export const setJogDistance = (dist) => {
    machineState.update(s => ({ ...s, jogDistance: dist }));
};

export const setActiveExtruder = (extruderName) => {
    machineState.update(s => ({ ...s, activeExtruder: extruderName }));
};

// WebSocket Integration
connectionState.subscribe((state) => {
    if (state === 'connected') {
        initializeConnection();
    }
});

const initializeConnection = async () => {
    try {
        // 1. List all objects to find EVERYTHING temperature related
        const listResponse = await send('printer.objects.list');
        const allObjects = listResponse.objects;

        // Find all interesting temperature objects
        const tempObjects = allObjects.filter(obj =>
            obj.startsWith('extruder') ||
            obj.startsWith('heater_bed') ||
            obj.startsWith('temperature_sensor') ||
            obj.startsWith('temperature_fan') ||
            obj.startsWith('heater_generic')
        );

        // Found extruders for multi-extruder support
        const foundExtruders = allObjects.filter(obj => obj.startsWith('extruder'));

        // Update state with found sensors
        machineState.update(s => {
            const temps = { ...s.temperatures };
            tempObjects.forEach(obj => {
                if (!temps[obj]) {
                    temps[obj] = {
                        current: 0,
                        target: 0,
                        // Create a nicer label
                        label: formatSensorName(obj)
                    };
                }
            });
            return {
                ...s,
                temperatures: temps,
                availableExtruders: foundExtruders,
                activeExtruder: (s.activeExtruder && foundExtruders.includes(s.activeExtruder))
                    ? s.activeExtruder
                    : foundExtruders[0] || 'extruder'
            };
        });

        // 2. Build subscription map
        const subscriptions = {
            toolhead: ['position', 'status', 'print_time', 'homed_axes'],
            'gcode_move': ['speed_factor', 'extrude_factor'],
            'print_stats': ['state'],
        };

        // Add all temperature objects to subscription
        tempObjects.forEach(obj => {
            subscriptions[obj] = ['temperature', 'target'];
        });

        // 3. Subscribe
        await send('printer.objects.subscribe', { objects: subscriptions });

        // 4. Initial Query
        const initialQuery = {};
        Object.keys(subscriptions).forEach(key => initialQuery[key] = null);

        const status = await send('printer.objects.query', { objects: initialQuery });
        updateStateFromStatus(status.status);

    } catch (e) {
        console.error('Failed to initialize printer connection:', e);
    }
};

const formatSensorName = (rawName) => {
    // extruder -> EXTRUDER
    // heater_bed -> BED
    // temperature_sensor mcu_temp -> MCU TEMP
    // temperature_fan pi_fan -> PI FAN

    if (rawName === 'heater_bed') return 'BED';

    const parts = rawName.split(' ');
    // If it has a space, use the second part (the name)
    if (parts.length > 1) {
        return parts.slice(1).join(' ').toUpperCase().replace(/_/g, ' ');
    }

    // Otherwise use the first part, stripping prefixes if needed
    let name = parts[0];
    if (name.startsWith('temperature_sensor')) name = name.replace('temperature_sensor_', '');
    if (name.startsWith('heater_generic')) name = name.replace('heater_generic_', '');

    return name.toUpperCase().replace(/_/g, ' ');
};

const updateStateFromStatus = (status) => {
    machineState.update(s => {
        const newState = { ...s };

        if (status.toolhead) {
            const pos = status.toolhead.position;
            if (pos && pos.length >= 4) {
                newState.position = {
                    x: pos[0],
                    y: pos[1],
                    z: pos[2],
                    e: pos[3]
                };
            }
        }

        // --- DYNAMIC SENSOR UPDATES ---
        let hasTempUpdate = false;
        const currentReadings = {};

        Object.keys(status).forEach(key => {
            // Check if this key corresponds to one of our tracked sensors
            if (newState.temperatures[key]) {
                const sensor = newState.temperatures[key];

                if (status[key].temperature !== undefined) {
                    sensor.current = status[key].temperature;
                    currentReadings[key] = status[key].temperature;
                    hasTempUpdate = true;
                }
                if (status[key].target !== undefined) {
                    sensor.target = status[key].target;
                }
            }
        });

        // Update History Buffer
        if (hasTempUpdate) {
            const now = Date.now();

            // If we have history, get the last set of readings to fill in gaps
            const lastEntry = newState.tempHistory.length > 0
                ? newState.tempHistory[newState.tempHistory.length - 1].sensors
                : {};

            // Combine last readings with new updates so graph lines don't drop to 0
            const mergedSensors = { ...lastEntry };

            // Update with any new readings from this batch
            Object.keys(currentReadings).forEach(k => {
                mergedSensors[k] = currentReadings[k];
            });

            // Also for any sensor that didn't report, assume it holds steady for this tick 
            // OR simpler: just only graph what we have. 
            // Better: update known current values from state
            Object.keys(newState.temperatures).forEach(k => {
                if (newState.temperatures[k].current !== undefined) {
                    mergedSensors[k] = newState.temperatures[k].current;
                }
            });

            newState.tempHistory = [
                ...newState.tempHistory,
                { timestamp: now, sensors: mergedSensors }
            ];

            // Limit buffer size
            if (newState.tempHistory.length > HISTORY_points) {
                newState.tempHistory = newState.tempHistory.slice(-HISTORY_points);
            }
        }
        // -----------------------------


        if (status.print_stats) {
            newState.status = status.print_stats.state.toUpperCase();
        }

        if (status.gcode_move) {
            newState.speedFactor = Math.round(status.gcode_move.speed_factor * 100);
            newState.extrusionFactor = Math.round(status.gcode_move.extrude_factor * 100);
        }

        return newState;
    });
};

// Listen for updates
onNotification((method, params) => {
    if (method === 'notify_status_update') {
        const status = params[0]; // params is an array like [ { ...data }, timestamp ]
        updateStateFromStatus(status);
    } else if (method === 'notify_gcode_response') {
        // console.log('GCODE:', params[0]);
    }
});


// Commands
export const jog = (axis, direction) => {
    const s = get(machineState);
    const dist = s.jogDistance;
    const feedrate = 3000; // mm/min

    // Simpler Relative Move
    const gcode = `G91\nG1 ${axis.toUpperCase()}${direction * dist} F${feedrate}\nG90`;
    send('printer.gcode.script', { script: gcode });
};

export const emergencyStop = () => {
    send('printer.emergency_stop');
};

export const home = async () => send('printer.gcode.script', { script: "G28" });
export const homeX = async () => send('printer.gcode.script', { script: "G28 X" });
export const homeY = async () => send('printer.gcode.script', { script: "G28 Y" });
export const homeZ = async () => send('printer.gcode.script', { script: "G28 Z" });
export const motorsOff = async () => send('printer.gcode.script', { script: "M84" });
