<script>
  import PanelModule from "../ui/PanelModule.svelte";
  import CncButton from "../ui/CncButton.svelte";
  import { configStore } from "../../../stores/configStore.js";
  import { onDestroy, onMount } from "svelte";

  const CAMERA_SELECTION_KEY = 'retro_cnc_camera_selection';

  let selectedCameraId = null;
  let refreshInterval = null;
  let imageTimestamp = Date.now();
  let frameCount = 0;
  let lastFpsUpdate = Date.now();
  let currentFps = 0;

  // Get enabled cameras
  $: enabledCameras = ($configStore.cameras || []).filter(c => c.enabled);
  $: selectedCamera = enabledCameras.find(c => c.id === selectedCameraId) || enabledCameras[0];
  $: hasMultipleCameras = enabledCameras.length > 1;

  // Calculate aspect ratio padding
  $: aspectRatioPadding = (() => {
    if (!selectedCamera?.aspectRatio) return '56.25%'; // Default 16:9
    const [w, h] = selectedCamera.aspectRatio.split(':').map(Number);
    return `${(h / w) * 100}%`;
  })();

  // Calculate transform CSS
  $: transformStyle = (() => {
    if (!selectedCamera) return '';
    const transforms = [];
    if (selectedCamera.flipH) transforms.push('scaleX(-1)');
    if (selectedCamera.flipV) transforms.push('scaleY(-1)');
    if (selectedCamera.rotation) transforms.push(`rotate(${selectedCamera.rotation}deg)`);
    return transforms.length ? transforms.join(' ') : 'none';
  })();

  // Update stream URL with timestamp for refresh
  // Decoupled to prevent reactive chain re-evaluation every interval
  $: baseStreamUrl = selectedCamera?.streamUrl || '';
  $: streamUrl = baseStreamUrl 
    ? `${baseStreamUrl}${baseStreamUrl.includes('?') ? '&' : '?'}t=${imageTimestamp}`
    : '';

  // Update refresh interval when selected camera or its refresh rate changes
  $: if (selectedCamera && refreshInterval) {
    const fps = selectedCamera.targetRefreshRate || 5;
    const intervalMs = Math.round(1000 / fps);
    clearInterval(refreshInterval);
    refreshInterval = setInterval(() => {
      imageTimestamp = Date.now();
    }, intervalMs);
  }

  // Handle frame load for FPS calculation
  function handleFrameLoad() {
    frameCount++;
    const now = Date.now();
    const elapsed = now - lastFpsUpdate;
    
    // Update FPS every second
    if (elapsed >= 1000) {
      currentFps = Math.round((frameCount / elapsed) * 1000);
      frameCount = 0;
      lastFpsUpdate = now;
    }
  }

  // Start refresh interval for MJPEG streams
  onMount(() => {
    // Load saved camera selection from localStorage
    try {
      const savedCameraId = localStorage.getItem(CAMERA_SELECTION_KEY);
      if (savedCameraId && enabledCameras.some(c => c.id === savedCameraId)) {
        selectedCameraId = savedCameraId;
      }
    } catch (e) {
      console.error('Failed to load camera selection', e);
    }

    // Set up refresh interval based on camera refresh rate
    const updateInterval = () => {
      const fps = selectedCamera?.targetRefreshRate || 5;
      const intervalMs = Math.round(1000 / fps);
      
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
      
      refreshInterval = setInterval(() => {
        imageTimestamp = Date.now();
      }, intervalMs);
    };
    
    updateInterval();
  });

  onDestroy(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });

  function selectCamera(cameraId) {
    selectedCameraId = cameraId;
    
    // Persist selection to localStorage
    try {
      localStorage.setItem(CAMERA_SELECTION_KEY, cameraId);
    } catch (e) {
      console.error('Failed to save camera selection', e);
    }
    
    // Reset FPS counter when switching cameras
    frameCount = 0;
    currentFps = 0;
    lastFpsUpdate = Date.now();
  }
</script>

<PanelModule title="CAMERA FEED">
  {#if enabledCameras.length === 0}
    <div class="no-camera">
      <p>NO CAMERAS CONFIGURED</p>
      <p class="hint">CONFIGURE IN SETTINGS</p>
    </div>
  {:else}
    {#if selectedCamera}
      <div class="camera-container">
        <div class="aspect-ratio-box" style="padding-bottom: {aspectRatioPadding};">
          {#if streamUrl}
            <img
              src={streamUrl}
              alt={selectedCamera.name}
              class="camera-feed"
              style="transform: {transformStyle};"
              on:load={handleFrameLoad}
              on:error={() => {
                // Handle error silently, maybe add error state later
              }}
            />
          {:else}
            <div class="no-stream">
              <p>NO STREAM URL</p>
            </div>
          {/if}

          {#if selectedCamera.showFps && currentFps > 0}
            <div class="fps-overlay">
              {currentFps} FPS
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
