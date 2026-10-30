<script>
  import { onMount } from "svelte";
  import { headingFontFamily } from './lib/fonts.js';
  import Scanline from "./lib/components/ui/Scanline.svelte";
  import Header from "./lib/components/modules/Header.svelte";
  import ConnectionModal from "./lib/components/ui/ConnectionModal.svelte";
  import FilePickerModal from "./lib/components/ui/FilePickerModal.svelte";
  import NotificationArea from "./lib/components/ui/NotificationArea.svelte";
  import { configStore } from "./stores/configStore.js";
  import {
    filePickerOpen,
    filePickerPath,
  } from "./stores/uiStore.js";
  import { connect, disconnect, lastError } from "./stores/websocket.js";
  import { updateServerConfig } from "./stores/configStore.js";

  // Update page title dynamically based on user's configured machine title
  $: if (typeof document !== "undefined") {
    document.title = $configStore.title || "Retrograde";
  }

  import { initializeNavigation } from './stores/navigation.js';
  import { workspaceStore } from './stores/configStore.js';
  import { serverUrl } from './lib/config.js';
  import { notificationStore } from "./stores/notificationStore.js";
  import { consoleStore } from './stores/consoleStore.js';
  import HostsModal from './lib/components/ui/HostsModal.svelte';
  import HistoryModal from './lib/components/ui/HistoryModal.svelte';
  import Dashboard from './lib/components/modules/Dashboard.svelte';
  import './themes.css';
  let arrangingPanels = false;
  $: if ($workspaceStore.activeHostId) arrangingPanels = false;
  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    try { if (params.has('ip') || params.has('port') || params.has('autoconnect')) updateServerConfig(params.get('ip') || $configStore.server.ip, params.get('port') || $configStore.server.port, params.has('autoconnect') ? params.get('autoconnect') === 'true' : $configStore.server.autoConnect); } catch(e) { lastError.set(e.message); }
    const stopNavigation = initializeNavigation();
    let previous;
    let previousHost;
    const stopConfig = configStore.subscribe(config => {
      const url = serverUrl(config.server);
      const hostId = $workspaceStore.activeHostId;
      if (previous !== url || previousHost !== hostId) {
        disconnect();
        consoleStore.clear();
        notificationStore.reset();
        if (previousHost) $filePickerPath = '';
        previousHost = hostId;
        previous = url;
        if (config.server.autoConnect || params.get('autoconnect') === 'true') connect(url);
      }
    });
    return () => { stopNavigation(); stopConfig(); disconnect(); };
  });
  $: if (typeof document !== 'undefined') document.documentElement.dataset.theme = typeof __APP_THEME__ === 'undefined' ? 'flight' : __APP_THEME__;
  $: if (typeof document !== 'undefined') {
    const selected = $configStore.appearance?.headingFont || 'theme';
    document.documentElement.dataset.headingFont = selected;
    const family = headingFontFamily(selected);
    if (family) document.documentElement.style.setProperty('--heading-font',family);
    else document.documentElement.style.removeProperty('--heading-font');
  }
</script>

<Scanline />
<ConnectionModal />
<HostsModal />
<HistoryModal />
<FilePickerModal bind:isOpen={$filePickerOpen} />
<NotificationArea />

<div class="machine-panel">
  <Header bind:editing={arrangingPanels} />

  {#key $workspaceStore.activeHostId}<Dashboard bind:editing={arrangingPanels} />{/key}
</div>
