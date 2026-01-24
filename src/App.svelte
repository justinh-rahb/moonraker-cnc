<script>
  import Scanline from "./lib/components/ui/Scanline.svelte";
  import Header from "./lib/components/modules/Header.svelte";
  import ToolheadControl from "./lib/components/modules/ToolheadControl.svelte";
  import ExtruderControl from "./lib/components/modules/ExtruderControl.svelte";
  import TemperaturePanel from "./lib/components/modules/TemperaturePanel.svelte";
  import MotionPanel from "./lib/components/modules/MotionPanel.svelte";
  import PowerPanel from "./lib/components/modules/PowerPanel.svelte";
  import ConnectionModal from "./lib/components/ui/ConnectionModal.svelte";
</script>

<Scanline />
<ConnectionModal />

<div class="machine-panel">
  <Header />

  <div class="panel-grid">
    <!-- Left Column -->
    <div class="column">
      <ToolheadControl />
      <ExtruderControl />
    </div>

    <!-- Right Column -->
    <div class="column">
      <TemperaturePanel />
      <MotionPanel />
      <PowerPanel />
    </div>
  </div>
</div>

<style>
  .panel-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 25px;
    /* No margin-top needed if header has margin-bottom, but let's check */
  }

  .column {
    display: flex;
    flex-direction: column;
    gap: 25px;
  }

  @media (max-width: 1200px) {
    .panel-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
