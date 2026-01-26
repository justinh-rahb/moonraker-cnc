<script>
    import PanelModule from "../ui/PanelModule.svelte";
    import { machineState } from "../../../stores/machineStore.js";
    import { configStore } from "../../../stores/configStore.js";
    import { send } from "../../../stores/websocket.js";

    // Dynamic temperature access
    $: temps = $machineState.temperatures;
    $: history = $machineState.tempHistory;
    $: presets = $configStore.tempPresets || [];

    // Settings
    $: showGraph = $configStore.temperature?.showGraph ?? true;
    $: autoscale = $configStore.temperature?.autoscale ?? true;
    $: hideMonitors = $configStore.temperature?.hideMonitors ?? false;

    // Step selection
    let tempStep = 10;
    const steps = [1, 5, 10, 25, 50];

    // Helper to check settable
    const isSettable = (key) => {
        return (
            key === "heater_bed" ||
            key.startsWith("extruder") ||
            key.startsWith("heater_generic")
        );
    };

    // List sensors, prioritizing main heaters
    $: keys = Object.keys(temps)
        .filter((k) => {
            if (!hideMonitors) return true;
            return isSettable(k);
        })
        .sort((a, b) => {
            // Bed first
            if (a === "heater_bed") return -1;
            if (b === "heater_bed") return 1;
            // Extruders next
            if (a.startsWith("extruder") && !b.startsWith("extruder")) return -1;
            if (!a.startsWith("extruder") && b.startsWith("extruder")) return 1;
            return a.localeCompare(b);
        });

    // Helper Commands
    const setTemp = (key, target) => {
        // Clamp to 0
        const val = Math.max(0, target);

        if (key === "heater_bed") {
            send("printer.gcode.script", { script: `M140 S${val}` });
        } else if (key.startsWith("extruder")) {
            send("printer.gcode.script", {
                script: `SET_HEATER_TEMPERATURE HEATER=${key} TARGET=${val}`,
            });
        } else {
            // Generic
            send("printer.gcode.script", {
                script: `SET_HEATER_TEMPERATURE HEATER=${key} TARGET=${val}`,
            });
        }
    };

    const adjustTemp = (key, delta) => {
        const currentTarget = temps[key]?.target || 0;
        setTemp(key, currentTarget + delta);
    };

    const cooldownAll = () => {
        send("printer.gcode.script", { script: "TURN_OFF_HEATERS" });
    };

    const applyPreset = (preset) => {
        // Set Bed
        if (preset.bed >= 0) {
            send("printer.gcode.script", { script: `M140 S${preset.bed}` });
        }

        // Set Extruder (simplified: just sets the main/first extruder found or defaults to M104 active)
        if (preset.extruder >= 0) {
            send("printer.gcode.script", {
                script: `M104 S${preset.extruder}`,
            });
        }
    };

    // Color mapping based on type
    const getSensorColor = (key) => {
        if (key === "heater_bed") return "#00ffff"; // Electric Blue for Bed
        if (key.startsWith("extruder")) return "#ffaa00"; // Orange for Extruder
        return "#00ff00"; // Green for Sensors/Fans
    };

    // Graph Dimensions
    const width = 400; // viewBox width
    const height = 150; // viewBox height

    // Temperature range
    $: maxTemp = (() => {
        if (!autoscale) return 300;
        let max = 0;
        if (history && history.length) {
            history.forEach((pt) => {
                keys.forEach((k) => {
                    const val = pt.sensors[k];
                    if (val > max) max = val;
                });
            });
        }
        return Math.max(max * 1.1, 60); // Min 60 (bed usually 60), add 10% buffer
    })();

    $: gridLines = (() => {
        const step = maxTemp > 100 ? 50 : 20;
        const lines = [];
        for (let t = step; t < maxTemp; t += step) {
            lines.push(t);
        }
        return lines;
    })();

    // Generate SVG path for a sensor
    $: getPath = (sensorKey) => {
        if (!history || history.length < 2) return "";

        let path = "";
        const pointWidth = width / Math.max(history.length - 1, 1);

        history.forEach((point, i) => {
            const val = point.sensors[sensorKey] || 0;
            // Invert Y axis, scale to height
            const y = height - (val / maxTemp) * height;
            const x = i * pointWidth;

            if (i === 0) path += `M ${x} ${y}`;
            else path += ` L ${x} ${y}`;
        });

        return path;
    };

    // --- Graph Interaction ---
    let hoverIndex = -1;
    let showTooltip = false;
    let tooltipX = 0;

    const handleGraphMouseMove = (e) => {
        if (!history || history.length < 2) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const relX = Math.max(0, Math.min(1, offsetX / rect.width));

        // Map relX to history index
        // history index 0 is left (oldest) if we draw 0->width
        hoverIndex = Math.round(relX * (history.length - 1));
        tooltipX = offsetX;
        showTooltip = true;
    };

    const handleGraphMouseLeave = () => {
        showTooltip = false;
        hoverIndex = -1;
    };
    
    $: hoverData = (hoverIndex >= 0 && history && history[hoverIndex]) ? history[hoverIndex].sensors : null;
