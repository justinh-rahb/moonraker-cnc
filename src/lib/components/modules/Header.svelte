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
            ⚙️
        </button>
        <button class="emergency-stop" on:click={emergencyStop}
            >⚠ E-STOP</button
        >
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
        padding: 10px 16px;
        font-size: 18px;
        cursor: pointer;
        transition: all 0.2s;
    }

    .settings-btn:hover {
        color: var(--retro-green);
        border-color: var(--retro-green);
        background: #3a3a3a;
    }

    .emergency-stop {
        background: var(--retro-red);
        color: #fff;
        border: 4px solid var(--retro-red-dim);
        padding: 12px 24px;
        font-family: "Orbitron", monospace;
        font-weight: 900;
        font-size: 14px;
        letter-spacing: 2px;
        cursor: pointer;
        box-shadow:
            0 4px 0 var(--retro-red-dim),
            0 8px 20px rgba(255, 0, 0, 0.5);
        transition: all 0.1s;
    }

    .emergency-stop:active {
        transform: translateY(4px);
        box-shadow:
            0 0 0 var(--retro-red-dim),
            0 4px 10px rgba(255, 0, 0, 0.3);
    }
</style>
