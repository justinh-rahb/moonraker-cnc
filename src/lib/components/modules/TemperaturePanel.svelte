<script>
    import PanelModule from "../ui/PanelModule.svelte";
    import { machineState } from "../../../stores/machineStore.js";
    import { onMount } from "svelte";

    // Dynamic temperature access
    $: temps = $machineState.temperatures;
    $: history = $machineState.tempHistory;

    // List sensors, prioritizing main heaters
    $: keys = Object.keys(temps).sort((a, b) => {
        // Bed first
        if (a === "heater_bed") return -1;
        if (b === "heater_bed") return 1;
        // Extruders next
        if (a.startsWith("extruder") && !b.startsWith("extruder")) return -1;
        if (!a.startsWith("extruder") && b.startsWith("extruder")) return 1;
        return a.localeCompare(b);
    });

    // Color mapping based on type
    const getSensorColor = (key) => {
        if (key === "heater_bed") return "#00ffff"; // Electric Blue for Bed
        if (key.startsWith("extruder")) return "#ffaa00"; // Orange for Extruder
        return "#00ff00"; // Green for Sensors/Fans
    };

    // Graph Dimensions
    const width = 400; // viewBox width
    const height = 200; // viewBox height
    // Temperature range
    const maxTemp = 300;

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
</script>

<PanelModule title="TEMPERATURES">
    <div class="temp-display">
        {#each keys as key}
            <!-- Only show if it has valid data -->
            {#if temps[key]}
                <div
                    class="temp-item"
                    style="border-left: 4px solid {getSensorColor(key)}"
                >
                    <div
                        class="temp-label"
                        style="color: {getSensorColor(key)}"
                    >
                        {temps[key].label || key}
                    </div>
                    <!-- Flex container for Current / Target -->
                    <div class="readouts">
                        <div class="readout-group">
                            <span class="val-label">CURRENT</span>
                            <div class="temp-current">
                                {temps[key].current.toFixed(1)}°C
                            </div>
                        </div>

                        {#if temps[key].target > 0}
                            <div class="readout-group right">
                                <span class="val-label">TARGET</span>
                                <div class="temp-target">
                                    {temps[key].target.toFixed(0)}°C
                                </div>
                            </div>
                        {:else}
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

    <div class="graph">
        <!-- SVG Graph -->
        <svg viewBox="0 0 {width} {height}" preserveAspectRatio="none">
            <!-- Grid Lines (Horizontal) -->
            {#each [50, 100, 150, 200, 250] as t}
                <line
                    x1="0"
                    y1={height - (t / maxTemp) * height}
                    x2={width}
                    y2={height - (t / maxTemp) * height}
                    stroke="#1a1a1a"
                    stroke-width="1"
                />
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

        <!-- Legend Overlay (optional, maybe not needed if cards align color) -->
        <div class="graph-grid-overlay"></div>
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
        border: 1px solid #333;
        /* border-left is set inline */
        padding: 12px;
        box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.5);
    }

    .temp-label {
        font-size: 11px;
        font-weight: 700;
        margin-bottom: 8px;
        text-transform: uppercase;
        letter-spacing: 1px;
        border-bottom: 1px solid #222;
        padding-bottom: 4px;
    }

    .readouts {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
    }

    .readout-group {
        display: flex;
        flex-direction: column;
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
        font-size: 20px;
        color: #fff;
        font-weight: 700;
        font-family: "Share Tech Mono", monospace;
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

    .graph {
        background: #000;
        border: 4px solid #2a2a2a;
        height: 200px;
        margin-bottom: 20px;
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
</style>
