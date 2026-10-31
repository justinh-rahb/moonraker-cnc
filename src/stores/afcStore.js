import { derived, get, writable } from 'svelte/store';
import { machineState, updateStateFromStatus } from './machineStore.js';
import { configStore } from './configStore.js';
import { connectionState, getConnectionGeneration, send } from './websocket.js';
import { READ_TIMEOUT, GCODE_TIMEOUT } from '../lib/rpc.js';
import { afcControlBlock, afcScript } from '../lib/afc.js';

// Heating, loading and tool docking can take minutes while Moonraker waits
// for the script to finish. Read queries and metadata edits keep normal deadlines.
const motionActions = new Set(['load','unload','eject','select','unselect']);
export const AFC_MOTION_TIMEOUT = GCODE_TIMEOUT;
const pending = writable(null);
export const afcPending = derived([pending, connectionState], ([$pending,$connection]) => $connection === 'connected' && $pending?.generation === getConnectionGeneration() ? $pending : null);
const liveStatus = s => ({...s.afcObjects, webhooks:{state:s.isReady ? 'ready' : 'unavailable'}, print_stats:{state:s.printStatsState}, idle_timeout:{state:s.idleState}, virtual_sdcard:{is_active:s.virtualSdActive}, pause_resume:{is_paused:s.isPaused},gcode:{commands:s.availableCommands}});
const disabledReason = allowError => derived([machineState,configStore,afcPending], ([s,c,p]) => p ? 'Waiting for AFC…' : c.afc?.enabled === false ? 'AFC panel is disabled' : afcControlBlock(liveStatus(s),{allowError}));
export const afcDisabledReason = disabledReason(false);
export const afcClearDisabledReason = disabledReason(true);

export async function runAfcAction(action, data = {}, expectedGeneration = getConnectionGeneration()) {
    const generation = getConnectionGeneration();
    if (generation !== expectedGeneration) throw new Error('Printer connection changed; reopen the AFC control');
    if (get(afcPending)) throw new Error('Wait for the current AFC operation');
    const check = () => {
        if (generation !== getConnectionGeneration() || get(connectionState) !== 'connected') throw new Error('Printer connection changed; AFC operation cancelled');
        if (get(configStore).afc?.enabled === false) throw new Error('AFC panel is disabled');
    };
    check();
    const token = {generation}; pending.set(token);
    try {
        const objects = Object.fromEntries(Object.keys(get(machineState).afcObjects).map(k => [k,null]));
        Object.assign(objects,{webhooks:['state'],print_stats:['state'],virtual_sdcard:['is_active'],pause_resume:['is_paused'],idle_timeout:['state'],gcode:['commands']});
        const refresh = async () => {
            const response = await send('printer.objects.query',{objects},{silent:true});
            check();
            updateStateFromStatus(response.status || {});
        };
        const response = await send('printer.objects.query',{objects},{silent:true});
        check();
        const status = response.status || {};
        const reason = afcControlBlock(status,{allowError:action === 'clear'});
        if (reason) throw new Error(reason);
        // Do not manufacture a missing lane out of stale cached telemetry.
        const script = afcScript(status,action,data);
        updateStateFromStatus(status);
        check();
        try {
            await send('printer.gcode.script',{script},{silent:true,timeout:motionActions.has(action) ? AFC_MOTION_TIMEOUT : READ_TIMEOUT});
        } catch (error) {
            // A timeout is not a cancelled macro. Observe its outcome, but never
            // repeat the command or assume the operation completed successfully.
            if (generation === getConnectionGeneration() && get(connectionState) === 'connected') {
                try { await refresh(); } catch { /* Preserve the command error. */ }
            }
            throw error;
        }
        check();
        try { await refresh(); }
        catch (error) { throw new Error(`AFC command was acknowledged, but its status could not be refreshed: ${error.message || 'connection unavailable'}`); }

    } finally {
        if (get(pending) === token) pending.set(null);
    }
}
