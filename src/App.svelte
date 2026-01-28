<script>
  import Scanline from "./lib/components/ui/Scanline.svelte";
  import Header from "./lib/components/modules/Header.svelte";
  import ToolheadControl from "./lib/components/modules/ToolheadControl.svelte";
  import ExtruderControl from "./lib/components/modules/ExtruderControl.svelte";
  import TemperaturePanel from "./lib/components/modules/TemperaturePanel.svelte";
  import MiscPanel from "./lib/components/modules/MiscPanel.svelte";
  import MacroPanel from "./lib/components/modules/MacroPanel.svelte";
  import PrintStatusPanel from "./lib/components/modules/PrintStatusPanel.svelte";
  import MachineLimitsPanel from "./lib/components/modules/MachineLimitsPanel.svelte";
  import ConsolePanel from "./lib/components/modules/ConsolePanel.svelte";
  import CameraPanel from "./lib/components/modules/CameraPanel.svelte";
  import ConnectionModal from "./lib/components/ui/ConnectionModal.svelte";
  import FilePickerModal from "./lib/components/ui/FilePickerModal.svelte";
  import NotificationArea from "./lib/components/ui/NotificationArea.svelte";
  import { configStore } from "./stores/configStore.js";
  import { filePickerOpen } from "./stores/uiStore.js";

  // Sort panels by order
  $: sortedPanels = [...$configStore.panels].sort((a, b) => a.order - b.order);

  // Update page title dynamically based on user's configured machine title
  $: if (typeof document !== 'undefined') {
    document.title = $configStore.title || 'Retro CNC Panel';
  }
</script>

<Scanline />
<ConnectionModal />
<FilePickerModal bind:isOpen={$filePickerOpen} />
<NotificationArea />

<div class="machine-panel">
  <Header />

  <div class="panel-grid">
    <!-- Left Column -->
    <div class="column">
      <PrintStatusPanel />
      <ToolheadControl />
      <ExtruderControl />
      <ConsolePanel />
    </div>

    <!-- Right Column -->
    <div class="column">
      {#if $configStore.cameras?.some(c => c.enabled)}
        <CameraPanel />
      {/if}
      <TemperaturePanel />
      <MachineLimitsPanel />
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
