<script>
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
    } from "../../../stores/configStore.js";
    import CncButton from "./CncButton.svelte";
    import ColorPicker from "./ColorPicker.svelte";
    import ConfirmDialog from "./ConfirmDialog.svelte";

    export let isOpen = false;
    export let onClose;

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
</script>

{#if isOpen}
    <div class="modal-overlay">
        <div class="modal-window">
            <div class="modal-header">
                <span>▸ CONFIGURATION</span>
                <button class="close-btn" on:click={save}>x</button>
            </div>

            <div class="modal-content">
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
                </div>

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

                <div class="actions">
                    <CncButton variant="action" on:click={save}>
                        SAVE CONFIGURATION
                    </CncButton>
                </div>
            </div>
        </div>
    </div>

    <ConfirmDialog
        bind:isOpen={confirmOpen}
        title="CONFIRM DELETE"
        message={confirmMessage}
        onConfirm={confirmCallback}
        onCancel={() => (confirmOpen = false)}
    />
{/if}

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
        align-items: center;
        backdrop-filter: blur(4px);
    }

    .modal-window {
        width: 900px;
        max-height: 90vh;
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

    .close-btn {
        background: none;
        border: none;
        color: #666;
        font-size: 24px;
        cursor: pointer;
    }
    .close-btn:hover {
        color: #fff;
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
</style>
