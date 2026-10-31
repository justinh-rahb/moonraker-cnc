<script>
    import ConfirmDialog from "../ui/ConfirmDialog.svelte";
    import { machineState } from "../../../stores/machineStore.js";
    import { restartMethod } from '../../rpc.js';
    import { restartKlipper } from '../../../stores/recoveryStore.js';
    import { notificationStore } from '../../../stores/notificationStore.js';
    let confirmOpen = false;
    let pendingMacro;
    let pendingGeneration;
    $: if ($connectionState !== 'connected' || (!$machineState.isReady && !restartMethod(pendingMacro?.gcode))) { confirmOpen = false; pendingMacro = null; }
    import PanelModule from "../ui/PanelModule.svelte";
    import ControlButton from "../ui/ControlButton.svelte";
    import { send, connectionState, getConnectionGeneration } from "../../../stores/websocket.js";

    export let panel;
    export let editMode = false;

    // Sort macros by order
    $: sortedMacros = [...panel.macros].sort((a, b) => a.order - b.order);

    const canRun = macro => !editMode && $connectionState === 'connected' && !!macro?.gcode?.trim() && ($machineState.isReady || !!restartMethod(macro.gcode));
    async function execute(macro,generation) {
        if (!canRun(macro) || generation !== getConnectionGeneration()) return;
        try {
            if (restartMethod(macro.gcode)) await restartKlipper(macro.gcode,generation);
            else await send('printer.gcode.script',{script:macro.gcode});
        } catch(error) {
            // Ordinary send() failures already produce notifications.
            if (generation === getConnectionGeneration() && restartMethod(macro.gcode)) notificationStore.addError(error);
        }
    }
    const runMacro = macro => {
        if (!canRun(macro)) return;
        const generation = getConnectionGeneration();
        if (macro.confirm) {pendingMacro = macro;pendingGeneration = generation;confirmOpen = true;}
        else execute(macro,generation);
    };

</script>

<PanelModule requiresReady={false} title={panel.title} panelKey={'macro:' + panel.id}>
    <div class="action-buttons">
        {#each sortedMacros as macro (macro.id)}
            <ControlButton
                variant={macro.color || "action"}
                on:click={() => runMacro(macro)}
                disabled={editMode || $connectionState !== 'connected' || (!$machineState.isReady && !restartMethod(macro.gcode)) || !macro.gcode.trim()}
            >
                {macro.label}
            </ControlButton>
        {/each}
    </div>
</PanelModule>

<ConfirmDialog bind:isOpen={confirmOpen} title="RUN MACRO" message={`Run ${pendingMacro?.label || 'macro'}?`} onConfirm={() => execute(pendingMacro,pendingGeneration)} onCancel={() => confirmOpen = false} />
<style>
    .action-buttons {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
    }
</style>
