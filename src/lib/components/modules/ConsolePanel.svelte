<script>
    import { onMount, onDestroy, afterUpdate } from "svelte";
    import PanelModule from "../ui/PanelModule.svelte";
    import { send, onNotification } from "../../../stores/websocket.js";
    import { configStore, updateConsoleConfig } from "../../../stores/configStore.js";
    import { consoleStore } from "../../../stores/consoleStore.js";

    // Console messages from store
    let commandInput = "";
    let commandHistory = [];
    let historyIndex = -1;
    let scrollContainer;
    let unsubscribeNotification;
    let unsubscribeStore;

    // Settings
    $: newestFirst = $configStore.console?.newestFirst ?? true;
    $: maxHistory = $configStore.console?.maxHistory ?? 500;

    // Displayed messages (reversed if needed)
    $: displayedMessages = newestFirst ? [...$consoleStore].reverse() : $consoleStore;

    // Trim messages to max history
    $: if ($consoleStore.length > maxHistory) {
        consoleStore.trimToLimit(maxHistory);
    }

    onMount(() => {
        // Subscribe to Klipper console output
        unsubscribeNotification = onNotification((method, params) => {
            if (method === "notify_gcode_response") {
                consoleStore.addResponse(params[0]);
            }
        });

        // Subscribe to console output via Moonraker
        send("server.gcode_store.subscribe", {}).catch((err) => {
            console.error("Failed to subscribe to gcode store:", err);
        });

        // Focus the input
        focusInput();
    });

    onDestroy(() => {
        if (unsubscribeNotification) {
            unsubscribeNotification();
        }
    });

    afterUpdate(() => {
        // Auto-scroll to the appropriate end
        if (scrollContainer) {
            if (newestFirst) {
                scrollContainer.scrollTop = 0;
            } else {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        }
    });

    const sendCommand = async () => {
        const cmd = commandInput.trim();
        if (!cmd) return;

        // Add to command history (not console - websocket will add to console)
        commandHistory = [...commandHistory, cmd];
        if (commandHistory.length > 100) {
            commandHistory = commandHistory.slice(-100);
        }
        historyIndex = -1;

        // Clear input
        commandInput = "";

        // Send to Klipper (websocket will log the command)
        try {
            await send("printer.gcode.script", { script: cmd });
        } catch (err) {
            consoleStore.addError(`Error: ${err.message || err}`);
        }

        // Refocus input
        focusInput();
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            sendCommand();
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            navigateHistory("up");
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            navigateHistory("down");
        }
    };

    const navigateHistory = (direction) => {
        if (commandHistory.length === 0) return;

        if (direction === "up") {
            if (historyIndex < commandHistory.length - 1) {
                historyIndex++;
            }
        } else {
            if (historyIndex > -1) {
                historyIndex--;
            }
        }

        if (historyIndex >= 0) {
            commandInput = commandHistory[commandHistory.length - 1 - historyIndex];
        } else {
            commandInput = "";
        }
    };

    const focusInput = () => {
        setTimeout(() => {
            const input = document.querySelector(".console-input input");
            // @ts-ignore - focus is available on input element
            if (input) input.focus();
        }, 0);
    };

    const formatTimestamp = (date) => {
        const h = String(date.getHours()).padStart(2, "0");
        const m = String(date.getMinutes()).padStart(2, "0");
        const s = String(date.getSeconds()).padStart(2, "0");
        return `${h}:${m}:${s}`;
    };

    const toggleMessageOrder = () => {
        updateConsoleConfig({ newestFirst: !newestFirst });
    };

    const clearConsole = () => {
        consoleStore.clear();
    };
</script>

