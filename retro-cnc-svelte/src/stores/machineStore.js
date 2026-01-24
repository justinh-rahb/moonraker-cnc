import { writable, get } from 'svelte/store';
import { send, onNotification, connectionState } from './websocket.js';

// Initial state
export const machineState = writable({
    status: 'STANDBY',
    isEmergencyStop: false,

    // Coordinates (toolhead)
    position: { x: 0.00, y: 0.00, z: 0.00, e: 0.00 },

    // Temperatures
    temperatures: {
        extruder: { current: 0, target: 0 },
        heater_bed: { current: 0, target: 0 },
        cpu: { current: 0, target: null },
        mcu: { current: 0, target: null }
    },

    // Factors
    speedFactor: 100, // %
    extrusionFactor: 100, // %

    // Selected options
    jogDistance: 10,
});

// Helper actions
export const setJogDistance = (dist) => {
    machineState.update(s => ({ ...s, jogDistance: dist }));
};

// WebSocket Integration
connectionState.subscribe((state) => {
    if (state === 'connected') {
        initializeConnection();
    }
});

const initializeConnection = async () => {
    try {
        // subscribe to object updates
        await send('printer.objects.subscribe', {
            objects: {
                toolhead: ['position', 'status', 'print_time', 'homed_axes'],
                extruder: ['temperature', 'target'],
                heater_bed: ['temperature', 'target'],
                'gcode_move': ['speed_factor', 'extrude_factor'],
                'print_stats': ['state'],
                'temperature_sensor mcu_temp': ['temperature'],
                'temperature_host': ['temperature']
                // Adjusted common sensor names, might differ on real config
            }
        });

        // Initial query to populate state immediately
        const status = await send('printer.objects.query', {
            objects: {
                toolhead: null,
                extruder: null,
                heater_bed: null,
                gcode_move: null,
                print_stats: null
            }
        });

        updateStateFromStatus(status.status);

    } catch (e) {
        console.error('Failed to initialize printer connection:', e);
    }
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

        if (status.extruder) {
            newState.temperatures.extruder = {
                current: status.extruder.temperature,
                target: status.extruder.target
            };
        }

        if (status.heater_bed) {
            newState.temperatures.heater_bed = {
                current: status.heater_bed.temperature,
                target: status.heater_bed.target
            };
        }

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

    // Construct simplified G-code for relative move
    // G91 = relative positioning
    // G1 = linear move
    // G90 = absolute positioning (return to default)
    const gcode = `G91\nG1 ${axis.toUpperCase()}${direction * dist} F${feedrate}\nG90`;

    send('printer.gcode.script', { script: gcode });
};

export const emergencyStop = () => {
    send('printer.emergency_stop');
};

export const home = async () => {
    send('printer.gcode.script', { script: "G28" });
};
