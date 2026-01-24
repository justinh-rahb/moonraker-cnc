<script>
    import PanelModule from "../ui/PanelModule.svelte";
    import CncButton from "../ui/CncButton.svelte";
    import { send } from "../../../stores/websocket.js";
    import { configStore } from "../../../stores/configStore.js";

    // Get first 4 macros (mapped to motion panel)
    $: macros = $configStore.macros.slice(0, 4);

    const runMacro = (gcode) => {
        send("printer.gcode.script", { script: gcode });
    };
</script>

<PanelModule title="MOTION">
    <div class="action-buttons">
        {#each macros as macro}
            <CncButton
                variant={macro.style || "action"}
                on:click={() => runMacro(macro.gcode)}
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
