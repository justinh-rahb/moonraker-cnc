<script>
  import Scanline from "./lib/components/ui/Scanline.svelte";
  import Header from "./lib/components/modules/Header.svelte";
  import ToolheadControl from "./lib/components/modules/ToolheadControl.svelte";
  import ExtruderControl from "./lib/components/modules/ExtruderControl.svelte";
  import TemperaturePanel from "./lib/components/modules/TemperaturePanel.svelte";
  import MiscPanel from "./lib/components/modules/MiscPanel.svelte";
  import MacroPanel from "./lib/components/modules/MacroPanel.svelte";
  import PrintStatusPanel from "./lib/components/modules/PrintStatusPanel.svelte";
  import ConnectionModal from "./lib/components/ui/ConnectionModal.svelte";
  import { configStore } from "./stores/configStore.js";

  // Sort panels by order
  $: sortedPanels = [...$configStore.panels].sort((a, b) => a.order - b.order);
</script>

<Scanline />
<ConnectionModal />

<div class="machine-panel">
  <Header />

  <div class="panel-grid">
    <!-- Left Column -->
    <div class="column">
      <PrintStatusPanel />
      <ToolheadControl />
      <ExtruderControl />
    </div>

    <!-- Right Column -->
    <div class="column">
      <TemperaturePanel />
      <MiscPanel />
      {#each sortedPanels as panel (panel.id)}
        <MacroPanel {panel} />
      {/each}
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
