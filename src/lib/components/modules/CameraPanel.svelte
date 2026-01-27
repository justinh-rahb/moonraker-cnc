<script>
  import PanelModule from "../ui/PanelModule.svelte";
  import CncButton from "../ui/CncButton.svelte";
  import WebRTCPlayer from "../ui/WebRTCPlayer.svelte";
  import { configStore } from "../../../stores/configStore.js";
  import { onDestroy, onMount } from "svelte";

  const CAMERA_SELECTION_KEY = 'retro_cnc_camera_selection';

  let selectedCameraId = null;
  let refreshTimer = null;
  let imageTimestamp = Date.now();
  
  // FPS calculation
  let lastFrameTime = 0;
  let currentFps = 0;
  let rawFps = 0;
  let lastDisplayUpdate = 0;
  let startLoadTime = 0;
  
  let containerElement;
  let isIntersecting = false;
  let isPageVisible = typeof document !== 'undefined' ? document.visibilityState === 'visible' : true;

  $: isVisible = isIntersecting && isPageVisible;

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
  $: streamType = selectedCamera?.streamType || 'mjpeg';
  $: streamUrl = (() => {
    // If hidden and snapshot URL available, show static snapshot to close connection
    if (!isVisible && selectedCamera?.snapshotUrl) {
      return selectedCamera.snapshotUrl;
    }
    
    // For WebRTC, just return base URL, don't append timestamp
    if (streamType === 'go2rtc' || streamType === 'camera-streamer') {
        return baseStreamUrl;
    }

    // Otherwise show stream (updating or stale based on timestamp updates)
    return baseStreamUrl 
      ? `${baseStreamUrl}${baseStreamUrl.includes('?') ? '&' : '?'}t=${imageTimestamp}`
      : '';
  })();
  
  // Track refresh timer for MJPEG
  // For WebRTC, the player component handles its own connection lifecycle
  $: isMjpeg = !streamType || streamType === 'mjpeg';

  // Trigger next frame load
  function triggerLoad() {
    if (!isMjpeg) return; // Only MJPEG needs manual refresh loop

    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = null;

    if (isVisible) {
      startLoadTime = performance.now();
      imageTimestamp = Date.now();
    }
  }

  // Handle visibility changes to start/stop loop
  $: if (isVisible) {
    // If we became visible and no timer/load is pending, kickstart
    if (!refreshTimer && isMjpeg) {
       triggerLoad();
    }
  } else {
    // If hidden, stop the loop
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
  }
  
  // Reset when camera changes
  $: if (selectedCameraId) {
     currentFps = 0;
     rawFps = 0;
     lastFrameTime = 0;
     refreshTimer = null;
     if (isVisible && isMjpeg) triggerLoad();
  }

  // Handle frame load for FPS calculation and scheduling next frame
  function handleFrameLoad() {
    // Only calculate FPS for MJPEG
    if (!isMjpeg) return;

    const now = performance.now();
    
    // Calculate FPS if we have a previous frame time
    if (lastFrameTime > 0) {
      const delta = now - lastFrameTime;
      const instantFps = 1000 / delta;
      
      // Simple EMA (Exponential Moving Average) for smoothing: 0.05 weight for new value
      // Use rawFps for calculation to keep high precision
      rawFps = rawFps === 0 
        ? instantFps 
        : (rawFps * 0.95 + instantFps * 0.05);

      // Only update display every 500ms to prevent rapid flickering
      if (now - lastDisplayUpdate > 500) {
        currentFps = rawFps;
        lastDisplayUpdate = now;
      }
    }
    
    lastFrameTime = now;
    
    // Schedule next frame
    scheduleNextFrame(now);
  }

  function handleFrameError() {
    // On error, just schedule next attempt with default delay
    scheduleNextFrame(performance.now());
  }

  function scheduleNextFrame(nowCallback) {
    if (!isVisible || !isMjpeg) return;

    const targetFps = selectedCamera?.targetRefreshRate || 5;
    const targetInterval = 1000 / targetFps;
    const loadTime = nowCallback - startLoadTime;
    
    // Calculate how long to wait to maintain target interval
    // If load took longer than interval, wait 0 (or small breath)
    const delay = Math.max(0, targetInterval - loadTime);
    
    refreshTimer = setTimeout(triggerLoad, delay);
  }

  // Start refresh interval for MJPEG streams
  onMount(() => {
    // Setup visibility tracking
    const observer = new IntersectionObserver((entries) => {
      isIntersecting = entries[0].isIntersecting;
    }, { threshold: 0.01 }); // Trigger as soon as 1% is visible

    if (containerElement) {
      observer.observe(containerElement);
    }

    const handleVisibilityChange = () => {
      isPageVisible = document.visibilityState === 'visible';
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Load saved camera selection from localStorage
    try {
      const savedCameraId = localStorage.getItem(CAMERA_SELECTION_KEY);
      if (savedCameraId && enabledCameras.some(c => c.id === savedCameraId)) {
        selectedCameraId = savedCameraId;
      }
    } catch (e) {
      console.error('Failed to load camera selection', e);
    }
    
    // Initial trigger if already visible
    if (isVisible && isMjpeg) {
        triggerLoad();
    }

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  });

  onDestroy(() => {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
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
    currentFps = 0;
    rawFps = 0;
    if (isMjpeg) triggerLoad();
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
      <div class="camera-container" bind:this={containerElement}>
        <div class="aspect-ratio-box" style="padding-bottom: {aspectRatioPadding};">
          {#if streamUrl}
            {#if isMjpeg}
                <img
                    src={streamUrl}
                    alt={selectedCamera.name}
                    class="camera-feed"
                    style="transform: {transformStyle};"
                    on:load={handleFrameLoad}
                    on:error={handleFrameError}
                />
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
