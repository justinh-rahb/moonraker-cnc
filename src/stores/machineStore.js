import { afcObjectNames, mergeAfcStatus } from '../lib/afc.js';
import { absoluteMoveScript } from '../lib/motion.js';
import { writable, get } from 'svelte/store';
import { send, onNotification, connectionState, getConnectionGeneration } from './websocket.js';
import { configStore } from './configStore.js';
import { notificationStore } from './notificationStore.js';

// Debug logging (only in dev mode)
const DEBUG = import.meta.env?.DEV;

// Increment choices belong to the selected host, alongside other printer preferences.
const loadIncrements = () => get(configStore).increments || {};
const saveIncrements = increments => configStore.update(c => ({ ...c, increments }));
const savedIncrements = loadIncrements();

// Initial state
const INITIAL_STATE = {
    isReady: false,
    klippyState: 'unknown',
    stateMessage: '',
    homedAxes: '',
    stepperStates: null,
    axisMinimum: null,
    axisMaximum: null,
    configured: {},
    availableMacros: [],
    afcObjects: {},
    availableCommands: {},
    slicerCurrentLayer: null,
    slicerTotalLayers: null,
    estimatedTime: null,
    totalDuration: 0,
    statusUpdatedAt: 0,
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
    monitorDevices: {},

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
    jogDistance: savedIncrements?.jogDistance ?? 10,
    extrudeAmount: savedIncrements?.extrudeAmount ?? 10,
    extrudeSpeed: savedIncrements?.extrudeSpeed ?? 5, // mm/s

    // Z-Offset Baby-Stepping
    zOffset: 0.0,          // Current z-offset (from gcode_move.homing_origin[2])
    zOffsetIncrement: savedIncrements?.zOffsetIncrement ?? 0.05, // Selected increment for baby-stepping

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
    lastCompletedFilename: '', // Stores filename when print completes for reprint functionality

    // Live motion data (only available during printing)
    liveSpeed: 0,              // mm/s - current toolhead velocity
    liveExtruderVelocity: 0,   // mm/s - current extruder velocity

    // Layer progress (only available during printing)
    currentLayer: 0,
    totalLayers: 0,

    // Layer metadata for calculation (extracted from file metadata)
    layerHeight: null,
    firstLayerHeight: null,
    objectHeight: null,

    // Idle timeout state (for detecting busy during commands)
    idleState: 'Idle',         // Idle, Printing, Ready

    // Raw print stats state (for deriving display status)
    printStatsState: 'standby',
    virtualSdActive: null,
    isPaused: null,
};
export const machineState = writable(structuredClone(INITIAL_STATE));

const HISTORY_points = 300; // Keep last ~5-10 mins depending on update rate

// Helper actions
export const setJogDistance = (dist) => {
    machineState.update(s => {
        const newState = { ...s, jogDistance: dist };
        saveIncrements({
            jogDistance: newState.jogDistance,
            extrudeAmount: newState.extrudeAmount,
            extrudeSpeed: newState.extrudeSpeed,
            zOffsetIncrement: newState.zOffsetIncrement
        });
        return newState;
    });
};

export const setExtrudeAmount = (amount) => {
    machineState.update(s => {
        const newState = { ...s, extrudeAmount: amount };
        saveIncrements({
            jogDistance: newState.jogDistance,
            extrudeAmount: newState.extrudeAmount,
            extrudeSpeed: newState.extrudeSpeed,
            zOffsetIncrement: newState.zOffsetIncrement
        });
        return newState;
    });
};

export const setExtrudeSpeed = (speed) => {
    machineState.update(s => {
        const newState = { ...s, extrudeSpeed: speed };
        saveIncrements({
            jogDistance: newState.jogDistance,
            extrudeAmount: newState.extrudeAmount,
            extrudeSpeed: newState.extrudeSpeed,
            zOffsetIncrement: newState.zOffsetIncrement
        });
        return newState;
    });
};

