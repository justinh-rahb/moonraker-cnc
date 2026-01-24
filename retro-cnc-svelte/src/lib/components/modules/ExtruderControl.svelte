<script>
    import PanelModule from "../ui/PanelModule.svelte";
    import SegmentDisplay from "../ui/SegmentDisplay.svelte";
    import RetroSlider from "../ui/RetroSlider.svelte";
    import CncButton from "../ui/CncButton.svelte";
    import {
        machineState,
        setActiveExtruder,
    } from "../../../stores/machineStore.js";
    import { send } from "../../../stores/websocket.js";

    $: extruders = $machineState.availableExtruders || [];
    $: activeExt = $machineState.activeExtruder || "extruder";

    // Commands
    const retract = () => {
        send("printer.gcode.script", { script: "M83\nG1 E-10 F2400\nM82" });
    };

    const extrude = () => {
        send("printer.gcode.script", { script: "M83\nG1 E10 F300\nM82" });
    };

    $: shortName = (name) => {
        // extruder -> T0, extruder1 -> T1, etc.
        const num = name.replace("extruder", "");
        return num === "" ? "T0" : `T${num}`;
    };
</script>

<PanelModule title="EXTRUDER">
    {#if extruders.length > 1}
        <div class="tool-select">
            {#each extruders as ext}
                <button
                    class="tool-btn"
                    class:active={activeExt === ext}
                    on:click={() => setActiveExtruder(ext)}
                >
                    {shortName(ext)}
                </button>
            {/each}
        </div>
    {/if}

    <SegmentDisplay>{$machineState.extrusionFactor}%</SegmentDisplay>

    <RetroSlider
        label="EXTRUSION FACTOR"
        bind:value={$machineState.extrusionFactor}
    />

    <div class="action-buttons">
        <CncButton variant="action" on:click={retract}>RETRACT</CncButton>
        <CncButton variant="action" on:click={extrude}>EXTRUDE</CncButton>
    </div>
</PanelModule>

<style>
    .action-buttons {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
    }

    .tool-select {
        display: flex;
        gap: 8px;
        margin-bottom: 20px;
    }

    .tool-btn {
        flex: 1;
        background: #000;
        border: 2px solid #333;
        color: #666;
        padding: 5px;
        font-family: "Share Tech Mono", monospace;
        font-size: 14px;
        cursor: pointer;
    }

    .tool-btn.active {
        border-color: var(--retro-orange);
        color: var(--retro-orange);
        background: rgba(255, 100, 0, 0.1);
        font-weight: bold;
    }
</style>
