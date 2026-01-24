<script>
    import PanelModule from "../ui/PanelModule.svelte";
    import CncButton from "../ui/CncButton.svelte";
</script>

<PanelModule title="POWER">
    <div class="action-buttons">
        <CncButton variant="danger">POWEROFF NOW</CncButton>
        <CncButton variant="danger">POWEROFF CANCEL</CncButton>
        <CncButton variant="action">POWEROFF STATUS</CncButton>
        <CncButton variant="action">SYSTEM INFO</CncButton>
    </div>
</PanelModule>

<style>
    .action-buttons {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
    }
</style>
