import { writable, get } from 'svelte/store';
import { send, onNotification, connectionState } from './websocket.js';
import { configStore } from './configStore.js';
import { notificationStore } from './notificationStore.js';

// Initial state
export const machineState = writable({
    status: 'STANDBY',
    isEmergencyStop: false,

    // Coordinates (toolhead)
    position: { x: 0.00, y: 0.00, z: 0.00, e: 0.00 },

    // Temperatures - Dynamic map now
    // format: { [sensorName]: { current: 0, target: 0, label: 'Friendly Name' } }
    temperatures: {},

    // Fans and Output Pins
    // format: { [name]: { type: 'fan'|'pin', value: 0.0, max: 1.0, label: 'Friendly Name' } }
    miscDevices: {},

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
    extrudeAmount: 10,
    extrudeSpeed: 5, // mm/s

    // Z-Offset Baby-Stepping
    zOffset: 0.0,          // Current z-offset (from gcode_move.homing_origin[2])
    zOffsetIncrement: 0.05, // Selected increment for baby-stepping

    // Extruder Tuning
    pressureAdvance: 0.0,
    smoothTime: 0.040,

    // Motion Limits (from toolhead)
    maxVelocity: 0,                // mm/s
    maxAccel: 0,                   // mm/s²
    squareCornerVelocity: 0,       // mm/s
    maxAccelToDecel: null,         // mm/s² (older Klipper)
    minimumCruiseRatio: null,      // ratio 0.0-1.0 (newer Klipper, replaces max_accel_to_decel)

    // Print status
    printFilename: '',
    printProgress: 0,
    printDuration: 0,      // seconds elapsed
    filamentUsed: 0,       // mm of filament used

    // Live motion data (only available during printing)
    liveSpeed: 0,              // mm/s - current toolhead velocity
    liveExtruderVelocity: 0,   // mm/s - current extruder velocity

    // Idle timeout state (for detecting busy during commands)
    idleState: 'Idle',         // Idle, Printing, Ready

    // Raw print stats state (for deriving display status)
    printStatsState: 'standby',
});

const HISTORY_points = 300; // Keep last ~5-10 mins depending on update rate

// Helper actions
export const setJogDistance = (dist) => {
    machineState.update(s => ({ ...s, jogDistance: dist }));
};

export const setExtrudeAmount = (amount) => {
    machineState.update(s => ({ ...s, extrudeAmount: amount }));
};

export const setExtrudeSpeed = (speed) => {
    machineState.update(s => ({ ...s, extrudeSpeed: speed }));
};

export const setZOffsetIncrement = (increment) => {
    machineState.update(s => ({ ...s, zOffsetIncrement: increment }));
};

export const setActiveExtruder = (extruderName) => {
    machineState.update(s => ({ ...s, activeExtruder: extruderName }));
};

export const updatePressureAdvance = (val) => {
    const s = get(machineState);
    const extruder = s.activeExtruder;
    send('printer.gcode.script', { script: `SET_PRESSURE_ADVANCE EXTRUDER=${extruder} ADVANCE=${val.toFixed(4)}` });
};

export const updateSmoothTime = (val) => {
    const s = get(machineState);
    const extruder = s.activeExtruder;
    send('printer.gcode.script', { script: `SET_PRESSURE_ADVANCE EXTRUDER=${extruder} SMOOTH_TIME=${val.toFixed(4)}` });
};

// WebSocket Integration
connectionState.subscribe((state) => {
    if (state === 'connected') {
        initializeConnection();
    }
});

