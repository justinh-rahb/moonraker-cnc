<script>
    import PanelModule from "../ui/PanelModule.svelte";
    import SegmentDisplay from "../ui/SegmentDisplay.svelte";
    import RetroSlider from "../ui/RetroSlider.svelte";
    import CncButton from "../ui/CncButton.svelte";
    import { machineState } from "../../../stores/machineStore.js";
</script>

<PanelModule title="EXTRUDER">
    <SegmentDisplay>{$machineState.extrusionFactor}%</SegmentDisplay>

    <RetroSlider
        label="EXTRUSION FACTOR"
        bind:value={$machineState.extrusionFactor}
    />

    <div class="action-buttons">
        <CncButton variant="action">RETRACT</CncButton>
        <CncButton variant="action">EXTRUDE</CncButton>
    </div>
</PanelModule>

<style>
    .action-buttons {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
    }
</style>