export const setZOffsetIncrement = (increment) => {
    machineState.update(s => {
        const newState = { ...s, zOffsetIncrement: increment };
        saveIncrements({
            jogDistance: newState.jogDistance,
            extrudeAmount: newState.extrudeAmount,
            extrudeSpeed: newState.extrudeSpeed,
            zOffsetIncrement: newState.zOffsetIncrement
        });
        return newState;
    });
};

export const setActiveExtruder = (extruderName) => {
    const s = get(machineState);
    if (!s.isReady || !s.availableExtruders.includes(extruderName)) return;
    return send('printer.gcode.script', { script: `ACTIVATE_EXTRUDER EXTRUDER=${extruderName}` });
};

// Speed and Extrusion Factor Control
export const setSpeedFactor = (percent) => {
    // Clamp value between 1 and 200
    const value = Math.max(1, Math.min(200, Math.round(percent)));
    send('printer.gcode.script', { script: `M220 S${value}` });
};

export const setExtrusionFactor = (percent) => {
    // Clamp value between 1 and 200
    const value = Math.max(1, Math.min(200, Math.round(percent)));
    send('printer.gcode.script', { script: `M221 S${value}` });
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

let initializationRevision = 0;
export const initializeConnection = async () => {
    const revision = ++initializationRevision;
    const generation = getConnectionGeneration();
    const query = async (...args) => {
        if (generation !== getConnectionGeneration() || revision !== initializationRevision) throw new Error('Connection changed');
        const result = await send(...args);
        if (generation !== getConnectionGeneration() || revision !== initializationRevision) throw new Error('Connection changed');
        return result;
    };
    try {
        machineState.update(s => ({ ...s, isReady:false, status:'SYNCHRONIZING' }));
        // printer.info is available even when normal Klipper object APIs are not.
        let info;
        try { info = await query('printer.info',{}, {silent:true}); }
        catch(error) {
            const server = await query('server.info',{}, {silent:true});
            const state = server.klippy_state || (server.klippy_connected === false ? 'disconnected' : null);
            if (!['error','shutdown','disconnected','startup'].includes(state)) throw error;
            info = {state,state_message:error.message || 'Klipper is unavailable'};
        }
        if (!info?.state) throw new Error('Klipper did not report its state');
        machineState.update(s => ({...s,klippyState:info.state,stateMessage:info.state_message || '',status:info.state === 'ready' ? 'SYNCHRONIZING' : info.state.toUpperCase()}));
        notificationStore.setSystemStatus(info.state);
        if (info.state !== 'ready') {
            machineState.update(s => ({...s,afcObjects:{},availableCommands:{}}));
            return;
        }

        // 1. List all objects to find EVERYTHING temperature/fan/pin related
        const listResponse = await query('printer.objects.list');
        const allObjects = listResponse.objects;
        const configResult = await query('printer.objects.query', { objects: { configfile: ['settings'] } });
        const configured = configResult.status?.configfile?.settings || {};
        machineState.update(s => ({ ...s, configured, availableMacros: Object.keys(configured).filter(k => k.startsWith('gcode_macro ') && !k.slice(12).startsWith('_')).map(k => k.slice(12)).sort() }));

        // Find all interesting temperature objects
        const tempObjects = allObjects.filter(obj =>
            /^extruder\d*$/.test(obj) ||
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

        const monitorObjects = allObjects.filter(obj => obj.startsWith('heater_fan ') || obj.startsWith('controller_fan ') || obj.startsWith('filament_switch_sensor ') || obj.startsWith('filament_motion_sensor '));
        machineState.update(s => ({...s,monitorDevices:Object.fromEntries(monitorObjects.map(name => [name,{label:formatSensorName(name),type:name.startsWith('filament_') ? 'filament' : 'fan',value:null,enabled:false}]))}));

        // Found extruders for multi-extruder support
        const foundExtruders = allObjects.filter(obj => /^extruder\d*$/.test(obj));

        // Update state with found objects
        machineState.update(s => {
            const temps = {};
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

            const misc = {};
            miscObjects.forEach(obj => {
                const type = obj.startsWith('output_pin') ? 'pin' : 'fan';
                // Klipper scale and pwm settings define the device controls.
                const max = Number(configured[obj]?.scale) || 1;
                const pwm = type !== 'pin' || !!configured[obj]?.pwm;

                if (!misc[obj]) {
                    misc[obj] = {
                        type,
                        value: 0.0,
                        max,
                        pwm,
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

        const afcObjects = Object.fromEntries(afcObjectNames(allObjects).map(name => [name, {}]));
        machineState.update(s => ({...s, afcObjects}));

        // 2. Build subscription map
        const subscriptions = {
            toolhead: ['position', 'extruder', 'status', 'print_time', 'homed_axes', 'max_velocity', 'max_accel', 'square_corner_velocity', 'max_accel_to_decel', 'minimum_cruise_ratio', 'axis_minimum', 'axis_maximum'],
            stepper_enable: ['steppers'],
            'gcode_move': ['speed_factor', 'extrude_factor', 'homing_origin'],
            webhooks: ['state', 'state_message'],
            'print_stats': ['state', 'message', 'filename', 'total_duration', 'print_duration', 'filament_used', 'info'],
            'virtual_sdcard': ['progress', 'file_path'],
            'motion_report': ['live_velocity', 'live_extruder_velocity'],
            'idle_timeout': ['state'],
            'display_status': ['message', 'progress'],
        };

        // Add all temperature objects to subscription
        tempObjects.forEach(obj => {
            subscriptions[obj] = ['temperature', 'target'];
            // If it's an extruder, also track tuning
            if (/^extruder\d*$/.test(obj)) {
                subscriptions[obj].push('pressure_advance', 'smooth_time');
            }
        });

        // Add fans and pins
        miscObjects.forEach(obj => {
            if (obj === 'fan' || obj.startsWith('fan_generic')) {
                subscriptions[obj] = ['speed','rpm'];
            } else if (obj.startsWith('output_pin')) {
                subscriptions[obj] = ['value'];
            }
        });

        Object.keys(afcObjects).forEach(name => subscriptions[name] = null);
        if (Object.keys(afcObjects).length) subscriptions.gcode = ['commands'];
        subscriptions.pause_resume = ['is_paused'];
        subscriptions.virtual_sdcard.push('is_active');

        monitorObjects.forEach(obj => subscriptions[obj] = obj.startsWith('filament_') ? ['enabled','filament_detected'] : ['speed','rpm']);
        Object.keys(subscriptions).forEach(key => { if (!allObjects.includes(key)) delete subscriptions[key]; });

        // 3. Subscribe
        await query('printer.objects.subscribe', { objects: subscriptions });

        // 4. Initial Query
        const initialQuery = {};
        Object.keys(subscriptions).forEach(key => initialQuery[key] = null);

        const status = await query('printer.objects.query', { objects: initialQuery });
        updateStateFromStatus(status.status);
        machineState.update(s => ({ ...s, isReady: status.status.webhooks?.state === 'ready' }));


    } catch (e) {
        if (generation === getConnectionGeneration() && revision === initializationRevision) {
            machineState.update(s => ({...s,isReady:false,status:'UNAVAILABLE',stateMessage:e.message || 'Unable to synchronize Klipper state'}));
            console.error('Failed to initialize printer connection:', e);
        }
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

    name = name.replace(/^(heater_fan|controller_fan|filament_switch_sensor|filament_motion_sensor)_/, '');
    return name.toUpperCase().replace(/_/g, ' ');
};

// Calculate current layer from Z position and layer metadata (matching Mainsail's method)
const calculateCurrentLayer = (currentZ, layerHeight, firstLayerHeight) => {
    if (!currentZ || !layerHeight) return null;

    // Use layer height as default for first layer if not specified
    const firstLayer = firstLayerHeight || layerHeight;

    // Match Mainsail's calculation exactly (1-indexed, not 0-indexed)
    const calculatedLayer = Math.round((currentZ - firstLayer) / layerHeight) + 1;

    // Clamp to minimum of 1 (first layer)
    return Math.max(1, calculatedLayer);
};

export const updateStateFromStatus = (status) => {
    machineState.update(s => {
        const newState = { ...s, temperatures: structuredClone(s.temperatures), miscDevices: structuredClone(s.miscDevices), monitorDevices:structuredClone(s.monitorDevices) };
        if (status.virtual_sdcard?.is_active !== undefined) newState.virtualSdActive = status.virtual_sdcard.is_active;
        if (status.pause_resume?.is_paused !== undefined) newState.isPaused = status.pause_resume.is_paused;
        newState.afcObjects = mergeAfcStatus(s.afcObjects, status);
        if (status.gcode?.commands) newState.availableCommands = status.gcode.commands;
        if (status.webhooks?.state_message !== undefined) newState.stateMessage = status.webhooks.state_message;
        if (status.webhooks?.state !== undefined) {
            newState.isReady = status.webhooks.state === 'ready';
            newState.klippyState = status.webhooks.state;
            if (!newState.isReady) notificationStore.setSystemStatus(status.webhooks.state === 'shutdown' ? 'shutdown' : 'error');
        }

        if (status.stepper_enable?.steppers) newState.stepperStates = {...newState.stepperStates, ...status.stepper_enable.steppers};
        if (status.toolhead) {
            if (status.toolhead.axis_minimum) newState.axisMinimum = status.toolhead.axis_minimum;
            if (status.toolhead.axis_maximum) newState.axisMaximum = status.toolhead.axis_maximum;
            if (status.toolhead.homed_axes !== undefined) newState.homedAxes = status.toolhead.homed_axes;
            if (status.toolhead.extruder) newState.activeExtruder = status.toolhead.extruder;
            const pos = status.toolhead.position;
            if (pos && pos.length >= 4) {
                newState.position = {
                    x: pos[0],
                    y: pos[1],
                    z: pos[2],
                    e: pos[3]
                };

                // Store Z position for later fallback layer calculation
                newState._currentZ = pos[2];
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

                if (status[key].pressure_advance !== undefined) sensor.pressureAdvance = status[key].pressure_advance;
                if (status[key].smooth_time !== undefined) sensor.smoothTime = status[key].smooth_time;
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

            if (newState.monitorDevices[key]) {
                const monitor = newState.monitorDevices[key], data = status[key];
                if (data.filament_detected !== undefined) monitor.value = data.filament_detected;
                if (data.enabled !== undefined) monitor.enabled = data.enabled;
                if (data.speed !== undefined) monitor.value = data.speed;
                if (data.rpm !== undefined) monitor.rpm = data.rpm;
            }
            // Check if it's a misc device (fan/pin)
            if (newState.miscDevices[key]) {
                const dev = newState.miscDevices[key];

                if (status[key].rpm !== undefined) dev.rpm = status[key].rpm;
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

        const selectedExtruder = newState.temperatures[newState.activeExtruder];
        if (selectedExtruder?.pressureAdvance !== undefined) newState.pressureAdvance = selectedExtruder.pressureAdvance;
        if (selectedExtruder?.smoothTime !== undefined) newState.smoothTime = selectedExtruder.smoothTime;

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
            if (DEBUG) console.log('[DEBUG] print_stats received:', JSON.stringify(status.print_stats));
            if (status.print_stats.message !== undefined && status.print_stats.state === 'error') newState.stateMessage = status.print_stats.message;
            const previousFilename = newState.printFilename;
            const previousState = newState.printStatsState;
            if (status.print_stats.filename !== undefined) newState.printFilename = status.print_stats.filename;
            if (status.print_stats.state !== undefined) newState.printStatsState = status.print_stats.state;
            if (newState.printFilename !== previousFilename || (newState.printStatsState === 'printing' && !['printing','paused'].includes(previousState))) {
                newState.estimatedTime = null;
                newState.printProgress = newState.printDuration = newState.totalDuration = newState.filamentUsed = 0;
                newState.slicerCurrentLayer = newState.slicerTotalLayers = null;
                newState.currentLayer = newState.totalLayers = 0;
                newState.layerHeight = newState.firstLayerHeight = newState.objectHeight = null;
                if (newState.printFilename && ['printing','paused'].includes(newState.printStatsState)) queueMicrotask(() => fetchFileMetadata(newState.printFilename));
            }
            if (status.print_stats.total_duration !== undefined) newState.totalDuration = status.print_stats.total_duration;
            newState.statusUpdatedAt = Date.now();
            if (status.print_stats.print_duration !== undefined) {
                newState.printDuration = status.print_stats.print_duration;
            }
            if (status.print_stats.filament_used !== undefined) {
                newState.filamentUsed = status.print_stats.filament_used;
            }

            // Prefer slicer-provided layer info from print_stats.info (via SET_PRINT_STATS_INFO)
            // Fall back to Z position calculation if not available
            if (status.print_stats.info) {
                if (DEBUG) console.log('[DEBUG] print_stats.info found:', JSON.stringify(status.print_stats.info));
                if (status.print_stats.info.current_layer !== undefined) {
                    newState.slicerCurrentLayer = status.print_stats.info.current_layer || null;
                    newState.currentLayer = newState.slicerCurrentLayer || 0;
                    if (DEBUG) console.log('[DEBUG] Using slicer-provided current_layer:', newState.currentLayer);
                }
                if (status.print_stats.info.total_layer !== undefined) {
                    newState.slicerTotalLayers = status.print_stats.info.total_layer || null;
                    newState.totalLayers = newState.slicerTotalLayers || newState.totalLayers;
                    if (DEBUG) console.log('[DEBUG] Using slicer-provided total_layer:', newState.totalLayers);
                }
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
        const oldStatus = newState.status; // Track old status for transition detection

        // Determine BUSY state: when idle_timeout is "Printing" but not actually printing a file
        // This happens during homing, probing, manual moves, macros, etc.
        if (rawStatus === 'STANDBY' && newState.idleState === 'Printing') {
            newState.status = 'BUSY';
        } else {
            newState.status = rawStatus;
        }

        if (!newState.isReady) newState.status = 'UNAVAILABLE';

        // Store the filename when a print completes or is cancelled for reprint functionality
        if ((rawStatus === 'COMPLETE' || rawStatus === 'CANCELLED') && newState.printFilename) {
            newState.lastCompletedFilename = newState.printFilename;
        }

        if (status.virtual_sdcard) {
            if (DEBUG) console.log('[DEBUG] virtual_sdcard received:', JSON.stringify(status.virtual_sdcard));
            if (status.virtual_sdcard.progress !== undefined) {
                newState.printProgress = status.virtual_sdcard.progress;
            }
            // file_path can also contain filename
            if (status.virtual_sdcard.file_path !== undefined && !newState.printFilename) {
                newState.printFilename = status.virtual_sdcard.file_path;
            }
        }

        if (status.display_status?.progress != null) newState.printProgress = Math.max(0, Math.min(1,status.display_status.progress));

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

        // Layer information prioritizes slicer data, falls back to Z position calculation

        // Reset live speed/flow when not printing
        // Only reset layers when transitioning OUT of printing state
        if (newState.status !== 'PRINTING') {
            newState.liveSpeed = 0;
            newState.liveExtruderVelocity = 0;

            // Only reset layers if we just stopped printing (state transition)
            if (oldStatus === 'PRINTING' && (newState.status === 'COMPLETE' || newState.status === 'CANCELLED' || newState.status === 'STANDBY')) {
                newState.currentLayer = 0;
                newState.totalLayers = 0;
                newState.layerHeight = null;
                newState.firstLayerHeight = null;
                newState.objectHeight = null;
                if (DEBUG) console.log('[DEBUG] Print ended, resetting layers and metadata');
            }
        } else if (newState.status === 'PRINTING') {
            // Fallback: Calculate current layer from Z position if slicer didn't provide it
            // Only calculate if we don't already have a current layer from slicer
            const hasSlicerLayer = newState.slicerCurrentLayer !== null;
            if (!hasSlicerLayer && newState._currentZ && newState.layerHeight) {
                const calculatedLayer = calculateCurrentLayer(
                    newState._currentZ,
                    newState.layerHeight,
                    newState.firstLayerHeight
                );
                if (calculatedLayer !== null) {
                    newState.currentLayer = newState.totalLayers ? Math.min(calculatedLayer, newState.totalLayers) : calculatedLayer;
                    if (DEBUG) console.log('[DEBUG] Calculated current layer from Z (fallback):', calculatedLayer, 'at Z:', newState._currentZ.toFixed(2));
                }
            }
        }

        // Clean up temporary Z tracking variable
        delete newState._currentZ;

        if (DEBUG && (newState.currentLayer > 0 || newState.totalLayers > 0)) {
            console.log('[DEBUG] Layer state at end of update:', newState.currentLayer, '/', newState.totalLayers, 'Status:', newState.status);
        }

        return newState;
    });
};

// Listen for updates
onNotification((method, params) => {
    if (method === 'notify_status_update') {
        const status = params[0]; // params is an array like [ { ...data }, timestamp ]
        updateStateFromStatus(status);
    } else if (method === 'notify_klippy_ready') {
        initializeConnection();
    } else if (method === 'notify_klippy_shutdown' || method === 'notify_klippy_disconnected') {
        machineState.update(s => ({ ...s, isReady: false, klippyState:method === 'notify_klippy_shutdown' ? 'shutdown' : 'disconnected', stateMessage:'', status: 'UNAVAILABLE', afcObjects:{}, availableCommands:{} }));
        initializeConnection();
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

// Fetch file metadata to get layer information
const fetchFileMetadata = async (filename) => {
    const generation = getConnectionGeneration();
    try {
        if (DEBUG) console.log('[DEBUG] Fetching metadata for file:', filename);
        const response = await send('server.files.metadata', { filename });
        if (DEBUG) console.log('[DEBUG] File metadata received:', JSON.stringify(response));

        if (response && generation === getConnectionGeneration() && get(machineState).printFilename === filename) {
            // Extract layer calculation parameters
            let layerHeight = response.layer_height;
            let firstLayerHeight = response.first_layer_height;
            const objectHeight = response.object_height;

            // If first layer height not available, use layer height as default
            if (!firstLayerHeight && layerHeight) {
                firstLayerHeight = layerHeight;
            }

            // Calculate total layers if we have the necessary data
            let totalLayers = null;
            if (objectHeight && layerHeight && firstLayerHeight) {
                totalLayers = Math.round((objectHeight - firstLayerHeight) / layerHeight) + 1;
                if (DEBUG) console.log('[DEBUG] Calculated total layers:', totalLayers, 'from object_height:', objectHeight, 'layer_height:', layerHeight, 'first_layer_height:', firstLayerHeight);
            }

            // Fallback to layer_count if calculation not possible
            if (!totalLayers && response.layer_count) {
                totalLayers = response.layer_count;
                if (DEBUG) console.log('[DEBUG] Using layer_count from metadata:', totalLayers);
            }

            machineState.update(s => ({
                ...s,
                layerHeight,
                firstLayerHeight,
                objectHeight,
                estimatedTime: response.estimated_time || null,
                totalLayers: s.slicerTotalLayers || totalLayers || s.totalLayers,
                currentLayer: s.currentLayer // Reset to 0 when starting new print
            }));

            if (DEBUG) console.log('[DEBUG] Layer metadata stored - layerHeight:', layerHeight, 'firstLayerHeight:', firstLayerHeight, 'objectHeight:', objectHeight, 'totalLayers:', totalLayers);
        }
    } catch (e) {
        if (DEBUG) console.warn('[DEBUG] Could not fetch file metadata:', e);
    }
};

// Commands
export const jog = (axis, direction) => {
    const s = get(machineState);
    if (!s.isReady || ['printing','paused'].includes(s.printStatsState) || !s.homedAxes.includes(axis.toLowerCase())) { notificationStore.addError('Home this axis before jogging; manual jogging is disabled during a job.'); return; }
    const dist = s.jogDistance;
    const limits = s.configured.printer || {};
    const feedrate = Math.min(axis.toLowerCase() === 'z' ? (limits.max_z_velocity || 10) : (limits.max_velocity || 50), axis.toLowerCase() === 'z' ? 10 : 50) * 60;

    // Simpler Relative Move
    const gcode = `SAVE_GCODE_STATE NAME=retro_jog\nG91\nG1 ${axis.toUpperCase()}${direction * dist} F${feedrate}\nRESTORE_GCODE_STATE NAME=retro_jog`;
    send('printer.gcode.script', { script: gcode });
};

let absoluteMovePending = false;
export const moveAbsolute = async (axis, target) => {
    const generation = getConnectionGeneration();
    const state = get(machineState);
    if (absoluteMovePending) return false;
    if (!state.isReady || ['printing','paused'].includes(state.printStatsState)) { notificationStore.addError('Manual moves require an idle, ready printer'); return false; }
    if (typeof target !== 'number' || !Number.isFinite(target) || !/^[xyz]$/i.test(axis)) { notificationStore.addError('Enter a valid position'); return false; }
    absoluteMovePending = true;
    try {
        const result = await send('printer.objects.query', {objects:{
            toolhead:['homed_axes','axis_minimum','axis_maximum','max_velocity'],
            gcode_move:['position','gcode_position','speed_factor'],
            webhooks:['state'], print_stats:['state'], virtual_sdcard:['is_active'], pause_resume:['is_paused']
        }}, {silent:true});
        const current = get(machineState);
        if (generation !== getConnectionGeneration() || !current.isReady || ['printing','paused'].includes(current.printStatsState)) throw new Error('Printer state changed; move cancelled');
        const script = absoluteMoveScript(result.status || {},axis,target,current.configured);
        await send('printer.gcode.script',{script},{silent:true});
        return true;
    } catch (error) {
        if (generation === getConnectionGeneration()) notificationStore.addError(error.message || 'Move failed');
        return false;
    } finally { absoluteMovePending = false; }
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
    if (!s.isReady || ['printing','paused'].includes(s.printStatsState) || (s.temperatures[s.activeExtruder]?.current || 0) < (s.configured[s.activeExtruder]?.min_extrude_temp ?? 170)) { notificationStore.addError('Heat the active extruder before manual extrusion, and finish the current job first.'); return; }
    const amount = s.extrudeAmount;
    const speed = s.extrudeSpeed * 60;
    if (amount > (s.configured[s.activeExtruder]?.max_extrude_only_distance ?? 50)) { notificationStore.addError('Extrusion amount exceeds the configured extrusion-only distance limit.'); return; }
    const gcode = `SAVE_GCODE_STATE NAME=retro_extrude\nM83\nG1 E${direction * amount} F${speed}\nRESTORE_GCODE_STATE NAME=retro_extrude`;
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

// Start a print job
export const startPrint = async (filename) => {
    return send('printer.print.start', { filename });
};

// Clear the completed print status (resets to standby)
export const clearPrintStatus = () => {
    send('printer.gcode.script', { script: 'SDCARD_RESET_FILE' });
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

// WebSocket Integration
connectionState.subscribe((state) => {
    if (state === 'connected') {
        initializeConnection();
    } else {
        initializationRevision++;
        machineState.set({ ...structuredClone(INITIAL_STATE), ...loadIncrements(), status: 'OFFLINE' });
    }
});