const initializeConnection = async () => {
    try {
        // 0. Check Printer Info for initial system state
        try {
            const info = await send('printer.info');
            if (info && info.state) {
                if (info.state === 'shutdown' || info.state === 'error') {
                    notificationStore.setSystemStatus(info.state);
                } else {
                    notificationStore.setSystemStatus('ready');
                }
            }
        } catch (e) {
            console.warn('Could not get printer info', e);
        }

        // 1. List all objects to find EVERYTHING temperature/fan/pin related
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

        // Find Fans and Pins
        const miscObjects = allObjects.filter(obj =>
            obj === 'fan' || // Primary part fan
            obj.startsWith('fan_generic') ||
            obj.startsWith('output_pin')
        );

        // Found extruders for multi-extruder support
        const foundExtruders = allObjects.filter(obj => obj.startsWith('extruder'));

        // Update state with found objects
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

            const misc = { ...s.miscDevices };
            miscObjects.forEach(obj => {
                const type = obj.startsWith('output_pin') ? 'pin' : 'fan';
                // Heuristic: If it's an output_pin configured as a fan (has 'fan' in name), 
                // it likely uses 0-255 scale (often used for mainboard fans on some configs)
                // Otherwise assume 0-1 for standard pins/LEDs
                const isFanPin = type === 'pin' && obj.toLowerCase().includes('fan');
                const max = isFanPin ? 255.0 : 1.0;

                if (!misc[obj]) {
                    misc[obj] = {
                        type,
                        value: 0.0,
                        max,
                        label: formatSensorName(obj)
                    };
                }
            });

            return {
                ...s,
                temperatures: temps,
                miscDevices: misc,
                availableExtruders: foundExtruders,
                activeExtruder: (s.activeExtruder && foundExtruders.includes(s.activeExtruder))
                    ? s.activeExtruder
                    : foundExtruders[0] || 'extruder'
            };
        });

        // 2. Build subscription map
        const subscriptions = {
            toolhead: ['position', 'status', 'print_time', 'homed_axes', 'max_velocity', 'max_accel', 'square_corner_velocity', 'max_accel_to_decel', 'minimum_cruise_ratio'],
            'gcode_move': ['speed_factor', 'extrude_factor', 'homing_origin'],
            'print_stats': ['state', 'filename', 'total_duration', 'print_duration', 'filament_used'],
            'virtual_sdcard': ['progress', 'file_path'],
            'motion_report': ['live_velocity', 'live_extruder_velocity'],
            'idle_timeout': ['state'],
        };

        // Add all temperature objects to subscription
        tempObjects.forEach(obj => {
            subscriptions[obj] = ['temperature', 'target'];
            // If it's an extruder, also track tuning
            if (obj.startsWith('extruder')) {
                subscriptions[obj].push('pressure_advance', 'smooth_time');
            }
        });

        // Add fans and pins
        miscObjects.forEach(obj => {
            if (obj === 'fan' || obj.startsWith('fan_generic')) {
                subscriptions[obj] = ['speed'];
            } else if (obj.startsWith('output_pin')) {
                subscriptions[obj] = ['value'];
            }
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
    // fan -> PART FAN
    // fan_generic case -> CASE
    // output_pin light -> LIGHT

    if (rawName === 'heater_bed') return 'BED';
    if (rawName === 'fan') return 'PART FAN';

    const parts = rawName.split(' ');
    // If it has a space, use the second part (the name)
    if (parts.length > 1) {
        return parts.slice(1).join(' ').toUpperCase().replace(/_/g, ' ');
    }

    // Otherwise use the first part, stripping prefixes if needed
    let name = parts[0];
    if (name.startsWith('temperature_sensor')) name = name.replace('temperature_sensor_', '');
    if (name.startsWith('heater_generic')) name = name.replace('heater_generic_', '');
    if (name.startsWith('fan_generic')) name = name.replace('fan_generic_', '');
    if (name.startsWith('output_pin')) name = name.replace('output_pin_', '');

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

            // Track motion limits
            if (status.toolhead.max_velocity !== undefined) {
                newState.maxVelocity = status.toolhead.max_velocity;
            }
            if (status.toolhead.max_accel !== undefined) {
                newState.maxAccel = status.toolhead.max_accel;
            }
            if (status.toolhead.square_corner_velocity !== undefined) {
                newState.squareCornerVelocity = status.toolhead.square_corner_velocity;
            }
            // Klipper version detection: minimum_cruise_ratio vs max_accel_to_decel
            if (status.toolhead.minimum_cruise_ratio !== undefined) {
                newState.minimumCruiseRatio = status.toolhead.minimum_cruise_ratio;
                newState.maxAccelToDecel = null; // Clear legacy value
            } else if (status.toolhead.max_accel_to_decel !== undefined) {
                newState.maxAccelToDecel = status.toolhead.max_accel_to_decel;
                newState.minimumCruiseRatio = null; // Clear new value
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

                // Track tuning for active extruder
                if (key === newState.activeExtruder) {
                    if (status[key].pressure_advance !== undefined) {
                        newState.pressureAdvance = status[key].pressure_advance;
                    }
                    if (status[key].smooth_time !== undefined) {
                        newState.smoothTime = status[key].smooth_time;
                    }
                }
            }

            // Check if it's a misc device (fan/pin)
            if (newState.miscDevices[key]) {
                const dev = newState.miscDevices[key];

                // Fan speed
                if (status[key].speed !== undefined) {
                    dev.value = status[key].speed;
                }

                // Pin value
                if (status[key].value !== undefined) {
                    dev.value = status[key].value;
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
            if (status.print_stats.state !== undefined) {
                newState.printStatsState = status.print_stats.state;
            }
            if (status.print_stats.filename !== undefined) {
                newState.printFilename = status.print_stats.filename;
            }
            if (status.print_stats.print_duration !== undefined) {
                newState.printDuration = status.print_stats.print_duration;
            }
            if (status.print_stats.filament_used !== undefined) {
                newState.filamentUsed = status.print_stats.filament_used;
            }
        }

        if (status.idle_timeout) {
            if (status.idle_timeout.state !== undefined) {
                newState.idleState = status.idle_timeout.state;
            }
        }

        // Always derive the display status from the raw states
        // This ensures status updates correctly when either state changes
        const rawStatus = newState.printStatsState.toUpperCase();

        // Determine BUSY state: when idle_timeout is "Printing" but not actually printing a file
        // This happens during homing, probing, manual moves, macros, etc.
        if (rawStatus === 'STANDBY' && newState.idleState === 'Printing') {
            newState.status = 'BUSY';
        } else {
            newState.status = rawStatus;
        }

        if (status.virtual_sdcard) {
            if (status.virtual_sdcard.progress !== undefined) {
                newState.printProgress = status.virtual_sdcard.progress;
            }
            // file_path can also contain filename
            if (status.virtual_sdcard.file_path !== undefined && !newState.printFilename) {
                newState.printFilename = status.virtual_sdcard.file_path;
            }
        }

        if (status.gcode_move) {
            if (status.gcode_move.speed_factor !== undefined) {
                newState.speedFactor = Math.round(status.gcode_move.speed_factor * 100);
            }
            if (status.gcode_move.extrude_factor !== undefined) {
                newState.extrusionFactor = Math.round(status.gcode_move.extrude_factor * 100);
            }
            // Track z-offset from homing_origin (index 2 is Z axis)
            if (status.gcode_move.homing_origin && status.gcode_move.homing_origin.length >= 3) {
                newState.zOffset = status.gcode_move.homing_origin[2];
            }
        }

        if (status.motion_report) {
            if (status.motion_report.live_velocity !== undefined) {
                newState.liveSpeed = status.motion_report.live_velocity;
            }
            if (status.motion_report.live_extruder_velocity !== undefined) {
                newState.liveExtruderVelocity = status.motion_report.live_extruder_velocity;
            }
        }

        // Reset live values to 0 when not printing
        if (newState.status !== 'PRINTING') {
            newState.liveSpeed = 0;
            newState.liveExtruderVelocity = 0;
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

// Filament Management
export const loadFilament = () => {
    const s = get(machineState);
    const config = get(configStore).filament;

    const amount = s.extrudeAmount;
    const speed = s.extrudeSpeed * 60; // mm/s to mm/min

    const macro = config.loadMacro || 'LOAD_FILAMENT';
    const distParam = config.distanceParam || 'DISTANCE';
    const speedParam = config.speedParam || 'SPEED';

    const gcode = `${macro} ${distParam}=${amount} ${speedParam}=${speed}`;
    send('printer.gcode.script', { script: gcode });
};

export const unloadFilament = () => {
    const s = get(machineState);
    const config = get(configStore).filament;

    const amount = s.extrudeAmount;
    const speed = s.extrudeSpeed * 60; // mm/s to mm/min

    const macro = config.unloadMacro || 'UNLOAD_FILAMENT';
    const distParam = config.distanceParam || 'DISTANCE';
    const speedParam = config.speedParam || 'SPEED';

    const gcode = `${macro} ${distParam}=${amount} ${speedParam}=${speed}`;
    send('printer.gcode.script', { script: gcode });
};
// Commands
export const jog = (axis, direction) => {
    const s = get(machineState);
    const dist = s.jogDistance;
    const feedrate = 3000; // mm/min

    // Simpler Relative Move
    const gcode = `G91\nG1 ${axis.toUpperCase()}${direction * dist} F${feedrate}\nG90`;
    send('printer.gcode.script', { script: gcode });
};

export const adjustZOffset = (direction) => {
    const s = get(machineState);
    const increment = s.zOffsetIncrement;
    const adjustment = direction * increment;
    
    // Use SET_GCODE_OFFSET with Z_ADJUST to incrementally adjust z-offset
    const gcode = `SET_GCODE_OFFSET Z_ADJUST=${adjustment.toFixed(3)} MOVE=1`;
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

export const extrude = (direction = 1) => {
    const s = get(machineState);
    const amount = s.extrudeAmount;
    const speed = s.extrudeSpeed * 60; // mm/s to mm/min

    const gcode = `M83\nG1 E${direction * amount} F${speed}\nM82`;
    send('printer.gcode.script', { script: gcode });
};

// Print Control
export const pausePrint = (macroName = 'PAUSE') => {
    send('printer.gcode.script', { script: macroName });
};

export const resumePrint = (macroName = 'RESUME') => {
    send('printer.gcode.script', { script: macroName });
};

export const cancelPrint = (macroName = 'CANCEL_PRINT') => {
    send('printer.gcode.script', { script: macroName });
};

// Motion Limits Control
export const setVelocityLimit = (params) => {
    // params can include: VELOCITY, ACCEL, SQUARE_CORNER_VELOCITY, MINIMUM_CRUISE_RATIO, or ACCEL_TO_DECEL
    const parts = [];

    if (params.velocity !== undefined && params.velocity !== null) {
        parts.push(`VELOCITY=${params.velocity}`);
    }
    if (params.accel !== undefined && params.accel !== null) {
        parts.push(`ACCEL=${params.accel}`);
    }
    if (params.squareCornerVelocity !== undefined && params.squareCornerVelocity !== null) {
        parts.push(`SQUARE_CORNER_VELOCITY=${params.squareCornerVelocity}`);
    }
    if (params.minimumCruiseRatio !== undefined && params.minimumCruiseRatio !== null) {
        parts.push(`MINIMUM_CRUISE_RATIO=${params.minimumCruiseRatio}`);
    }
    if (params.accelToDecel !== undefined && params.accelToDecel !== null) {
        parts.push(`ACCEL_TO_DECEL=${params.accelToDecel}`);
    }

    if (parts.length > 0) {
        const gcode = `SET_VELOCITY_LIMIT ${parts.join(' ')}`;
        send('printer.gcode.script', { script: gcode });
    }
};
