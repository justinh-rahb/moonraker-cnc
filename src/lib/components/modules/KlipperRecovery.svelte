<script>
    import ConfirmDialog from '../ui/ConfirmDialog.svelte';
    import { machineState } from '../../../stores/machineStore.js';
    import { connectionState, getConnectionGeneration } from '../../../stores/websocket.js';
    import { recoveryState, restartKlipper } from '../../../stores/recoveryStore.js';
    let confirmation = null;
    $: state = $machineState.klippyState;
    $: stopped = ['shutdown','error','disconnected'].includes(state);
    $: if ($connectionState !== 'connected') confirmation = null;
    function request(command) {confirmation = {command,generation:getConnectionGeneration()};}
    async function confirm() {
        const action = confirmation;confirmation = null;
        if (!action) return;
        try {await restartKlipper(action.command,action.generation);} catch { /* recoveryState displays the failure. */ }
    }
</script>
{#if $connectionState === 'connected' && (stopped || $recoveryState.pending || $recoveryState.error)}
<section class="recovery" aria-label="Klipper recovery" role="status">
    <div><strong>{$recoveryState.pending ? 'Restarting Klipper…' : state === 'shutdown' ? 'Klipper is shut down' : state === 'disconnected' ? 'Moonraker is connected; Klipper is disconnected' : 'Klipper recovery'}</strong>
        {#if $machineState.stateMessage}<p>{$machineState.stateMessage}</p>{/if}
        {#if $recoveryState.error}<p role="alert">{$recoveryState.error}</p>{/if}
    </div>
    <div class="recovery-actions">
        <button disabled={$recoveryState.pending} on:click={() => request('RESTART')}>RESTART</button>
        <button disabled={$recoveryState.pending} on:click={() => request('FIRMWARE_RESTART')}>FIRMWARE RESTART</button>
    </div>
</section>
{/if}
<ConfirmDialog isOpen={!!confirmation} title="RESTART KLIPPER" message={confirmation?.command === 'FIRMWARE_RESTART' ? 'Restart Klipper and reset the connected MCUs?' : 'Reload Klipper and its configuration?'} confirmButtonText="RESTART" onConfirm={confirm} onCancel={() => confirmation = null} />
<style>
.recovery {display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;border:1px solid var(--retro-orange);background:var(--bg-module);color:var(--retro-orange);padding:14px;margin-bottom:14px;font-size:13px;}
.recovery>div:first-child {flex:1;min-width:180px;} p {white-space:pre-wrap;overflow-wrap:anywhere;margin:8px 0 0;}.recovery-actions {display:flex;gap:8px;flex-wrap:wrap;} button {font:inherit;cursor:pointer;background:#0c130e;color:var(--retro-green);border:1px solid var(--border-color);padding:9px 12px;}button:disabled {opacity:.45;cursor:wait;}
</style>
