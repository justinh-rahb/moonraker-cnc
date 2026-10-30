<script>
    import RetroSlider from "../ui/RetroSlider.svelte";
    import PanelModule from "../ui/PanelModule.svelte";
    import { machineState } from "../../../stores/machineStore.js";
    import { send } from "../../../stores/websocket.js";

    $: devices = $machineState.miscDevices || {};
    $: sortedKeys = Object.keys(devices).sort();

    const setFanSpeed = (key, speed, max) => {
        // speed passed here is normalized 0.0-1.0 from the slider

        if (key === "fan") {
            const val = Math.floor(speed * 255);
            send("printer.gcode.script", { script: `M106 S${val}` });
        } else {
            // Extract fan name from object key (e.g., "fan_generic cavity_fan" -> "cavity_fan")
            const fanName = key.replace(/^fan_generic\s+/, "");
            send("printer.gcode.script", {
                script: `SET_FAN_SPEED FAN=${fanName} SPEED=${speed.toFixed(2)}`,
            });
        }
    };

    const setPinValue = (key, value, max) => {
        // value is 0.0-1.0 normalized
        const name = key.replace("output_pin ", "");
        const finalValue = value * max;
        // If max > 1 (e.g. 255), we might want integer or 2 decimal places?
        // User used "255.00", so toFixed(2) is safe.
        send("printer.gcode.script", {
            script: `SET_PIN PIN=${name} VALUE=${finalValue.toFixed(2)}`,
        });
    };

    const handleSlide = (key, dev, e) => {
        const val = e.detail.value / 100; // 0.0 - 1.0 from input
        if (dev.type === "fan" || dev.type === "fan_generic") {
            // Reverted to original logic for fan types
            setFanSpeed(key, val, dev.max);
        } else {
            setPinValue(key, val, dev.max);
        }
    };

    const toggle = (key, dev) => {
        const newVal = dev.value > 0 ? 0 : 1.0;
        if (dev.type === "fan" || dev.type === "fan_generic") {
            // Reverted to original logic for fan types
            setFanSpeed(key, newVal, dev.max);
        } else {
            setPinValue(key, newVal, dev.max);
        }
    };

    // Determine icon/color
    const getIcon = (type) => {
        if (type === "pin") return "LIGHT";
        return "FAN";
    };
</script>

<PanelModule title="FANS & LIGHTS">
    <div class="devices-grid">
        {#each sortedKeys as key}
            {@const dev = devices[key]}
            <div class="device-card">
                <div class="device-header">
                    <span class="device-name">{dev.label}{dev.rpm != null ? ` · ${Math.round(dev.rpm)} RPM` : ''}</span>
                    <button
                        class="toggle-btn {dev.value > 0 ? 'active' : ''}"
                        on:click={() => toggle(key, dev)}
                    >
                        {dev.value > 0 ? "ON" : "OFF"}
                    </button>
                </div>

                {#if dev.pwm !== false}
                <RetroSlider label={dev.label + ' speed'} min={0} max={100} baseline={0} value={Math.round(dev.value / dev.max * 100)} on:change={e => handleSlide(key, dev, e)} />
                {/if}
            </div>
        {/each}

        {#each Object.entries($machineState.monitorDevices) as [key,monitor] (key)}
            <div class="device-card"><div class="device-header"><span class="device-name">{monitor.label}</span><span>{monitor.type === 'filament' ? (!monitor.enabled ? 'DISABLED' : monitor.value === null ? 'UNKNOWN' : monitor.value ? 'DETECTED' : 'EMPTY') : monitor.rpm != null ? `${Math.round(monitor.rpm)} RPM` : `${Math.round((monitor.value || 0)*100)}%`}</span></div></div>
        {/each}
        {#if sortedKeys.length === 0 && Object.keys($machineState.monitorDevices).length === 0}
            <div class="empty-state">No controllable devices found</div>
        {/if}
    </div>
</PanelModule>

<style>
    .devices-grid {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .device-card {
        background: #000;
        border: 1px solid #333;
        padding: 10px;
        box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.5);
    }

    .device-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
    }

    .device-name {
        font-family: "Orbitron", sans-serif;
        font-size: 11px;
        color: var(--retro-orange);
        letter-spacing: 1px;
    }

    .toggle-btn {
        background: #111;
        border: 1px solid #333;
        color: #666;
        font-size: 10px;
        padding: 2px 8px;
        cursor: pointer;
        font-family: "Share Tech Mono", monospace;
        min-width: 36px;
    }

    .toggle-btn.active {
        background: #331100;
        border-color: var(--retro-orange);
        color: var(--retro-orange);
        box-shadow: 0 0 5px rgba(255, 100, 0, 0.2);
    }

    .empty-state {
        color: #444;
        font-size: 11px;
        text-align: center;
        padding: 20px;
        font-style: italic;
    }
</style>
