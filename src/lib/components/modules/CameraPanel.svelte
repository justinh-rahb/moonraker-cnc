<script>
  import Scanline from "../ui/Scanline.svelte";
  import { serverUrl } from "../../config.js";
  import PanelModule from "../ui/PanelModule.svelte";
  import WebRTCPlayer from "../ui/WebRTCPlayer.svelte";
  import MjpegPlayer from "../ui/MjpegPlayer.svelte";
  import { configStore } from "../../../stores/configStore.js";
  import { onMount } from "svelte";

  let selectedCameraId = null;
  let currentFps = 0;
  let isIntersecting = false;
  let isPageVisible = typeof document !== 'undefined' ? document.visibilityState === 'visible' : true;
  $: expanded = !($configStore.collapsedPanels || []).includes('CAMERA FEED');
  $: isVisible = isIntersecting && isPageVisible && expanded;
  $: enabledCameras = ($configStore.cameras || []).filter(c => c.enabled);
  $: selectedCameraId = $configStore.selectedCameraId || null;
  $: selectedCamera = enabledCameras.find(c => c.id === selectedCameraId) || enabledCameras[0];
  $: hasMultipleCameras = enabledCameras.length > 1;
  $: aspectRatioPadding = (() => {
    const [w,h] = (selectedCamera?.aspectRatio || '16:9').split(':').map(Number);
    return Number.isFinite(h/w) && h > 0 && w > 0 ? `${h/w*100}%` : '56.25%';
  })();
  $: transformStyle = (() => {
    const transforms = [];
    if (selectedCamera?.flipH) transforms.push('scaleX(-1)');
    if (selectedCamera?.flipV) transforms.push('scaleY(-1)');
    if (selectedCamera?.rotation) transforms.push(`rotate(${selectedCamera.rotation}deg)`);
    return transforms.length ? transforms.join(' ') : 'none';
  })();
  // Prefer this installation's camera proxy when it shares the printer's host.
  // This keeps worker fetches same-origin on the port-1337 installation.
  $: printerOrigin = new URL(serverUrl($configStore.server)).origin.replace(/:7125$/, '');
  $: cameraOrigin = typeof location !== 'undefined' && new URL(printerOrigin).hostname === location.hostname ? location.origin : printerOrigin;
  $: streamUrl = (() => {
    try {
      if (!selectedCamera?.streamUrl) return '';
      const url = new URL(selectedCamera.streamUrl,cameraOrigin);
      return ['http:','https:'].includes(url.protocol) ? url.href : '';
    } catch { return ''; }
  })();
  $: streamType = selectedCamera?.streamType || 'mjpeg';
  $: isMjpeg = streamType === 'mjpeg';
  function observeVisibility(element) {
    const observer = new IntersectionObserver(entries => {
      isIntersecting = entries[0].isIntersecting;
    }, {threshold:0.01});
    observer.observe(element);
    return {destroy() { observer.disconnect(); isIntersecting = false; }};
  }
  onMount(() => {
    const update = () => isPageVisible = document.visibilityState === 'visible';
    document.addEventListener('visibilitychange',update);
    return () => document.removeEventListener('visibilitychange',update);
  });
  function selectCamera(id) {
    currentFps = 0;
    configStore.update(c => ({...c,selectedCameraId:id}));
  }
</script>

<PanelModule requiresReady={false} title="CAMERA FEED">
  {#if enabledCameras.length === 0}
    <div class="no-camera">
      <p>NO CAMERAS CONFIGURED</p>
      <p class="hint">CONFIGURE IN SETTINGS</p>
    </div>
  {:else}
    {#if selectedCamera}
      <div class="camera-container" use:observeVisibility>
        <div class="aspect-ratio-box" style="padding-bottom: {aspectRatioPadding};">
          {#if streamUrl}
            {#if isMjpeg}
                {#key selectedCamera.id}
                  <MjpegPlayer url={streamUrl} active={isVisible} maxFps={selectedCamera.targetRefreshRate || 30}
                    label={selectedCamera.name} {transformStyle} onFps={fps => currentFps = fps} />
                {/key}
            {:else if (streamType === 'go2rtc' || streamType === 'camera-streamer') && isVisible}
                <div class="camera-feed">
                    <WebRTCPlayer
                        url={streamUrl}
                        type={streamType}
                        transformStyle={transformStyle}
                    />
                </div>
            {/if}
          {:else}
            <div class="no-stream">
              <p>NO STREAM URL</p>
            </div>
          {/if}

          {#if selectedCamera.scanlines}<Scanline contained />{/if}

          {#if isMjpeg && selectedCamera.showFps && currentFps > 0}
            <div class="fps-overlay">
              {Math.round(currentFps)} FPS
            </div>
          {/if}
        </div>

        <div class="camera-info">
          <span class="camera-name">{selectedCamera.name}</span>
          {#if hasMultipleCameras}
            <div class="camera-selector">
              {#each enabledCameras as camera (camera.id)}
                <button
                  class="camera-switch-btn"
                  class:active={selectedCamera?.id === camera.id}
                  on:click={() => selectCamera(camera.id)}
                >
                  {camera.name}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/if}
  {/if}
</PanelModule>

<style>
  .no-camera {
    padding: 30px;
    text-align: center;
    color: var(--retro-orange);
  }

  .no-camera p {
    margin: 5px 0;
    font-family: 'Orbitron', monospace;
    font-size: 14px;
  }

  .no-camera .hint {
    font-size: 12px;
    color: #666;
  }

  .camera-container {
    background: #0a0a0a;
    border: 2px solid #333;
    overflow: hidden;
  }

  .aspect-ratio-box {
    position: relative;
    width: 100%;
    overflow: hidden;
    background: #000;
  }

  .camera-feed {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }

  .no-stream {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: var(--retro-red);
    font-family: 'Orbitron', monospace;
    font-size: 14px;
    text-align: center;
  }

  .fps-overlay {
    z-index:2;
    position: absolute;
    top: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.7);
    border: 1px solid var(--retro-green);
    padding: 5px 10px;
    font-family: 'Share Tech Mono', monospace;
    font-size: 12px;
    color: var(--retro-green);
    pointer-events: none;
  }

  .camera-info {
    padding: 10px;
    background: #1a1a1a;
    border-top: 1px solid #333;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }

  .camera-name {
    font-family: 'Orbitron', monospace;
    font-size: 12px;
    color: var(--retro-green);
    text-transform: uppercase;
  }

  .camera-selector {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
  }

  .camera-switch-btn {
    background: #000;
    border: 1px solid #333;
    color: #666;
    padding: 4px 8px;
    font-family: 'Share Tech Mono', monospace;
    font-size: 10px;
    cursor: pointer;
    transition: all 0.2s;
    text-transform: uppercase;
  }

  .camera-switch-btn:hover {
    border-color: var(--retro-green);
    color: var(--retro-green);
  }

  .camera-switch-btn.active {
    background: var(--retro-green);
    border-color: var(--retro-green);
    color: #000;
    font-weight: bold;
  }
</style>