</script>

<PanelModule title="TEMPERATURES">
    <div class="temp-display">
        {#each keys as key}
            {#if temps[key]}
                <div
                    class="temp-item"
                    style="border-left: 4px solid {getSensorColor(key)}"
                >
                    <div class="temp-header">
                        <div
                            class="temp-label"
                            style="color: {getSensorColor(key)}"
                        >
                            {temps[key].label || key}
                        </div>
                    </div>

                    <div class="readouts">
                        <div class="readout-group">
                            <span class="val-label">CURRENT</span>
                            <div class="temp-current">
                                {temps[key].current.toFixed(1)}°C
                            </div>
                        </div>

                        {#if isSettable(key)}
                            <div class="control-group">
                                <button
                                    class="icon-btn danger"
                                    on:click={() => setTemp(key, 0)}
                                    title="Cooldown">OFF</button
                                >
                                <div class="adjust-controls">
                                    <button
                                        class="icon-btn"
                                        on:click={() =>
                                            adjustTemp(key, -tempStep)}
                                        >-</button
                                    >
                                    <div class="target-display">
                                        <span class="val-label">TARGET</span>
                                        <span class="target-val"
                                            >{temps[key].target.toFixed(
                                                0,
                                            )}</span
                                        >
                                    </div>
                                    <button
                                        class="icon-btn"
                                        on:click={() =>
                                            adjustTemp(key, tempStep)}>+</button
                                    >
                                </div>
                            </div>
                        {:else}
                            <!-- Passive Monitor -->
                            <div class="readout-group right">
                                <span class="val-label">STATUS</span>
                                <div class="temp-target monitor">MONITOR</div>
                            </div>
                        {/if}
                    </div>
                </div>
            {/if}
        {/each}
    </div>

    <!-- Controls Row -->
    <div class="panel-controls">
        <div class="step-selector">
            <span class="step-label">STEP:</span>
            {#each steps as step}
                <button
                    class="step-btn {tempStep === step ? 'active' : ''}"
                    on:click={() => (tempStep = step)}
                >
                    {step}
                </button>
            {/each}
        </div>

        {#if presets.length > 0}
            <div class="presets-inline">
                {#each presets as preset}
                    <button
                        class="preset-btn"
                        on:click={() => applyPreset(preset)}
                    >
                        <span class="preset-name">{preset.name}</span>
                    </button>
                {/each}
            </div>
        {/if}

        <button class="cool-all-btn" on:click={cooldownAll}>OFF</button>
    </div>

    {#if showGraph}
        <div
            class="graph"
            on:mousemove={handleGraphMouseMove}
            on:mouseleave={handleGraphMouseLeave}
        >
            <!-- SVG Graph -->
            <svg viewBox="0 0 {width} {height}" preserveAspectRatio="none">
                <!-- Grid Lines (Horizontal) -->
                {#each gridLines as t}
                    <line
                        x1="0"
                        y1={height - (t / maxTemp) * height}
                        x2={width}
                        y2={height - (t / maxTemp) * height}
                        stroke="#1a1a1a"
                        stroke-width="1"
                    />
                    <!-- Axis Label -->
                    <text
                        x="5"
                        y={height - (t / maxTemp) * height - 2}
                        fill="#444"
                        font-family="monospace"
                        font-size="8">{t}</text
                    >
                {/each}

                <!-- Sensor Lines -->
                {#each keys as key}
                    <path
                        d={getPath(key)}
                        fill="none"
                        stroke={getSensorColor(key)}
                        stroke-width="2"
                        vector-effect="non-scaling-stroke"
                        opacity="0.8"
                    />
                {/each}
            </svg>

            {#if showTooltip && hoverIndex >= 0}
                <!-- Cursor Line -->
                <div
                    class="cursor-line"
                    style="left: {(hoverIndex / (history.length - 1)) * 100}%;"
                ></div>

                <!-- Tooltip -->
                <div
                    class="graph-tooltip"
                    style="left: {Math.min(Math.max(tooltipX, 50), width - 50)}px;"
                >
                    {#if hoverData}
                        {#each keys as key}
                            <div class="tooltip-row">
                                <span class="t-name" style="color: {getSensorColor(key)}">{temps[key]?.label || key.substring(0,3)}</span>
                                <span class="t-val">{(hoverData[key] || 0.0).toFixed(1)}</span>
                            </div>
                        {/each}
                    {/if}
                </div>
            {/if}

            <div class="graph-grid-overlay"></div>
        </div>
    {/if}
</PanelModule>

<style>
    .temp-display {
        display: flex;
        flex-direction: column;
        gap: 10px; /* Reduced gap for compact list */
        margin-bottom: 20px;
    }

    .temp-item {
        background: #000;
        border: 1px solid #333;
        /* border-left is set inline */
        padding: 10px 15px;
        box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.5);
    }

    .temp-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 5px;
        border-bottom: 1px solid #222;
        padding-bottom: 4px;
    }

    .temp-label {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
    }

    .readouts {
        display: flex;
        justify-content: space-between;
        align-items: center;
        height: 40px; /* Fixed height for consistency */
    }

    .readout-group {
        display: flex;
        flex-direction: column;
        justify-content: center;
    }
    .readout-group.right {
        align-items: flex-end;
    }

    .val-label {
        font-size: 9px;
        color: #555;
        margin-bottom: 2px;
    }

    .temp-current {
        font-size: 24px;
        color: #fff;
        font-weight: 700;
        font-family: "Share Tech Mono", monospace;
        line-height: 1;
    }

    .temp-target {
        font-size: 14px;
        color: #888;
        font-family: "Share Tech Mono", monospace;
    }

    .temp-target.monitor {
        color: #444;
        font-size: 10px;
    }

    /* Control Styles */
    .control-group {
        display: flex;
        align-items: center;
        gap: 15px;
    }

    .adjust-controls {
        display: flex;
        align-items: center;
        gap: 8px;
        background: #111;
        padding: 4px;
        border-radius: 4px;
        border: 1px solid #333;
    }

    .icon-btn {
        background: #2a2a2a;
        color: #ddd;
        border: 1px solid #444;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-family: "Orbitron", sans-serif;
        font-weight: bold;
        font-size: 14px;
        transition: all 0.1s;
    }

    .icon-btn:hover {
        background: #444;
        color: #fff;
        border-color: #666;
    }

    .icon-btn:active {
        background: #000;
        transform: translateY(1px);
    }

    .icon-btn.danger {
        background: #330000;
        border-color: #550000;
        color: #ff4444;
        font-size: 10px;
        width: 32px;
    }

    .icon-btn.danger:hover {
        background: #550000;
        border-color: #ff4444;
        color: #fff;
    }

    .target-display {
        display: flex;
        flex-direction: column;
        align-items: center;
        min-width: 40px;
    }

    .target-val {
        font-family: "Share Tech Mono", monospace;
        font-size: 18px;
        color: var(--retro-orange);
        font-weight: bold;
        line-height: 1;
    }

    /* Panel Controls (Step select, Cool All) */
    .panel-controls {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        background: #0a0a0a;
        padding: 5px;
        border: 1px solid #333;
        overflow-x: auto; /* Handle overflow if too narrow */
    }

    .step-selector {
        display: flex;
        align-items: center;
        gap: 3px;
        flex-shrink: 0;
    }

    .step-label {
        font-size: 10px;
        color: #666;
        margin-right: 2px;
        white-space: nowrap;
    }

    .step-btn {
        background: #1a1a1a;
        border: 1px solid #333;
        color: #666;
        padding: 4px 6px;
        font-size: 10px;
        font-family: "Share Tech Mono", monospace;
        cursor: pointer;
        min-width: 20px;
        text-align: center;
    }

    .step-btn.active {
        background: var(--retro-green);
        color: #000;
        border-color: var(--retro-green);
        font-weight: bold;
    }

    .presets-inline {
        display: flex;
        gap: 5px;
        margin: 0 10px;
        flex-shrink: 0;
    }

    .preset-btn {
        background: #003300;
        border: 1px solid #005500;
        color: #00ff00;
        padding: 4px 8px;
        font-family: "Orbitron", sans-serif;
        font-size: 10px;
        cursor: pointer;
        display: flex;
        align-items: center;
        letter-spacing: 1px;
    }

    .preset-btn:hover {
        background: #005500;
        border-color: #008800;
        box-shadow: 0 0 8px rgba(0, 255, 0, 0.3);
    }

    .preset-btn:active {
        background: #002200;
        transform: translateY(1px);
    }

    .cool-all-btn {
        background: #330000;
        border: 1px solid #660000;
        color: #ff4444;
        padding: 4px 10px;
        font-size: 10px;
        font-family: "Orbitron", sans-serif;
        cursor: pointer;
        letter-spacing: 1px;
    }

    .cool-all-btn:hover {
        background: #ff0000;
        color: #fff;
        box-shadow: 0 0 10px rgba(255, 0, 0, 0.5);
    }

    .graph {
        background: #000;
        border: 4px solid #2a2a2a;
        height: 150px; /* Reduced height to make room for controls */
        position: relative;
        overflow: hidden;
        box-shadow: inset 0 0 30px rgba(0, 0, 0, 0.8);
    }

    svg {
        display: block;
        width: 100%;
        height: 100%;
    }

    .graph-grid-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-image: linear-gradient(
                0deg,
                transparent 24%,
                rgba(20, 50, 20, 0.3) 25%,
                rgba(20, 50, 20, 0.3) 26%,
                transparent 27%,
                transparent 74%,
                rgba(20, 50, 20, 0.3) 75%,
                rgba(20, 50, 20, 0.3) 76%,
                transparent 77%,
                transparent
            ),
            linear-gradient(
                90deg,
                transparent 24%,
                rgba(20, 50, 20, 0.3) 25%,
                rgba(20, 50, 20, 0.3) 26%,
                transparent 27%,
                transparent 74%,
                rgba(20, 50, 20, 0.3) 75%,
                rgba(20, 50, 20, 0.3) 76%,
                transparent 77%,
                transparent
            );
        background-size: 50px 50px;
        pointer-events: none;
    }

    .cursor-line {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 1px;
        background: rgba(255, 255, 255, 0.5);
        pointer-events: none;
        z-index: 10;
    }

    .graph-tooltip {
        position: absolute;
        top: 10px;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.9);
        border: 1px solid #333;
        padding: 5px;
        pointer-events: none;
        z-index: 20;
        border-radius: 4px;
        min-width: 80px;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.5);
    }

    .tooltip-row {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        font-family: "Share Tech Mono", monospace;
        font-size: 10px;
        line-height: 1.4;
    }

    .t-name {
        font-weight: bold;
        text-transform: uppercase;
    }

    .t-val {
        color: #fff;
    }
</style>
