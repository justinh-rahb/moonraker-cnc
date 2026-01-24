<script>
    import PanelModule from "../ui/PanelModule.svelte";
    import { machineState } from "../../../stores/machineStore.js";

    $: temps = $machineState.temperatures;
</script>

<PanelModule title="TEMPERATURES">
    <div class="temp-display">
        <div class="temp-item">
            <div class="temp-label">EXTRUDER</div>
            <div class="temp-current">{temps.extruder.current}°C</div>
            <div class="temp-target">TARGET: {temps.extruder.target}°C</div>
        </div>
        <div class="temp-item">
            <div class="temp-label">HEATER BED</div>
            <div class="temp-current">{temps.heater_bed.current}°C</div>
            <div class="temp-target">TARGET: {temps.heater_bed.target}°C</div>
        </div>
        <div class="temp-item">
            <div class="temp-label">CPU</div>
            <div class="temp-current">{temps.cpu.current}°C</div>
            <div class="temp-target">MONITOR</div>
        </div>
        <div class="temp-item">
            <div class="temp-label">MCU TEMP</div>
            <div class="temp-current">{temps.mcu.current}°C</div>
            <div class="temp-target">MONITOR</div>
        </div>
    </div>

    <div class="graph">
        <div class="graph-grid"></div>
        <div class="graph-line"></div>
    </div>
</PanelModule>

<style>
    .temp-display {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 15px;
        margin-bottom: 20px;
    }

    .temp-item {
        background: #000;
        border: 3px solid #2a2a2a;
        padding: 15px;
        box-shadow: inset 0 0 20px rgba(255, 100, 0, 0.05);
    }

    .temp-label {
        font-size: 12px;
        color: var(--retro-orange);
        margin-bottom: 8px;
        text-transform: uppercase;
        letter-spacing: 1px;
    }

    .temp-current {
        font-size: 28px;
        color: var(--retro-orange);
        font-weight: 700;
    }

    .temp-target {
        font-size: 14px;
        color: #666;
        margin-top: 5px;
    }

    .graph {
        background: #000;
        border: 4px solid #2a2a2a;
        height: 200px;
        margin-bottom: 20px;
        position: relative;
        overflow: hidden;
        box-shadow: inset 0 0 30px rgba(0, 0, 0, 0.8);
    }

    .graph-grid {
        position: absolute;
        width: 100%;
        height: 100%;
        background-image: repeating-linear-gradient(
                0deg,
                #0a3a0a 0px,
                #0a3a0a 1px,
                transparent 1px,
                transparent 40px
            ),
            repeating-linear-gradient(
                90deg,
                #0a3a0a 0px,
                #0a3a0a 1px,
                transparent 1px,
                transparent 40px
            );
    }

    .graph-line {
        position: absolute;
        bottom: 30%;
        left: 0;
        width: 100%;
        height: 2px;
        background: var(--retro-orange);
        animation: scan 2s linear infinite;
    }

    @keyframes scan {
        0% {
            transform: translateX(-100%);
        }
        100% {
            transform: translateX(100%);
        }
    }
</style>
