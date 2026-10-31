import { derived, get, writable } from 'svelte/store';
import { machineState } from './machineStore.js';
import { configStore } from './configStore.js';
import { connectionState, getConnectionGeneration, send } from './websocket.js';
import { afcControlBlock, afcScript, mergeAfcStatus } from '../lib/afc.js';

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
        const response = await send('printer.objects.query',{objects},{silent:true});
        check();
        const status = response.status || {};
        const reason = afcControlBlock(status,{allowError:action === 'clear'});
        if (reason) throw new Error(reason);
        // Do not manufacture a missing lane out of stale cached telemetry.
        const script = afcScript(status,action,data);
        machineState.update(s => ({...s,afcObjects:mergeAfcStatus(s.afcObjects,status),availableCommands:status.gcode?.commands || {}}));
        check();
        await send('printer.gcode.script',{script},{silent:true});
        check();
        // Commands may not emit every field, especially on compatibility stubs.
        const refreshed = await send('printer.objects.query',{objects},{silent:true});
        check();
        machineState.update(s => ({...s,afcObjects:mergeAfcStatus(s.afcObjects,refreshed.status || {})}));
    } finally {
        if (get(pending) === token) pending.set(null);
    }
}
