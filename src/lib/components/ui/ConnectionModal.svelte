<script>
    import { get } from "svelte/store";
    import { dialog } from "../../dialog.js";
    import {
        connectionState,
        lastError,
        connect,
    } from "../../../stores/websocket.js";
    import {
        configStore,
        updateServerConfig,
    } from "../../../stores/configStore.js";
    import { hostsOpen } from "../../../stores/uiStore.js";
    import { serverUrl } from "../../config.js";
    import ControlButton from "./ControlButton.svelte";
    import { onDestroy } from "svelte";

    // Local state for inputs
    let ipAddress = window.location.hostname || "localhost";
    let port = "7125";
    let autoConnect = false;
    let dismissed = false;
    $: if (state === "connected") dismissed = true;

    // Load from configStore when valid
    const unsubscribe = configStore.subscribe((val) => {
        if (val.server) {
            ipAddress = val.server.ip;
            port = val.server.port;
            autoConnect = val.server.autoConnect;
        }
    });

    $: state = $connectionState;
    $: error = $lastError;



    onDestroy(() => {
        unsubscribe();

    });

    const handleConnect = () => {
        if (state === "connecting") return;

        try {
            updateServerConfig(ipAddress, port, autoConnect);
            if (!["connecting","connected"].includes(get(connectionState))) connect(serverUrl($configStore.server));
        } catch(e) { lastError.set(e.message); }

    };

    const handleKeydown = (e) => {
        if (e.key === "Enter") handleConnect();
    };

</script>

{#if state !== "connected" && !dismissed}
    <div class="modal-overlay">
        <div class="modal-window" use:dialog={{label: "Connection", close: () => dismissed = true}}>
            <div class="modal-header">▸ SYSTEM CONNECTION</div>

            <div class="modal-content">
                <div class="status-line">
                    STATUS: <span class="status-text {state}"
                        >{state.toUpperCase()}</span
                    >
                </div>

                {#if error}
                    <div class="error-msg">ERROR: {error}</div>
                {/if}

                <div class="input-group">
                    <label for="ip">IP ADDRESS</label>
                    <input
                        id="ip"
                        type="text"
                        bind:value={ipAddress}
                        on:keydown={handleKeydown}
                        placeholder="192.168.1.100"
                    />
                </div>

                <div class="input-group">
                    <label for="port">PORT</label>
                    <input
                        id="port"
                        type="text"
                        bind:value={port}
                        on:keydown={handleKeydown}
                        placeholder="7125"
                    />
                </div>

                <div class="checkbox-group">
                    <label>
                        <input type="checkbox" bind:checked={autoConnect} />
                        AUTOCONNECT ON LOAD
                    </label>
                </div>

                <div class="secondary-actions">
                    <ControlButton on:click={() => ($hostsOpen = true)}>MANAGE HOSTS</ControlButton>
                    <ControlButton on:click={() => dismissed = true}>CONTINUE OFFLINE</ControlButton>
                </div>
                <div class="actions">
                    <ControlButton variant="action" disabled={state === "connecting"} on:click={handleConnect}>
                        {state === "connecting"
                            ? "CONNECTING..."
                            : "INITIATE UPLINK"}
                    </ControlButton>
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
        width: 500px;
        max-width:calc(100vw - 24px);
        max-height:calc(100dvh - 24px);
        overflow-y:auto;
        box-sizing:border-box;
        background: var(--bg-module);
        border: 4px solid var(--border-color);
        box-shadow:
            0 0 50px rgba(0, 255, 0, 0.1),
            0 0 0 2px #000;
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
    }

    .modal-content {
        padding: 30px;
        display: flex;
        flex-direction: column;
        gap: 20px;
    }

    .secondary-actions { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
    .secondary-actions :global(.control-button) { height:100%; padding:12px 8px; font-size:12px; line-height:1.4; }
    @media(max-width:400px) { .secondary-actions { grid-template-columns:minmax(0,1fr); } }

    .status-line {
        font-family: "Share Tech Mono", monospace;
        color: #888;
        font-size: 18px;
        margin-bottom: 10px;
    }

    .status-text {
        color: #fff;
        font-weight: bold;
    }
    .status-text.connecting {
        color: var(--retro-orange);
        animation: blink 1s infinite;
    }
    .status-text.error {
        color: var(--retro-red);
    }
    .status-text.disconnected {
        color: #666;
    }

    .error-msg {
        color: var(--retro-red);
        background: rgba(255, 0, 0, 0.1);
        border: 1px solid var(--retro-red-dim);
        padding: 10px;
        font-size: 14px;
    }

    .input-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .checkbox-group label {
        display: flex;
        align-items: center;
        gap: 10px;
        cursor: pointer;
    }

    .checkbox-group input {
        width: 20px;
        height: 20px;
        padding: 0;
    }

    label {
        color: var(--retro-green);
        font-size: 14px;
        letter-spacing: 1px;
    }

    input[type="text"] {
        background: #000;
        border: 2px solid #333;
        color: var(--retro-green);
        padding: 12px;
        font-family: "Share Tech Mono", monospace;
        font-size: 18px;
        outline: none;
        transition: border-color 0.2s;
    }

    input[type="text"]:focus {
        border-color: var(--retro-green);
        box-shadow: 0 0 10px rgba(0, 255, 0, 0.2);
    }

    @keyframes blink {
        50% {
            opacity: 0.5;
        }
    }
</style>
