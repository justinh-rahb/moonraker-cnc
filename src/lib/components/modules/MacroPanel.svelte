<script>
    import PanelModule from "../ui/PanelModule.svelte";
    import CncButton from "../ui/CncButton.svelte";
    import { send } from "../../../stores/websocket.js";

    export let panel;
    export let editMode = false;

    // Sort macros by order
    $: sortedMacros = [...panel.macros].sort((a, b) => a.order - b.order);

    const runMacro = (gcode) => {
        if (!editMode) {
            send("printer.gcode.script", { script: gcode });
        }
    };
</script>

<PanelModule title={panel.title}>
    <div class="action-buttons">
        {#each sortedMacros as macro (macro.id)}
            <CncButton
                variant={macro.color || "action"}
                on:click={() => runMacro(macro.gcode)}
                disabled={editMode}
            >
                {macro.label}
            </CncButton>
        {/each}
    </div>
</PanelModule>

<style>
    .action-buttons {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
    }
</style>
