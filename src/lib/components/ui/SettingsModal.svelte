<script>
    import { onDestroy } from "svelte";
    import {
        configStore,
        updateTitle,
        updateServerConfig,
        createPanel,
        deletePanel,
        renamePanel,
        addMacroToPanel,
        deleteMacro,
        updateMacro,
        // Presets
        addPreset,
        deletePreset,
        updatePreset,
        // Filament
        updateFilamentConfig,
        // Print Control
        updatePrintControlConfig,
        // Console
        updateConsoleConfig,
        // Gauges
        updateGaugeConfig,
        // Cameras
        addCamera,
        deleteCamera,
        updateCamera,
        // Power
        updatePowerConfig,
        // Import/Export
        exportConfig,
        importConfig,
    } from "../../../stores/configStore.js";
    import { availablePowerDevices } from "../../../stores/powerStore.js";
    import CncButton from "./CncButton.svelte";
    import ColorPicker from "./ColorPicker.svelte";
    import ConfirmDialog from "./ConfirmDialog.svelte";
    import SystemInfo from "./SystemInfo.svelte";

    export let isOpen = false;
    export let onClose;

    $: if (typeof document !== "undefined") {
        document.body.style.overflow = isOpen ? "hidden" : "";
    }

    onDestroy(() => {
        if (typeof document !== "undefined") {
            document.body.style.overflow = "";
        }
    });

    // Build information injected at build time
    const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
    const gitCommit = typeof __GIT_COMMIT__ !== 'undefined' ? __GIT_COMMIT__ : 'dev';
    const gitTag = typeof __GIT_TAG__ !== 'undefined' ? __GIT_TAG__ : '';
    
    // Determine display version (priority: tag > version > commit)
    const displayVersion = gitTag || appVersion || gitCommit;
    const repoUrl = 'https://github.com/justinh-rahb/moonraker-cnc';
    const versionUrl = gitTag 
        ? `${repoUrl}/releases/tag/${gitTag}`
        : `${repoUrl}/commit/${gitCommit}`;

    $: panels = $configStore.panels;

    // Confirm dialog state
    let confirmOpen = false;
    let confirmMessage = "";
    let confirmCallback = () => {};

    const showConfirm = (message, callback) => {
        confirmMessage = message;
        confirmCallback = callback;
        confirmOpen = true;
    };

    const save = () => {
        // configStore auto-saves on change, so just close
        if (onClose) onClose();
    };

    const handleCreatePanel = () => {
        createPanel("NEW PANEL");
    };

    const handleDeletePanel = (panelId) => {
        showConfirm("Delete this panel and all its macros?", () => {
            deletePanel(panelId);
        });
    };

    const handleAddMacro = (panelId) => {
        addMacroToPanel(panelId, {
            label: "NEW MACRO",
            gcode: "",
            color: "action",
        });
    };

    const handleDeleteMacro = (panelId, macroId) => {
        deleteMacro(panelId, macroId);
    };

    const handleCreatePreset = () => {
        addPreset();
    };

    const handleDeletePreset = (id) => {
        showConfirm("Delete this preset?", () => {
            deletePreset(id);
        });
    };

    // Camera handlers
    const handleCreateCamera = () => {
        addCamera();
    };

    const handleDeleteCamera = (id) => {
        showConfirm("Delete this camera?", () => {
            deleteCamera(id);
        });
    };

    // Import/Export handlers
    let fileInput;
    let importError = "";

    const handleExport = () => {
        const configJson = exportConfig();
        const blob = new Blob([configJson], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        // Sanitize machine title for filename: lowercase, replace spaces with hyphens, remove special chars
        const sanitizedTitle = $configStore.title
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');
        const date = new Date().toISOString().split("T")[0];
        a.download = `${sanitizedTitle}-${date}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleImportClick = () => {
        fileInput?.click();
    };

    const handleFileSelect = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        importError = "";
        const reader = new FileReader();
        reader.onload = (e) => {
            const result = importConfig(e.target?.result);
            if (!result.success) {
                importError = result.error || "Failed to import configuration";
            }
            // Reset file input so same file can be selected again
            if (fileInput) fileInput.value = "";
        };
        reader.onerror = () => {
            importError = "Failed to read file";
            if (fileInput) fileInput.value = "";
        };
        reader.readAsText(file);
    };

    // Tabs
    const tabs = ["General", "Interface", "Macros", "Panels", "Cameras", "Sysinfo"];
    let currentTab = "General";
</script>

{#if isOpen}
    <div class="modal-overlay">
        <div class="modal-window">
            <div class="modal-header">
                <span>▸ CONFIGURATION</span>
                <div class="header-actions">
                    <button class="save-icon-btn" on:click={save} title="Save & Close">
                        SAVE
                    </button>
                    <button class="close-btn" on:click={onClose}>x</button>
                </div>
            </div>

            <div class="tabs">
                {#each tabs as tab}
                    <button
                        class="tab-btn"
                        class:active={currentTab === tab}
                        on:click={() => (currentTab = tab)}
                    >
                        {tab.toUpperCase()}
                    </button>
                {/each}
            </div>

            <div class="modal-content">
                {#if currentTab === "General"}
                    <div class="section-title">GENERAL</div>
                    <div class="input-group" style="margin-bottom: 25px;">
                    <label>MACHINE TITLE</label>
                    <input
                        type="text"
                        value={$configStore.title}
                        on:input={(e) => updateTitle(e.target.value)}
                    />
                </div>

                <div class="checkbox-group" style="margin-bottom: 25px;">
                    <label>
                        <input
                            type="checkbox"
                            checked={$configStore.server.autoConnect}
                            on:change={(e) =>
                                updateServerConfig(
                                    $configStore.server.ip,
                                    $configStore.server.port,
                                    e.target.checked,
                                )}
                        />
                        AUTOCONNECT ON STARTUP
                    </label>
                </div>

                <div class="import-export-group" style="margin-bottom: 25px;">
                    <input
                        type="file"
                        accept=".json"
                        bind:this={fileInput}
                        on:change={handleFileSelect}
                        style="display: none;"
                    />
                    <button class="import-btn" on:click={handleImportClick}>
                        IMPORT CONFIG
                    </button>
                    <button class="export-btn" on:click={handleExport}>
                        EXPORT CONFIG
                    </button>
                    {#if importError}
                        <div class="import-error">{importError}</div>
                    {/if}
                </div>
                {/if}

                {#if currentTab === "Macros"}
                <div class="section-title">PRINT CONTROL MACROS</div>
                <div class="presets-container" style="margin-bottom: 25px;">
                    <div class="macro-row">
                        <div class="input-col main">
                            <label>PAUSE MACRO</label>
                            <input
                                type="text"
                                value={$configStore.printControl?.pauseMacro ||
                                    "PAUSE"}
                                on:input={(e) =>
                                    updatePrintControlConfig({
                                        pauseMacro: e.target.value,
                                    })}
                            />
                        </div>
                        <div class="input-col main">
                            <label>RESUME MACRO</label>
                            <input
                                type="text"
                                value={$configStore.printControl?.resumeMacro ||
                                    "RESUME"}
                                on:input={(e) =>
                                    updatePrintControlConfig({
                                        resumeMacro: e.target.value,
                                    })}
                            />
                        </div>
                        <div class="input-col main">
                            <label>CANCEL MACRO</label>
                            <input
                                type="text"
                                value={$configStore.printControl?.cancelMacro ||
                                    "CANCEL_PRINT"}
                                on:input={(e) =>
                                    updatePrintControlConfig({
                                        cancelMacro: e.target.value,
                                    })}
                            />
                        </div>
                    </div>
                    <div class="checkbox-group" style="margin-top: 15px;">
                        <label>
                            <input
                                type="checkbox"
                                checked={$configStore.printControl?.confirmPause ?? false}
                                on:change={(e) =>
                                    updatePrintControlConfig({
                                        confirmPause: e.target.checked,
                                    })}
                            />
                            CONFIRM BEFORE PAUSING
                        </label>
                        <label>
                            <input
                                type="checkbox"
                                checked={$configStore.printControl?.confirmCancel ?? true}
                                on:change={(e) =>
                                    updatePrintControlConfig({
                                        confirmCancel: e.target.checked,
                                    })}
                            />
                            CONFIRM BEFORE CANCELLING
                        </label>
                        <label>
                            <input
                                type="checkbox"
                                checked={$configStore.printControl?.confirmStartPrint ?? true}
                                on:change={(e) =>
                                    updatePrintControlConfig({
                                        confirmStartPrint: e.target.checked,
                                    })}
                            />
                            CONFIRM BEFORE STARTING PRINT
                        </label>
                    </div>
                </div>
                {/if}

                {#if currentTab === "General"}
                <div class="section-title">POWER DEVICE</div>
                <div class="presets-container" style="margin-bottom: 25px;">
                    <div class="macro-row">
                        <div class="input-col main">
                            <label>SELECTED DEVICE</label>
                            <select
                                value={$configStore.power?.selectedDevice || 'OFF'}
                                on:change={(e) =>
                                    updatePowerConfig({
                                        selectedDevice: e.target.value,
                                    })}
                            >
                                <option value="OFF">OFF (Hidden)</option>
                                <option value="AUTO">AUTO (Recommended)</option>
                                {#each $availablePowerDevices as deviceName}
                                    <option value={deviceName}>{deviceName}</option>
                                {/each}
                            </select>
                        </div>
                    </div>
                    <div class="checkbox-group" style="margin-top: 15px;">
                        <label>
                            <input
                                type="checkbox"
                                checked={$configStore.power?.confirmToggle ?? true}
                                on:change={(e) =>
                                    updatePowerConfig({
                                        confirmToggle: e.target.checked,
                                    })}
                            />
                            CONFIRM POWER TOGGLE
                        </label>
                    </div>
                </div>
                {/if}

                {#if currentTab === "Macros"}
                <div class="section-title">FILAMENT MACROS</div>
                <div class="presets-container" style="margin-bottom: 25px;">
                    <div class="macro-row">
                        <div class="input-col main">
                            <label>LOAD MACRO</label>
                            <input
                                type="text"
                                value={$configStore.filament?.loadMacro ||
                                    "LOAD_FILAMENT"}
                                on:input={(e) =>
                                    updateFilamentConfig({
                                        loadMacro: e.target.value,
                                    })}
                            />
                        </div>
                        <div class="input-col main">
                            <label>UNLOAD MACRO</label>
                            <input
                                type="text"
                                value={$configStore.filament?.unloadMacro ||
                                    "UNLOAD_FILAMENT"}
                                on:input={(e) =>
                                    updateFilamentConfig({
                                        unloadMacro: e.target.value,
                                    })}
                            />
                        </div>
                    </div>
                    <div class="macro-row">
                        <div class="input-col">
                            <label>DISTANCE PARAM</label>
                            <input
                                type="text"
                                value={$configStore.filament?.distanceParam ||
                                    "DISTANCE"}
                                on:input={(e) =>
                                    updateFilamentConfig({
                                        distanceParam: e.target.value,
                                    })}
                            />
                        </div>
                        <div class="input-col">
                            <label>SPEED PARAM</label>
                            <input
                                type="text"
                                value={$configStore.filament?.speedParam ||
                                    "SPEED"}
                                on:input={(e) =>
                                    updateFilamentConfig({
                                        speedParam: e.target.value,
                                    })}
                            />
                        </div>
                        <div class="input-col">
                            <label>TEMP PARAM</label>
                            <input
                                type="text"
                                value={$configStore.filament?.tempParam ||
                                    "TEMP"}
                                on:input={(e) =>
                                    updateFilamentConfig({
                                        tempParam: e.target.value,
                                    })}
                            />
                        </div>
                    </div>
                </div>
                {/if}

                {#if currentTab === "Interface"}
                <div class="section-title">GAUGE SETTINGS</div>
                <div class="presets-container" style="margin-bottom: 25px;">
                    <div class="macro-row">
                        <div class="input-col">
                            <label>MAX FLOW RATE (mm³/s)</label>
                            <input
                                type="number"
                                min="1"
                                max="100"
                                step="1"
                                value={$configStore.gauges?.maxFlowRate ?? 30}
                                on:input={(e) =>
                                    updateGaugeConfig({
                                        maxFlowRate: parseFloat(e.target.value) || 30,
                                    })}
                            />
                            <div class="help-text">Maximum value for flow gauge scale</div>
                        </div>
                        <div class="input-col">
                            <label>FLOW REDLINE (mm³/s)</label>
                            <input
                                type="number"
                                min="1"
                                max="100"
                                step="1"
                                value={$configStore.gauges?.flowRedline ?? 20}
                                on:input={(e) =>
                                    updateGaugeConfig({
                                        flowRedline: parseFloat(e.target.value) || 20,
                                    })}
                            />
                            <div class="help-text">Warning threshold for flow gauge</div>
                        </div>
                    </div>
                    <div class="macro-row" style="margin-top: 15px;">
                        <div class="input-col">
                            <label>MAX SPEED OVERRIDE (mm/s)</label>
                            <input
                                type="number"
                                min="1"
                                max="1000"
                                step="10"
                                placeholder="Auto (from machine limits)"
                                value={$configStore.gauges?.maxSpeedOverride ?? ''}
                                on:input={(e) =>
                                    updateGaugeConfig({
                                        maxSpeedOverride: e.target.value ? parseFloat(e.target.value) : null,
                                    })}
                            />
                            <div class="help-text">Leave empty to use machine max velocity</div>
                        </div>
                        <div class="input-col">
                            <label>SPEED REDLINE (%)</label>
                            <input
                                type="number"
                                min="50"
                                max="100"
                                step="5"
                                value={$configStore.gauges?.speedRedlinePercent ?? 90}
                                on:input={(e) =>
                                    updateGaugeConfig({
                                        speedRedlinePercent: parseFloat(e.target.value) || 90,
                                    })}
                            />
                            <div class="help-text">Redline as % of max speed</div>
                        </div>
                    </div>
                    <div class="checkbox-group" style="margin-top: 15px;">
                        <label>
                            <input
                                type="checkbox"
                                checked={$configStore.gauges?.showGaugeGraphics ?? true}
                                on:change={(e) =>
                                    updateGaugeConfig({
                                        showGaugeGraphics: e.target.checked,
                                    })}
                            />
                            SHOW GAUGE GRAPHICS
                        </label>
                        <div class="help-text" style="margin-left: 24px; margin-top: 4px;">
                            When disabled, only numeric values are displayed
                        </div>
                    </div>
                </div>
                {/if}

                {#if currentTab === "General"}
                <div class="section-title">CONSOLE SETTINGS</div>
                <div class="presets-container" style="margin-bottom: 25px;">
                    <div class="checkbox-group">
                        <label>
                            <input
                                type="checkbox"
                                checked={$configStore.console?.newestFirst ?? true}
                                on:change={(e) =>
                                    updateConsoleConfig({
                                        newestFirst: e.target.checked,
                                    })}
                            />
                            NEWEST MESSAGES FIRST (CHAT STYLE)
                        </label>
                        <div class="help-text">
                            When enabled: Input on top, newest messages appear first.<br />
                            When disabled: Traditional terminal (input on bottom, oldest first).
                        </div>
                    </div>
                    <div class="input-group" style="margin-top: 15px;">
                        <label>MAX CONSOLE HISTORY</label>
                        <input
                            type="number"
                            min="100"
                            max="1000"
                            value={$configStore.console?.maxHistory ?? 500}
                            on:input={(e) =>
                                updateConsoleConfig({
                                    maxHistory: parseInt(e.target.value) || 500,
                                })}
                        />
                        <div class="help-text">Number of messages to keep (100-1000)</div>
                    </div>
                </div>
                {/if}

                {#if currentTab === "Interface"}
                <div class="section-title">TEMPERATURE DISPLAY</div>

                <div class="checkbox-group" style="margin-bottom: 25px;">
                    <label style="margin-bottom: 15px;">
                        <input
                            type="checkbox"
                            checked={$configStore.temperature?.showGraph}
                            on:change={(e) =>
                                ($configStore.temperature = {
                                    ...$configStore.temperature,
                                    showGraph: e.target.checked,
                                })}
                        />
                        SHOW GRAPH
                    </label>
                    <label style="margin-bottom: 15px;">
                        <input
                            type="checkbox"
                            checked={$configStore.temperature?.autoscale}
                            on:change={(e) =>
                                ($configStore.temperature = {
                                    ...$configStore.temperature,
                                    autoscale: e.target.checked,
                                })}
                        />
                        AUTOSCALE GRAPH
                    </label>
                    <label>
                        <input
                            type="checkbox"
                            checked={$configStore.temperature?.hideMonitors}
                            on:change={(e) =>
                                ($configStore.temperature = {
                                    ...$configStore.temperature,
                                    hideMonitors: e.target.checked,
                                })}
                        />
                        HIDE MONITORS (HOST/MCU)
                    </label>
                </div>

                <div class="section-title">TEMPERATURE PRESETS</div>

                <div class="presets-container">
                    {#each $configStore.tempPresets || [] as preset (preset.id)}
                        <div class="preset-row">
                            <div class="input-col main">
                                <label>PRESET NAME</label>
                                <input
                                    type="text"
                                    value={preset.name}
                                    on:input={(e) =>
                                        updatePreset(preset.id, {
                                            name: e.target.value,
                                        })}
                                />
                            </div>
                            <div class="input-col small">
                                <label>BED °C</label>
                                <input
                                    type="number"
                                    value={preset.bed}
                                    on:input={(e) =>
                                        updatePreset(preset.id, {
                                            bed: parseInt(e.target.value) || 0,
                                        })}
                                />
                            </div>
                            <div class="input-col small">
                                <label>EXT. °C</label>
                                <input
                                    type="number"
                                    value={preset.extruder}
                                    on:input={(e) =>
                                        updatePreset(preset.id, {
                                            extruder:
                                                parseInt(e.target.value) || 0,
                                        })}
                                />
                            </div>
                            <button
                                type="button"
                                class="delete-macro-btn"
                                on:click|preventDefault|stopPropagation={() =>
                                    handleDeletePreset(preset.id)}
                                title="Delete Preset"
                            >
                                ✕
                            </button>
                        </div>
                    {/each}

                    <button
                        class="add-preset-btn"
                        on:click={handleCreatePreset}
                    >
                        + ADD PRESET
                    </button>
                </div>
                {/if}

                {#if currentTab === "Panels"}
                <div class="section-title">MACRO PANELS</div>

                <div class="panels-container">
                    {#each panels as panel (panel.id)}
                        <div class="panel-section">
                            <div class="panel-header-row">
                                <input
                                    type="text"
                                    class="panel-title-input"
                                    value={panel.title}
                                    on:input={(e) =>
                                        renamePanel(panel.id, e.target.value)}
                                    on:keydown={(e) =>
                                        e.key === "Enter" && e.preventDefault()}
                                    placeholder="Panel Title"
                                />
                                <button
                                    type="button"
                                    class:delete-panel-btn={true}
                                    on:click|preventDefault|stopPropagation={() =>
                                        handleDeletePanel(panel.id)}
                                    title="Delete Panel"
                                >
                                    🗑️
                                </button>
                            </div>

                            <div class="macro-list">
                                {#each panel.macros as macro (macro.id)}
                                    <div class="macro-row">
                                        <div class="input-col">
                                            <label>LABEL</label>
                                            <input
                                                type="text"
                                                value={macro.label}
                                                on:input={(e) =>
                                                    updateMacro(
                                                        panel.id,
                                                        macro.id,
                                                        {
                                                            label: e.target
                                                                .value,
                                                        },
                                                    )}
                                            />
                                        </div>
                                        <div class="input-col main">
                                            <label>G-CODE COMMAND</label>
                                            <input
                                                type="text"
                                                value={macro.gcode}
                                                on:input={(e) =>
                                                    updateMacro(
                                                        panel.id,
                                                        macro.id,
                                                        {
                                                            gcode: e.target
                                                                .value,
                                                        },
                                                    )}
                                            />
                                        </div>
                                        <div class="input-col">
                                            <label>COLOR</label>
                                            <ColorPicker
                                                selectedColor={macro.color}
                                                onChange={(color) =>
                                                    updateMacro(
                                                        panel.id,
                                                        macro.id,
                                                        {
                                                            color,
                                                        },
                                                    )}
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            class="delete-macro-btn"
                                            on:click|preventDefault|stopPropagation={() =>
                                                handleDeleteMacro(
                                                    panel.id,
                                                    macro.id,
                                                )}
                                            title="Delete Macro"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                {/each}
                            </div>

                            <button
                                class="add-macro-btn"
                                on:click={() => handleAddMacro(panel.id)}
                            >
                                + ADD MACRO
                            </button>
                        </div>
                    {/each}
                </div>

                <button class="create-panel-btn" on:click={handleCreatePanel}>
                    + CREATE NEW PANEL
                </button>
                {/if}

                {#if currentTab === "Cameras"}
                <div class="section-title">CAMERA SETTINGS</div>

                <div class="cameras-container">
                    {#each $configStore.cameras || [] as camera (camera.id)}
                        <div class="camera-section">
                            <div class="camera-header-row">
                                <input
                                    type="text"
                                    class="camera-name-input"
                                    value={camera.name}
                                    on:input={(e) =>
                                        updateCamera(camera.id, { name: e.target.value })}
                                    placeholder="Camera Name"
                                />
                                <label class="checkbox-inline">
                                    <input
                                        type="checkbox"
                                        checked={camera.enabled}
                                        on:change={(e) =>
                                            updateCamera(camera.id, {
                                                enabled: e.target.checked,
                                            })}
                                    />
                                    ENABLED
                                </label>
                                <button
                                    type="button"
                                    class="delete-panel-btn"
                                    on:click|preventDefault|stopPropagation={() =>
                                        handleDeleteCamera(camera.id)}
                                    title="Delete Camera"
                                >
                                    ✕
                                </button>
                            </div>

                            <div class="camera-config">
                                <div class="camera-row">
                                    <div class="input-col main">
                                        <label>STREAM TYPE</label>
                                        <select
                                            value={camera.streamType || 'mjpeg'}
                                            on:change={(e) =>
                                                updateCamera(camera.id, {
                                                    streamType: e.target.value,
                                                })}
                                        >
                                            <option value="mjpeg">MJPEG (Default)</option>
                                            <option value="go2rtc">WebRTC (go2rtc)</option>
                                            <option value="camera-streamer">WebRTC (camera-streamer)</option>
                                        </select>
                                    </div>
                                </div>

                                <div class="input-group">
                                    <label>STREAM URL</label>
                                    <input
                                        type="text"
                                        value={camera.streamUrl}
                                        on:input={(e) =>
                                            updateCamera(camera.id, {
                                                streamUrl: e.target.value,
                                            })}
                                        placeholder={camera.streamType === 'go2rtc'
                                            ? "http://192.168.1.100:1984/api/webrtc?src=camera1"
                                            : camera.streamType === 'camera-streamer'
                                            ? "http://192.168.1.100:8080/webrtc"
                                            : "http://192.168.1.100/webcam/?action=stream"}
                                    />
                                </div>

                                <div class="input-group">
                                    <label>SNAPSHOT URL</label>
                                    <input
                                        type="text"
                                        value={camera.snapshotUrl}
                                        on:input={(e) =>
                                            updateCamera(camera.id, {
                                                snapshotUrl: e.target.value,
                                            })}
                                        placeholder="http://192.168.1.100/webcam/?action=snapshot"
                                    />
                                </div>

                                <div class="camera-row">
                                    <div class="input-col">
                                        <label>ASPECT RATIO</label>
                                        <select
                                            value={camera.aspectRatio}
                                            on:change={(e) =>
                                                updateCamera(camera.id, {
                                                    aspectRatio: e.target.value,
                                                })}
                                        >
                                            <option value="16:9">16:9</option>
                                            <option value="4:3">4:3</option>
                                            <option value="1:1">1:1</option>
                                            <option value="21:9">21:9</option>
                                        </select>
                                    </div>

                                    <div class="input-col">
                                        <label>ROTATION</label>
                                        <select
                                            value={camera.rotation}
                                            on:change={(e) =>
                                                updateCamera(camera.id, {
                                                    rotation: parseInt(e.target.value),
                                                })}
                                        >
                                            <option value="0">0°</option>
                                            <option value="90">90°</option>
                                            <option value="180">180°</option>
                                            <option value="270">270°</option>
                                        </select>
                                    </div>
                                </div>

                                <div class="camera-row">
                                    {#if !camera.streamType || camera.streamType === 'mjpeg'}
                                        <div class="input-col">
                                            <label>TARGET REFRESH RATE (FPS)</label>
                                            <input
                                                type="number"
                                                min="1"
                                                max="30"
                                                value={camera.targetRefreshRate || 5}
                                                on:input={(e) =>
                                                    updateCamera(camera.id, {
                                                        targetRefreshRate: parseInt(e.target.value) || 5,
                                                    })}
                                            />
                                        </div>
                                    {/if}
                                </div>

                                <div class="checkbox-group">
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={camera.flipH}
                                            on:change={(e) =>
                                                updateCamera(camera.id, {
                                                    flipH: e.target.checked,
                                                })}
                                        />
                                        FLIP HORIZONTAL
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={camera.flipV}
                                            on:change={(e) =>
                                                updateCamera(camera.id, {
                                                    flipV: e.target.checked,
                                                })}
                                        />
                                        FLIP VERTICAL
                                    </label>
                                    {#if !camera.streamType || camera.streamType === 'mjpeg'}
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={camera.showFps}
                                                on:change={(e) =>
                                                    updateCamera(camera.id, {
                                                        showFps: e.target.checked,
                                                    })}
                                            />
                                            SHOW FPS
                                        </label>
                                    {/if}
                                </div>
                            </div>
                        </div>
                    {/each}
                </div>

                <button class="create-panel-btn" on:click={handleCreateCamera}>
                    + ADD CAMERA
                </button>
                {/if}

                {#if currentTab === "Sysinfo"}
                <div class="info-section">
                    <div class="section-title">APPLICATION INFO</div>
                    <div class="info-grid">
                        <div class="info-row">
                            <span class="info-label">VERSION:</span>
                            <span class="info-value">
                                <a href={versionUrl} target="_blank" rel="noopener noreferrer" class="version-link">
                                    {displayVersion}
                                </a>
                            </span>
                        </div>
                        {#if gitCommit !== displayVersion && gitCommit !== 'dev'}
                            <div class="info-row">
                                <span class="info-label">COMMIT:</span>
                                <span class="info-value">
                                    <a href="{repoUrl}/commit/{gitCommit}" target="_blank" rel="noopener noreferrer" class="version-link">
                                        {gitCommit}
                                    </a>
                                </span>
                            </div>
                        {/if}
                        <div class="info-row">
                            <span class="info-label">REPOSITORY:</span>
                            <span class="info-value">
                                <a href={repoUrl} target="_blank" rel="noopener noreferrer" class="version-link">
                                    GitHub
                                </a>
                            </span>
                        </div>
                    </div>
                </div>

                <!-- System Info Section -->
                <SystemInfo />
                {/if}
            </div>
        </div>
    </div>
{/if}

<ConfirmDialog
    bind:isOpen={confirmOpen}
    title="CONFIRM DELETE"
    message={confirmMessage}
    onConfirm={confirmCallback}
    onCancel={() => (confirmOpen = false)}
/>

<style>
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.9);
        z-index: 2000;
        display: flex;
        justify-content: center;
        align-items: flex-start;
        padding-top: 50px;
        backdrop-filter: blur(4px);
    }

    .modal-window {
        width: 900px;
        max-height: calc(100vh - 100px);
        background: var(--bg-module);
        border: 4px solid var(--border-color);
        box-shadow:
            0 0 50px rgba(0, 255, 0, 0.1),
            0 0 0 2px #000;
        display: flex;
        flex-direction: column;
    }

    .modal-header {
        font-family: "Orbitron", monospace;
        font-size: 20px;
        font-weight: 900;
        color: var(--retro-green);
        padding: 15px;
        background: #000;
        border-bottom: 2px solid var(--border-color);
        letter-spacing: 2px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .header-actions {
        display: flex;
        align-items: center;
        gap: 15px;
    }

    .save-icon-btn {
        background: linear-gradient(
            180deg,
            var(--retro-orange) 0%,
            var(--retro-orange-dim) 100%
        );
        border: 1px solid #ff8833;
        color: #000;
        padding: 5px 15px;
        font-family: "Orbitron", monospace;
        font-size: 12px;
        font-weight: bold;
        cursor: pointer;
        letter-spacing: 1px;
    }

    .save-icon-btn:hover {
        background: linear-gradient(180deg, #ff7722 0%, #dd6611 100%);
        color: var(--green);
    }

    .close-btn {
        background: none;
        border: none;
        color: var(--retro-green);
        font-size: 24px;
        cursor: pointer;
        padding: 0 5px;
        line-height: 1;
    }

    .close-btn:hover {
        color: var(--retro-red);
    }

    .modal-content {
        padding: 30px;
        overflow-y: auto;
    }

    .section-title {
        color: var(--retro-orange);
        font-weight: bold;
        margin-bottom: 15px;
        border-bottom: 1px solid #333;
        padding-bottom: 5px;
        font-size: 14px;
    }

    .panels-container {
        display: flex;
        flex-direction: column;
        gap: 30px;
        margin-bottom: 20px;
    }

    .panel-section {
        background: #0a0a0a;
        border: 2px solid #333;
        padding: 15px;
    }

    .panel-header-row {
        display: flex;
        gap: 10px;
        margin-bottom: 15px;
        align-items: center;
    }

    .panel-title-input {
        flex: 1;
        background: #000;
        border: 2px solid var(--retro-orange);
        color: var(--retro-orange);
        padding: 10px;
        font-family: "Orbitron", monospace;
        font-size: 16px;
        font-weight: bold;
    }

    .panel-title-input:focus {
        border-color: var(--retro-green);
        outline: none;
    }

    .delete-panel-btn {
        background: #440000;
        border: 2px solid #660000;
        color: #ff4444;
        padding: 10px 15px;
        cursor: pointer;
        font-size: 16px;
    }

    .delete-panel-btn:hover {
        background: #660000;
    }

    .macro-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-bottom: 15px;
    }

    .macro-row {
        display: flex;
        gap: 10px;
        align-items: flex-end;
        background: #151515;
        padding: 10px;
        border: 1px solid #222;
    }

    .input-col {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    .input-col.main {
        flex: 1;
    }

    label {
        font-size: 10px;
        color: #666;
    }

    input {
        background: #000;
        border: 1px solid #333;
        color: var(--retro-green);
        padding: 8px;
        font-family: "Share Tech Mono", monospace;
        width: 100%;
    }
    input:focus {
        border-color: var(--retro-green);
        outline: none;
    }

    .delete-macro-btn {
        background: none;
        border: 1px solid #660000;
        color: #ff4444;
        padding: 8px 12px;
        cursor: pointer;
        font-size: 14px;
        align-self: flex-end;
    }

    .delete-macro-btn:hover {
        background: #440000;
    }

    .add-macro-btn {
        background: #004400;
        border: 2px solid #006600;
        color: var(--retro-green);
        padding: 10px;
        font-family: "Orbitron", monospace;
        font-size: 12px;
        cursor: pointer;
        width: 100%;
        letter-spacing: 1px;
    }

    .add-macro-btn:hover {
        background: #006600;
    }

    .create-panel-btn {
        background: linear-gradient(
            180deg,
            var(--retro-orange) 0%,
            var(--retro-orange-dim) 100%
        );
        border: 3px solid #ff8833;
        color: #000;
        padding: 15px;
        font-family: "Orbitron", monospace;
        font-size: 14px;
        font-weight: bold;
        cursor: pointer;
        width: 100%;
        letter-spacing: 2px;
        margin-bottom: 25px;
    }

    .create-panel-btn:hover {
        background: linear-gradient(180deg, #ff7722 0%, #dd6611 100%);
    }

    .checkbox-group label {
        display: flex;
        align-items: center;
        gap: 10px;
        cursor: pointer;
        color: var(--retro-orange);
        font-size: 12px;
        font-weight: bold;
    }

    .checkbox-group input {
        width: 18px;
        height: 18px;
        padding: 0;
        margin: 0;
    }

    .input-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .input-group label {
        font-size: 12px;
        color: #666;
    }
    .input-col.small {
        width: 80px;
        flex: none;
    }

    .preset-row {
        display: flex;
        gap: 10px;
        align-items: flex-end;
        background: #151515;
        padding: 10px;
        border: 1px solid #222;
        margin-bottom: 10px;
    }

    .add-preset-btn {
        background: #004400;
        border: 2px solid #006600;
        color: var(--retro-green);
        padding: 10px;
        font-family: "Orbitron", monospace;
        font-size: 12px;
        cursor: pointer;
        width: 100%;
        letter-spacing: 1px;
        margin-bottom: 30px;
    }

    .add-preset-btn:hover {
        background: #006600;
    }

    .help-text {
        font-size: 11px;
        color: #888;
        font-style: italic;
        margin-top: 4px;
        line-height: 1.4;
    }

    .import-export-group {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        align-items: center;
    }

    .import-btn,
    .export-btn {
        background: #1a1a1a;
        border: 2px solid #444;
        color: #aaa;
        padding: 10px 20px;
        font-family: "Orbitron", monospace;
        font-size: 11px;
        cursor: pointer;
        letter-spacing: 1px;
    }

    .import-btn:hover,
    .export-btn:hover {
        background: #2a2a2a;
        border-color: #666;
        color: #fff;
    }

    .import-error {
        width: 100%;
        color: #ff4444;
        font-size: 12px;
        margin-top: 5px;
    }

    /* Camera Settings Styles */
    .camera-actions {
        display: flex;
        gap: 15px;
        align-items: center;
        margin-bottom: 20px;
    }

    .camera-count {
        color: var(--retro-green);
        font-family: 'Share Tech Mono', monospace;
        font-size: 12px;
    }

    .cameras-container {
        display: flex;
        flex-direction: column;
        gap: 20px;
        margin-bottom: 20px;
    }

    .camera-section {
        background: #0a0a0a;
        border: 2px solid #333;
        padding: 15px;
    }

    .camera-header-row {
        display: flex;
        gap: 10px;
        margin-bottom: 15px;
        align-items: center;
    }

    .camera-name-input {
        flex: 1;
        background: #000;
        border: 2px solid var(--retro-orange);
        color: var(--retro-orange);
        padding: 10px;
        font-family: "Orbitron", monospace;
        font-size: 14px;
        font-weight: bold;
    }

    .camera-name-input:focus {
        border-color: var(--retro-green);
        outline: none;
    }

    .checkbox-inline {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: var(--retro-green);
        font-family: 'Orbitron', monospace;
        white-space: nowrap;
    }

    .checkbox-inline input[type="checkbox"] {
        width: auto;
    }

    .camera-config {
        display: flex;
        flex-direction: column;
        gap: 15px;
    }

    .camera-row {
        display: flex;
        gap: 15px;
    }

    select {
        background: #000;
        border: 1px solid #333;
        color: var(--retro-green);
        padding: 8px;
        font-family: "Share Tech Mono", monospace;
        width: 100%;
    }

    select:focus {
        border-color: var(--retro-green);
        outline: none;
    }

    /* System Info Section Styles */
    .info-section {
        background: #0a0a0a;
        border: 2px solid #333;
        padding: 15px;
        margin-bottom: 20px;
    }

    .info-grid {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .info-row {
        display: grid;
        grid-template-columns: 120px 1fr;
        gap: 15px;
        align-items: start;
        font-size: 12px;
    }

    .info-label {
        color: #666;
        font-family: 'Orbitron', monospace;
        font-weight: 600;
        letter-spacing: 0.5px;
    }

    .info-value {
        color: var(--retro-green);
        font-family: 'Share Tech Mono', monospace;
        word-break: break-word;
        line-height: 1.4;
    }

    .version-link {
        color: var(--retro-green);
        text-decoration: none;
        border-bottom: 1px solid transparent;
        transition: all 0.2s ease;
    }

    .version-link:hover {
        color: #fff;
        border-bottom-color: var(--retro-green);
    }

    /* Tab Styles */
    .tabs {
        display: flex;
        background: #000;
        border-bottom: 2px solid var(--border-color);
        padding: 0 15px;
    }

    .tab-btn {
        background: none;
        border: none;
        color: #666;
        padding: 15px 20px;
        font-family: "Orbitron", monospace;
        font-size: 12px;
        cursor: pointer;
        border-bottom: 3px solid transparent;
        transition: all 0.2s ease;
        letter-spacing: 1px;
    }

    .tab-btn:hover {
        color: #fff;
        background: #111;
    }

    .tab-btn.active {
        color: var(--retro-orange);
        border-bottom-color: var(--retro-orange);
        background: #151515;
    }
</style>
