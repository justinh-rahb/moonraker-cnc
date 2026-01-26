<script>
    import PanelModule from "../ui/PanelModule.svelte";
    import Led from "../ui/Led.svelte";
    import CncButton from "../ui/CncButton.svelte";
    import FilePickerModal from "../ui/FilePickerModal.svelte";
    import RetroGauge from "../ui/RetroGauge.svelte";
    import ConfirmDialog from "../ui/ConfirmDialog.svelte";
    import {
        machineState,
        pausePrint,
        resumePrint,
        cancelPrint,
        startPrint,
        clearPrintStatus,
    } from "../../../stores/machineStore.js";
    import { hasErrors } from "../../../stores/notificationStore.js";
    import { configStore } from "../../../stores/configStore.js";

    // File picker modal state
    let filePickerOpen = false;

    // Reprint loading state
    let isReprinting = false;

    // Reactive state values
    $: status = $machineState.status;
    $: lastCompletedFilename = $machineState.lastCompletedFilename;
    $: printFilename = $machineState.printFilename;
    $: printProgress = $machineState.printProgress;
    $: printDuration = $machineState.printDuration;
    $: liveSpeed = $machineState.liveSpeed;
    $: liveExtruderVelocity = $machineState.liveExtruderVelocity;
    $: currentLayer = $machineState.currentLayer;
    $: totalLayers = $machineState.totalLayers;

    // Calculate volumetric flow (mm³/s) assuming 1.75mm filament
    // Cross-sectional area = π * (1.75/2)² ≈ 2.405 mm²
    const FILAMENT_CROSS_SECTION = Math.PI * Math.pow(1.75 / 2, 2);
    // Clamp to zero to prevent showing negative values during retraction
    $: volumetricFlow = Math.max(0, liveExtruderVelocity * FILAMENT_CROSS_SECTION);

    // Config values
    $: printControl = $configStore.printControl || { pauseMacro: 'PAUSE', resumeMacro: 'RESUME', cancelMacro: 'CANCEL_PRINT' };
    $: gaugeConfig = $configStore.gauges || { maxFlowRate: 30, flowRedline: 20, maxSpeedOverride: null, speedRedlinePercent: 90 };
    
    // Gauge calculations
    $: maxVelocity = $machineState.maxVelocity;
    $: speedMax = gaugeConfig.maxSpeedOverride || maxVelocity || 200;
    $: speedRedline = speedMax * (gaugeConfig.speedRedlinePercent / 100);

    // Derived status states
    $: isPrinting = status === 'PRINTING';
    $: isPaused = status === 'PAUSED';
    $: isStandby = status === 'STANDBY';
    $: isComplete = status === 'COMPLETE';
    $: isError = status === 'ERROR' || status === 'SHUTDOWN';
    $: isCancelled = status === 'CANCELLED';
    $: isBusy = status === 'BUSY';

    // Check if file bar should be clickable (whenever not actively printing)
    $: noFileLoaded = !printFilename || printFilename === '';
    $: fileBarClickable = !isPrinting;

    // Show controls only when printing or paused
    $: showControls = isPrinting || isPaused;

    // Determine LED states
    $: greenOn = isStandby || isComplete;
    $: orangeOn = isPaused || isPrinting || isBusy;
    $: redOn = isError || isCancelled || $hasErrors;

    // Format duration as HH:MM:SS
    const formatDuration = (seconds) => {
        if (!seconds || seconds <= 0) return '00:00:00';
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Format progress as percentage
    const formatProgress = (progress) => {
        if (!progress || progress <= 0) return '0%';
        return `${Math.round(progress * 100)}%`;
    };

    // Extract just filename from path
    const getFilename = (path) => {
        if (!path) return 'NO FILE';
        const parts = path.split('/');
        return parts[parts.length - 1] || 'NO FILE';
    };

    // Confirm dialog state
    let confirmOpen = false;
    let confirmMessage = '';
    let confirmCallback = () => {};

    const showConfirm = (message, callback) => {
        confirmMessage = message;
        confirmCallback = callback;
        confirmOpen = true;
    };

    // Control handlers
    const handlePause = () => {
        if ($configStore.printControl?.confirmPause) {
            showConfirm('Are you sure?', () => pausePrint(printControl.pauseMacro));
        } else {
            pausePrint(printControl.pauseMacro);
        }
    };

    const handleResume = () => {
        resumePrint(printControl.resumeMacro);
    };

    const handleCancel = () => {
        if ($configStore.printControl?.confirmCancel) {
            showConfirm('Are you sure?', () => cancelPrint(printControl.cancelMacro));
        } else {
            cancelPrint(printControl.cancelMacro);
        }
    };

    // Clear completed print status
    const handleClear = () => {
        clearPrintStatus();
    };

    // Reprint the last completed file
    const handleReprint = async () => {
        // Use the stored lastCompletedFilename or current printFilename
        const fileToReprint = lastCompletedFilename || printFilename;

        if (!fileToReprint) {
            console.error('No file available to reprint');
            return;
        }

        const doReprint = async () => {
            isReprinting = true;
            try {
                await startPrint(fileToReprint);
                console.log('Reprint started:', fileToReprint);
            } catch (e) {
                console.error('Failed to start reprint:', e);
            } finally {
                isReprinting = false;
            }
        };

        if ($configStore.printControl?.confirmStartPrint ?? true) {
            showConfirm('Are you sure?', doReprint);
        } else {
            await doReprint();
        }
    };

    // Clear completed print status
    const handleClear = () => {
        clearPrintStatus();
    };

    // Reprint the last completed file
    const handleReprint = async () => {
        // Use the stored lastCompletedFilename or current printFilename
        const fileToReprint = lastCompletedFilename || printFilename;

        if (!fileToReprint) {
            console.error('No file available to reprint');
            return;
        }

        isReprinting = true;
        try {
            await startPrint(fileToReprint);
            console.log('Reprint started:', fileToReprint);
        } catch (e) {
            console.error('Failed to start reprint:', e);
        } finally {
            isReprinting = false;
        }
    };

    // Handle file bar click
    const handleFileBarClick = () => {
        if (fileBarClickable) {
            filePickerOpen = true;
        }
    };

    // Handle file loaded from picker (without starting print)
    const handleFileLoaded = (event) => {
        // The file is loaded, the machineState will update via websocket
        console.log('File loaded:', event.detail.path);
    };

    // Handle print started from picker
    const handlePrintStarted = (event) => {
        // Print started, the machineState will update via websocket
        console.log('Print started:', event.detail.path);
    };
</script>

<PanelModule title="PRINT STATUS">
    <div class="status-panel">
        <!-- Status Indicator Row -->
        <div class="status-row">
            <div class="status-leds">
                <div class="led-group">
                    <Led color="green" on={greenOn} />
                    <span class="led-label">RDY</span>
                </div>
                <div class="led-group">
                    <Led color="orange" on={orangeOn} />
                    <span class="led-label">RUN</span>
                </div>
                <div class="led-group">
                    <Led color="red" on={redOn} />
                    <span class="led-label">ERR</span>
                </div>
            </div>
            <div class="status-text">{status}</div>
        </div>

        <!-- File Info -->
        <button 
            class="info-section file-bar" 
            class:clickable={fileBarClickable}
            on:click={handleFileBarClick}
            disabled={!fileBarClickable}
        >
            <div class="info-row">
                <span class="info-label">FILE:</span>
                <span class="info-value filename" title={printFilename}>
                    {getFilename(printFilename)}
                    {#if fileBarClickable}
                        <span class="click-hint">▸</span>
                    {/if}
                </span>
            </div>
        </button>

        <!-- Print Progress (only when printing or paused) -->
        {#if showControls || isComplete}
            <div class="progress-section">
                <div class="progress-row">
                    <span class="info-label">PROGRESS:</span>
                    <span class="info-value">{formatProgress(printProgress)}</span>
                </div>
                <div class="progress-bar-container">
                    <div class="progress-bar" style="width: {printProgress * 100}%"></div>
                </div>
                <div class="progress-row">
                    <span class="info-label">TIME:</span>
                    <span class="info-value">{formatDuration(printDuration)}</span>
                </div>
                {#if totalLayers > 0}
                    <div class="progress-row">
                        <span class="info-label">LAYER:</span>
                        <span class="info-value">{currentLayer}/{totalLayers}</span>
                    </div>
                {/if}
            </div>
        {/if}

        <!-- Speed/Flow Gauges -->
        <div class="gauges-section">
            <RetroGauge
                value={liveSpeed}
                max={speedMax}
                redline={speedRedline}
                label="SPEED"
                unit="mm/s"
                hideGraphics={!($configStore.gauges?.showGaugeGraphics ?? true)}
            />
            <RetroGauge
                value={volumetricFlow}
                max={gaugeConfig.maxFlowRate}
                redline={gaugeConfig.flowRedline}
                label="FLOW"
                unit="mm³/s"
                hideGraphics={!($configStore.gauges?.showGaugeGraphics ?? true)}
            />
        </div>

        <!-- Controls (only during active print) -->
        {#if showControls}
            <div class="control-buttons">
                {#if isPrinting}
                    <CncButton variant="home" on:click={handlePause}>
                        PAUSE
                    </CncButton>
                {:else if isPaused}
                    <CncButton variant="action" on:click={handleResume}>
                        RESUME
                    </CncButton>
                {/if}
                <CncButton variant="danger" on:click={handleCancel}>
                    CANCEL
                </CncButton>
            </div>
        {/if}

        <!-- Completion Actions (only when print is complete) -->
        {#if isComplete}
            <div class="completion-buttons">
                <CncButton variant="dark" on:click={handleClear}>
                    CLEAR
                </CncButton>
                <CncButton
                    variant="action"
                    on:click={handleReprint}
                    disabled={isReprinting || !(lastCompletedFilename || printFilename)}
                >
                    {isReprinting ? 'STARTING...' : 'REPRINT'}
                </CncButton>
            </div>
        {/if}

        {#if isCancelled}
            <div class="completion-buttons">
                <CncButton variant="dark" on:click={handleClear}>
                    CLEAR
                </CncButton>
                <CncButton
                    variant="action"
                    on:click={handleReprint}
                    disabled={isReprinting || !(lastCompletedFilename || printFilename)}
                >
                    {isReprinting ? 'STARTING...' : 'REPRINT'}
                </CncButton>
            </div>
        {/if}
    </div>

    <!-- File Picker Modal -->
    <FilePickerModal 
        bind:isOpen={filePickerOpen}
        on:fileLoaded={handleFileLoaded}
        on:printStarted={handlePrintStarted}
        on:close={() => filePickerOpen = false}
    />

    <!-- Confirm Dialog -->
    <ConfirmDialog
        bind:isOpen={confirmOpen}
        message={confirmMessage}
        onConfirm={confirmCallback}
        onCancel={() => {}}
    />
</PanelModule>

<style>
    .status-panel {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    /* Status Row */
    .status-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px;
        background: #0a0a0a;
        border: 2px solid #333;
    }

    .status-leds {
        display: flex;
        gap: 16px;
    }

    .led-group {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
    }

    .led-label {
        font-family: "Share Tech Mono", monospace;
        font-size: 10px;
        color: #666;
        letter-spacing: 1px;
    }

    .status-text {
        font-family: "Orbitron", monospace;
        font-size: 18px;
        font-weight: 700;
        color: var(--retro-green);
        letter-spacing: 2px;
    }

    /* Info Section */
    .info-section {
        padding: 12px;
        background: #0f0f0f;
        border: 2px solid #2a2a2a;
        width: 100%;
        text-align: left;
    }

    .info-section.file-bar {
        cursor: default;
        transition: all 0.2s ease;
    }

    .info-section.file-bar.clickable {
        cursor: pointer;
        border-color: #3a3a3a;
    }

    .info-section.file-bar.clickable:hover {
        background: #1a1a1a;
        border-color: var(--retro-green-dim);
    }

    .info-section.file-bar.clickable:active {
        background: #0a0a0a;
    }

    .info-section.file-bar:disabled {
        cursor: default;
    }

    .click-hint {
        color: var(--retro-green-dim);
        font-size: 10px;
        margin-left: 8px;
        animation: pulse 2s infinite;
    }

    @keyframes pulse {
        0%, 100% { opacity: 0.5; }
        50% { opacity: 1; }
    }

    .info-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .info-label {
        font-family: "Orbitron", monospace;
        font-size: 12px;
        color: #666;
        letter-spacing: 1px;
    }

    .info-value {
        font-family: "Share Tech Mono", monospace;
        font-size: 14px;
        color: var(--retro-orange);
    }

    .info-value.filename {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        text-align: right;
    }

    /* Progress Section */
    .progress-section {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px;
        background: #0f0f0f;
        border: 2px solid #2a2a2a;
    }

    .progress-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .progress-bar-container {
        width: 100%;
        height: 12px;
        background: #1a1a1a;
        border: 2px solid #333;
        overflow: hidden;
    }

    .progress-bar {
        height: 100%;
        background: linear-gradient(90deg, var(--retro-green-dim) 0%, var(--retro-green) 100%);
        box-shadow: 0 0 8px var(--retro-green);
        transition: width 0.3s ease;
    }

    /* Gauges Section */
    .gauges-section {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
    }

    /* Control Buttons */
    .control-buttons {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-top: 8px;
    }

    /* Completion Buttons (Clear/Reprint) */
    .completion-buttons {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-top: 8px;
    }
</style>
