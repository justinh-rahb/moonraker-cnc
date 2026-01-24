<script>
    import SettingsModal from "../ui/SettingsModal.svelte";
    import { emergencyStop } from "../../../stores/machineStore.js";
    import { configStore } from "../../../stores/configStore.js";

    let isSettingsOpen = false;
</script>

<div class="panel-header">
    <div class="machine-title">{$configStore.title}</div>
    <div class="header-controls">
        <button
            class="settings-btn"
            on:click={() => (isSettingsOpen = true)}
            title="Settings"
        >
            <svg class="icon-gear" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
            </svg>
        </button>
        <button class="emergency-stop" on:click={emergencyStop}>
            <svg class="icon-stop" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z"/>
            </svg>
            <span>E-STOP</span>
        </button>
    </div>
</div>

<SettingsModal
    isOpen={isSettingsOpen}
    onClose={() => (isSettingsOpen = false)}
/>

<style>
    .panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 30px;
        padding: 20px;
        background: linear-gradient(180deg, #0a0a0a 0%, #151515 100%);
        border: 3px solid #333;
        box-shadow: inset 0 -2px 5px rgba(255, 255, 255, 0.1);
    }

    .machine-title {
        font-family: "Orbitron", monospace;
        font-size: 32px;
        font-weight: 900;
        letter-spacing: 4px;
        color: var(--retro-green);
        text-shadow: 0 0 2px var(--retro-green);
    }

    .header-controls {
        display: flex;
        gap: 15px;
        align-items: center;
    }

    .settings-btn {
        background: #2a2a2a;
        color: #888;
        border: 2px solid #444;
        padding: 12px;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .settings-btn:hover {
        color: var(--retro-green);
        border-color: var(--retro-green);
        background: #3a3a3a;
    }

    .settings-btn:hover .icon-gear {
        animation: spin 4s linear infinite;
    }

    .icon-gear {
        width: 24px;
        height: 24px;
        stroke-linecap: round;
        transition: transform 0.3s;
    }

    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }

    .emergency-stop {
        background: var(--retro-red);
        color: #fff;
        border: 4px solid var(--retro-red-dim);
        padding: 12px 20px;
        font-family: "Orbitron", monospace;
        font-weight: 900;
        font-size: 14px;
        letter-spacing: 2px;
        cursor: pointer;
        box-shadow:
            0 4px 0 var(--retro-red-dim),
            0 8px 20px rgba(255, 0, 0, 0.5);
        transition: all 0.1s;
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .emergency-stop:hover {
        background: #ff3333;
        box-shadow:
            0 4px 0 var(--retro-red-dim),
            0 8px 30px rgba(255, 0, 0, 0.7);
    }

    .emergency-stop:active {
        transform: translateY(4px);
        box-shadow:
            0 0 0 var(--retro-red-dim),
            0 4px 10px rgba(255, 0, 0, 0.3);
    }

    .icon-stop {
        width: 20px;
        height: 20px;
        fill: #fff;
        filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.5));
        animation: pulse-stop 1.5s ease-in-out infinite;
    }

    @keyframes pulse-stop {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.8; transform: scale(1.1); }
    }
</style>
