<script>
    import PanelModule from "../ui/PanelModule.svelte";
    import CncButton from "../ui/CncButton.svelte";
</script>

<PanelModule title="MOTION">
    <div class="action-buttons">
        <CncButton variant="action">Z OFFSET TEST</CncButton>
        <CncButton variant="action">ZZ OFFSET TEST</CncButton>
        <CncButton variant="action">Z COMPENSATE</CncButton>
        <CncButton variant="action">PID EXTRUDER</CncButton>
    </div>
</PanelModule>

<style>
    .action-buttons {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
    }
</style>
