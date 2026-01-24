<script>
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
            // fan_generic expects 0.0-1.0 usually
            send("printer.gcode.script", {
                script: `SET_FAN_SPEED FAN=${key} SPEED=${speed.toFixed(2)}`,
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
        const val = parseFloat(e.target.value); // 0.0 - 1.0 from input
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
                    <span class="device-name">{dev.label}</span>
                    <button
                        class="toggle-btn {dev.value > 0 ? 'active' : ''}"
                        on:click={() => toggle(key, dev)}
                    >
                        {dev.value > 0 ? "ON" : "OFF"}
                    </button>
                </div>

                <div class="slider-container">
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={dev.value}
                        on:change={(e) => handleSlide(key, dev, e)}
                        style="--val: {dev.value * 100}%"
                    />
                    <span class="value-display">
                        {(dev.value * 100).toFixed(0)}%
                    </span>
                </div>
            </div>
        {/each}

        {#if sortedKeys.length === 0}
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

    .slider-container {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .value-display {
        font-family: "Share Tech Mono", monospace;
        font-size: 12px;
        color: #aaa;
        width: 32px;
        text-align: right;
    }

    input[type="range"] {
        -webkit-appearance: none;
        width: 100%;
        height: 6px;
        background: #222;
        outline: none;
        border: 1px solid #333;
        position: relative;
        /* Dynamic fill track using gradient */
        background-image: linear-gradient(#552200, #552200);
        background-repeat: no-repeat;
        /* background-size is set inline via style="" */
    }

    /* Slider Thumb */
    input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 12px;
        height: 12px;
        background: var(--retro-orange);
        cursor: pointer;
        box-shadow: 0 0 5px var(--retro-orange);
        border: 1px solid #000; /* Add contrast so it sits 'above' */
        position: relative;
        z-index: 2; /* Just in case */
        margin-top: -1px; /* Align if needed, though usually centered */
    }

    .empty-state {
        color: #444;
        font-size: 11px;
        text-align: center;
        padding: 20px;
        font-style: italic;
    }
</style>
