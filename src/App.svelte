<script>
  import { onMount, onDestroy } from "svelte";
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
  import {
    filePickerOpen,
    filePickerPath,
    settingsOpen,
    settingsTab,
  } from "./stores/uiStore.js";
  import { connect } from "./stores/websocket.js";
  import { updateServerConfig } from "./stores/configStore.js";

  // Sort panels by order
  $: sortedPanels = [...$configStore.panels].sort((a, b) => a.order - b.order);

  // Update page title dynamically based on user's configured machine title
  $: if (typeof document !== "undefined") {
    document.title = $configStore.title || "Retro CNC Panel";
  }

  // Handle URL parameters for deep linking
  onMount(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);

    // Connection parameters: ip, port, autoconnect
    const ip = params.get("ip");
    const port = params.get("port");
    const autoconnect = params.get("autoconnect");

    if (ip || port || autoconnect) {
      const finalIp = ip || $configStore.server.ip;
      const finalPort = port || $configStore.server.port;
      const shouldAutoConnect = autoconnect === "true";

      // Update server config
      updateServerConfig(finalIp, finalPort, shouldAutoConnect);

      // Connect if autoconnect=true
      if (shouldAutoConnect) {
        connect(`${finalIp}:${finalPort}`);
      }
    }

    // Use hash-based routing for navigation state (files/settings).

    // Parse hash routes like `#/files/some/path` or `#/settings/tabname`.
    const handleHash = () => {
      const hash = window.location.hash || ""; // includes leading '#'
      if (!hash) {
        return;
      }
      // Remove leading '#'
      const route = hash.startsWith("#") ? hash.slice(1) : hash;
      // Normalize leading '/'
      const normalized = route.startsWith("/") ? route.slice(1) : route;
      const parts = normalized.split("/");
      const head = parts[0];

      // Legacy `#/files` route: open file picker (no path parsing)
      if (head === "files") {
        $filePickerOpen = true;
        return;
      }

      if (head === "settings") {
        const tab = parts.length > 1 ? decodeURIComponent(parts[1]) : "";
        // Map path-style tab names to existing tab labels
        const tabMapping = {
          general: "General",
          interface: "Interface",
          macros: "Macros",
          panels: "Panels",
          cameras: "Cameras",
          sysinfo: "Sysinfo",
        };
        const tabName = tab ? tabMapping[tab.toLowerCase()] || tab : "General";
        $settingsTab = tabName;
        $settingsOpen = true;
        return;
      }
    };

    // Apply hash routes for pages (files/settings)
    handleHash();

    // Keep connection/query-param logic above unchanged (ip/port/autoconnect)
  });

  // Listen for hash changes at runtime to sync UI state
  const onHashChange = () => {
    if (typeof window === "undefined") return;
    // Re-run the same hash parsing logic used on mount
    const hash = window.location.hash || "";
    if (!hash) return;
    const route = hash.startsWith("#") ? hash.slice(1) : hash;
    const normalized = route.startsWith("/") ? route.slice(1) : route;
    const parts = normalized.split("/");
    const head = parts[0];

    // Legacy `#/files` route: open file picker (no path parsing)
    if (head === "files") {
      $filePickerOpen = true;
      return;
    }

    if (head === "settings") {
      const tab = parts.length > 1 ? decodeURIComponent(parts[1]) : "";
      const tabMapping = {
        general: "General",
        interface: "Interface",
        macros: "Macros",
        panels: "Panels",
        cameras: "Cameras",
        sysinfo: "Sysinfo",
      };
      const tabName = tab ? tabMapping[tab.toLowerCase()] || tab : "General";
      $settingsTab = tabName;
      $settingsOpen = true;
      return;
    }
  };

  // Listen for popstate events (browser back/forward navigation)
  const onPopState = () => {
    if (typeof window === "undefined") return;
    // When user navigates with back/forward, re-parse the current hash
    onHashChange();
  };

  if (typeof window !== "undefined") {
    window.addEventListener("hashchange", onHashChange);
    window.addEventListener("popstate", onPopState);
  }

  onDestroy(() => {
    if (typeof window !== "undefined") {
      window.removeEventListener("hashchange", onHashChange);
      window.removeEventListener("popstate", onPopState);
    }
  });

  // Sync navigation state to URL/history when stores change
  $: if (typeof window !== "undefined") {
    // Files open/close -> update hash to /files (no path segment)
    const writeFilesHash = () => {
      if ($filePickerOpen) {
        const desired = `#/files`;
        if (window.location.hash !== desired) {
          history.pushState(null, '', desired);
        }
      } else {
        if (window.location.hash === '#/files') {
          history.pushState(null, '', window.location.pathname + window.location.search);
        }
      }
    };

    // Settings open/close or tab change -> update hash to /settings/<tab>
    const writeSettingsHash = () => {
      if ($settingsOpen) {
        const tabSegment = ($settingsTab || 'General').toString().toLowerCase();
        const desired = `#/settings/${encodeURIComponent(tabSegment)}`;
        if (window.location.hash !== desired) {
          history.pushState(null, '', desired);
        }
      } else {
        if (window.location.hash.startsWith('#/settings')) {
          history.pushState(null, '', window.location.pathname + window.location.search);
        }
      }
    };

    writeFilesHash();
    writeSettingsHash();
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
      {#if $configStore.cameras?.some((c) => c.enabled)}
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