<PanelModule title="CONSOLE">
    <div class="console-container">
        <!-- Input at top if newest first -->
        {#if newestFirst}
            <div class="console-input">
                <input
                    type="text"
                    bind:value={commandInput}
                    on:keydown={handleKeyDown}
                    placeholder="ENTER G-CODE OR COMMAND..."
                    autocomplete="off"
                    spellcheck="false"
                />
                <button on:click={sendCommand} class="send-btn">SEND</button>
            </div>
        {/if}

        <!-- Console controls -->
        <div class="console-controls">
            <button on:click={toggleMessageOrder} class="control-btn">
                {newestFirst ? "▼ NEWEST FIRST" : "▲ OLDEST FIRST"}
            </button>
            <button on:click={clearConsole} class="control-btn">CLEAR</button>
        </div>

        <!-- Message history -->
        <div class="console-output" bind:this={scrollContainer}>
            {#each displayedMessages as msg (msg.timestamp.getTime())}
                <div class="console-message {msg.type}">
                    <span class="timestamp">{formatTimestamp(msg.timestamp)}</span>
                    <span class="message-text">{msg.text}</span>
                </div>
            {/each}
            {#if $consoleStore.length === 0}
                <div class="console-message empty">
                    <span class="message-text">No messages yet. Enter a command to begin.</span>
                </div>
            {/if}
        </div>

        <!-- Input at bottom if oldest first -->
        {#if !newestFirst}
            <div class="console-input">
                <input
                    type="text"
                    bind:value={commandInput}
                    on:keydown={handleKeyDown}
                    placeholder="ENTER G-CODE OR COMMAND..."
                    autocomplete="off"
                    spellcheck="false"
                />
                <button on:click={sendCommand} class="send-btn">SEND</button>
            </div>
        {/if}
    </div>
</PanelModule>

<style>
    .console-container {
        display: flex;
        flex-direction: column;
        height: 400px;
        gap: 10px;
    }

    .console-input {
        display: flex;
        gap: 8px;
        padding: 8px;
        background: #0a0a0a;
        border: 2px solid #333;
    }

    .console-input input {
        flex: 1;
        font-family: "Courier New", monospace;
        font-size: 14px;
        padding: 8px 12px;
        background: #000;
        color: var(--retro-green);
        border: 2px solid var(--retro-green);
        outline: none;
        text-transform: uppercase;
    }

    .console-input input:focus {
        box-shadow: 0 0 10px rgba(0, 255, 0, 0.5);
    }

    .console-input input::placeholder {
        color: rgba(0, 255, 0, 0.3);
    }

    .send-btn {
        font-family: "Orbitron", monospace;
        font-size: 12px;
        font-weight: 700;
        padding: 8px 16px;
        background: var(--retro-green);
        color: #000;
        border: none;
        cursor: pointer;
        transition: all 0.2s;
    }

    .send-btn:hover {
        background: #00ff00;
        box-shadow: 0 0 15px rgba(0, 255, 0, 0.8);
    }

    .send-btn:active {
        transform: scale(0.95);
    }

    .console-controls {
        display: flex;
        gap: 8px;
        padding: 0 8px;
    }

    .control-btn {
        font-family: "Orbitron", monospace;
        font-size: 10px;
        font-weight: 600;
        padding: 4px 12px;
        background: #1a1a1a;
        color: var(--retro-green);
        border: 1px solid #333;
        cursor: pointer;
        transition: all 0.2s;
    }

    .control-btn:hover {
        background: #2a2a2a;
        border-color: var(--retro-green);
    }

    .console-output {
        flex: 1;
        overflow-y: auto;
        padding: 12px;
        background: #000;
        border: 2px solid #333;
        font-family: "Courier New", monospace;
        font-size: 13px;
        line-height: 1.6;
    }

    .console-output::-webkit-scrollbar {
        width: 8px;
    }

    .console-output::-webkit-scrollbar-track {
        background: #0a0a0a;
    }

    .console-output::-webkit-scrollbar-thumb {
        background: var(--retro-green);
        border-radius: 4px;
    }

    .console-output::-webkit-scrollbar-thumb:hover {
        background: #00ff00;
    }

    .console-message {
        margin-bottom: 8px;
        display: flex;
        gap: 12px;
        animation: fadeIn 0.2s ease-in;
    }

    @keyframes fadeIn {
        from {
            opacity: 0;
            transform: translateY(-2px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .timestamp {
        color: #666;
        font-weight: 700;
        flex-shrink: 0;
        user-select: none;
    }

    .message-text {
        color: var(--retro-green);
        word-break: break-all;
        white-space: pre-wrap;
    }

    .console-message.command .message-text {
        color: #00ccff;
        font-weight: 700;
    }

    .console-message.command .message-text::before {
        content: "> ";
        color: #00ccff;
    }

    .console-message.error .message-text {
        color: #ff4444;
        font-weight: 700;
    }

    .console-message.error .message-text::before {
        content: "! ";
        color: #ff4444;
    }

    .console-message.response .message-text {
        color: var(--retro-green);
    }

    .console-message.empty {
        color: #666;
        font-style: italic;
        justify-content: center;
    }
</style>
