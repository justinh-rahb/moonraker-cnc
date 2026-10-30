<script>
    import ConfirmDialog from "../ui/ConfirmDialog.svelte";
    import { machineState } from "../../../stores/machineStore.js";
    let confirmOpen = false;
    let pendingMacro;
    $: if (!$machineState.isReady) { confirmOpen = false; pendingMacro = null; }
    import PanelModule from "../ui/PanelModule.svelte";
    import ControlButton from "../ui/ControlButton.svelte";
    import { send } from "../../../stores/websocket.js";

    export let panel;
    export let editMode = false;

    // Sort macros by order
    $: sortedMacros = [...panel.macros].sort((a, b) => a.order - b.order);

    const runMacro = macro => {
        if (editMode || !$machineState.isReady || !macro.gcode.trim()) return;
        if (macro.confirm) {pendingMacro = macro; confirmOpen = true;}
        else send('printer.gcode.script',{script:macro.gcode});
    };
</script>

<PanelModule title={panel.title} panelKey={'macro:' + panel.id}>
    <div class="action-buttons">
        {#each sortedMacros as macro (macro.id)}
            <ControlButton
                variant={macro.color || "action"}
                on:click={() => runMacro(macro)}
                disabled={editMode || !$machineState.isReady || !macro.gcode.trim()}
            >
                {macro.label}
            </ControlButton>
        {/each}
    </div>
</PanelModule>

<ConfirmDialog bind:isOpen={confirmOpen} title="RUN MACRO" message={`Run ${pendingMacro?.label || 'macro'}?`} onConfirm={() => {if(pendingMacro && $machineState.isReady) send("printer.gcode.script",{script:pendingMacro.gcode});}} onCancel={() => confirmOpen = false} />
<style>
    .action-buttons {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
    }
</style>
