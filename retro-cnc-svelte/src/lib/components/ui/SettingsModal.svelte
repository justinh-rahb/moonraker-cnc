<script>
    import {
        configStore,
        updateMacro,
        updateTitle,
        updateServerConfig,
    } from "../../../stores/configStore.js";
    import CncButton from "./CncButton.svelte";

    export let isOpen = false;
    export let onClose;

    $: macros = $configStore.macros;

    const save = () => {
        // configStore auto-saves on change, so just close
        if (onClose) onClose();
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

                <div class="section-title">MACRO BUTTONS</div>
                <div class="macro-list">
                    {#each macros as macro, i}
                        <div class="macro-row">
                            <span class="index">#{i + 1}</span>
                            <div class="input-col">
                                <label>LABEL</label>
                                <input
                                    type="text"
                                    bind:value={macro.label}
                                    on:input={() =>
                                        updateMacro(
                                            i,
                                            macro.label,
                                            macro.gcode,
                                        )}
                                />
                            </div>
                            <div class="input-col main">
                                <label>G-CODE COMMAND</label>
                                <input
                                    type="text"
                                    bind:value={macro.gcode}
                                    on:input={() =>
                                        updateMacro(
                                            i,
                                            macro.label,
                                            macro.gcode,
                                        )}
                                />
                            </div>
                        </div>
                    {/each}
                </div>

                <div class="actions">
                    <CncButton variant="action" on:click={save}
                        >SAVE CONFIGURATION</CncButton
                    >
                </div>
            </div>
        </div>
    </div>
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
        width: 800px;
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
    }

    .macro-list {
        display: flex;
        flex-direction: column;
        gap: 15px;
        margin-bottom: 25px;
    }

    .macro-row {
        display: flex;
        gap: 15px;
        align-items: center;
        background: #0a0a0a;
        padding: 10px;
        border: 1px solid #333;
    }

    .index {
        font-family: "Orbitron";
        color: #666;
        width: 30px;
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
</style>
