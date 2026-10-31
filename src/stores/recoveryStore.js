import { get, writable } from 'svelte/store';
import { connectionState, send, getConnectionGeneration } from './websocket.js';
import { machineState, initializeConnection } from './machineStore.js';
import { consoleStore } from './consoleStore.js';
import { restartMethod } from '../lib/rpc.js';

export const recoveryState = writable({pending:false,error:''});
let operation;
let deadline;
function finish(error = '') {
    clearTimeout(deadline);operation = null;
    recoveryState.set({pending:false,error});
}
machineState.subscribe(state => {
    if (operation?.acknowledged && state.isReady && operation.generation === getConnectionGeneration()) finish();
});
connectionState.subscribe(state => { if (state !== 'connected') finish(); });

export async function restartKlipper(script, expectedGeneration = getConnectionGeneration()) {
    const method = restartMethod(script);
    if (!method) throw new Error('Use RESTART or FIRMWARE_RESTART');
    const generation = getConnectionGeneration();
    const check = () => {
        if (generation !== expectedGeneration || generation !== getConnectionGeneration() || get(connectionState) !== 'connected') throw new Error('Moonraker connection changed; restart was not retried');
    };
    check();
    if (operation) throw new Error('A Klipper restart is already pending');
    const token = {generation,acknowledged:false};operation = token;
    recoveryState.set({pending:true,error:''});
    try {
        const server = await send('server.info',{}, {silent:true});check();
        let state = server.klippy_state;
        if (!state) {
            if (server.klippy_connected === false) state = 'disconnected';
            else { const info = await send('printer.info',{}, {silent:true});check();state = info.state; }
        }
        if (state === 'ready') {
            const {status} = await send('printer.objects.query',{objects:{print_stats:['state'],virtual_sdcard:['is_active'],pause_resume:['is_paused']}},{silent:true});check();
            if (!['standby','complete','cancelled','error'].includes(status?.print_stats?.state) || status?.virtual_sdcard?.is_active !== false || status?.pause_resume?.is_paused !== false) throw new Error('Finish or cancel the current print before restarting Klipper');
        } else if (!['shutdown','error','disconnected'].includes(state)) throw new Error('Klipper is starting or its state is unknown; wait before restarting');
        check();
        machineState.update(s => ({...s,isReady:false,klippyState:'startup',status:'RESTARTING',stateMessage:'Restart requested; waiting for Klipper…',afcObjects:{},availableCommands:{}}));
        consoleStore.addCommand(script.trim().toUpperCase());
        await send(method,{}, {silent:true});check();
        token.acknowledged = true;
        if (get(machineState).isReady) {finish();return;}
        deadline = setTimeout(() => {
            if (operation === token) finish('Restart was acknowledged, but Klipper has not become ready. Review the Klipper error and connection before retrying.');
        },60000);
        // Reconcile immediately; the ready notification will repeat initialization
        // when Klipper has finished starting. Commands are never automatically retried.
        initializeConnection();
    } catch (error) {
        if (operation === token) {
            finish(error.message || 'Restart failed');
            if (generation === getConnectionGeneration() && get(connectionState) === 'connected') initializeConnection();
        }
        throw error;
    }
}
