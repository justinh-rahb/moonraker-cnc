<script>
    import Led from "../ui/Led.svelte";
    import {
        machineState,
        emergencyStop,
    } from "../../../stores/machineStore.js";

    // Reactive derived values if needed, or just direct access
    $: status = $machineState.status;
    $: isEStop = $machineState.isEmergencyStop;
</script>

<div class="panel-header">
    <div class="machine-title">ENDER-3 V3 SE</div>
    <div class="status-indicator">
        <Led color="green" on={status === "STANDBY" && !isEStop} />
        <span class="status-text">{status}</span>
        <button class="emergency-stop" on:click={emergencyStop}
            >⚠ E-STOP</button
        >
    </div>
</div>

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

    .status-indicator {
        display: flex;
        gap: 15px;
        align-items: center;
    }

    .status-text {
        font-family: "Orbitron", monospace;
        font-size: 14px;
        color: var(--retro-green);
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
