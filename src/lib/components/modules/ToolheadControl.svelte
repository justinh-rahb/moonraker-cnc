<script>
    import PanelModule from "../ui/PanelModule.svelte";
    import CncButton from "../ui/CncButton.svelte";
    import RetroSlider from "../ui/RetroSlider.svelte";
    import {
        machineState,
        jog,
        setJogDistance,
        setZOffsetIncrement,
        adjustZOffset,
        home,
        homeX,
        homeY,
        homeZ,
        motorsOff,
    } from "../../../stores/machineStore.js";

    $: pos = $machineState.position;
    $: currentDist = $machineState.jogDistance;
    $: currentZOffsetIncrement = $machineState.zOffsetIncrement;
    $: zOffset = $machineState.zOffset;
    $: speed = $machineState.speedFactor;

    const distances = [0.1, 1, 10, 25, 50, 100];
    const zOffsetIncrements = [0.005, 0.01, 0.05, 0.1];
</script>

<PanelModule title="TOOLHEAD CONTROL">
    <!-- Axis Readout -->
    <div class="led-display">
        <div class="axis-readout">
            <div class="axis">
                <div class="axis-label">X</div>
                <div class="axis-value">
                    {typeof pos.x === "number" ? pos.x.toFixed(2) : "0.00"}
                </div>
            </div>
            <div class="axis">
                <div class="axis-label">Y</div>
                <div class="axis-value">
                    {typeof pos.y === "number" ? pos.y.toFixed(2) : "0.00"}
                </div>
            </div>
            <div class="axis">
                <div class="axis-label">Z</div>
                <div class="axis-value">
                    {typeof pos.z === "number" ? pos.z.toFixed(3) : "0.000"}
                </div>
            </div>
        </div>
    </div>

    <!-- Jog Controls -->
    <div class="control-pad">
        <CncButton variant="action" on:click={homeX}>X</CncButton>
        <CncButton variant="arrow" on:click={() => jog("y", 1)}>Y+</CncButton>
        <CncButton variant="action" on:click={homeY}>Y</CncButton>

        <CncButton variant="arrow" on:click={() => jog("x", -1)}>X-</CncButton>
        <CncButton variant="home" on:click={home}>ALL</CncButton>
        <CncButton variant="arrow" on:click={() => jog("x", 1)}>X+</CncButton>

        <CncButton variant="action" on:click={homeZ}>Z</CncButton>
        <CncButton variant="arrow" on:click={() => jog("y", -1)}>Y-</CncButton>
        <CncButton variant="danger" on:click={motorsOff}>M-OFF</CncButton>
    </div>

    <!-- Z Controls -->
    <div class="z-controls">
        <CncButton variant="z-up" on:click={() => jog("z", 1)}>Z+</CncButton>
        <CncButton variant="z-down" on:click={() => jog("z", -1)}>Z-</CncButton>
    </div>

    <!-- Distance Select -->
    <div class="distance-select">
        {#each distances as dist}
            <button
                class="distance-button"
                class:active={currentDist === dist}
                on:click={() => setJogDistance(dist)}
            >
                {dist}
            </button>
        {/each}
    </div>

    <!-- Z-Offset Baby-Stepping -->
    <div class="z-offset-section">
        <div class="z-offset-header">
            <div class="z-offset-label">Z-OFFSET</div>
            <div class="z-offset-value">
                {zOffset >= 0 ? '+' : ''}{zOffset.toFixed(3)}
            </div>
        </div>
        
        <div class="z-offset-controls">
            <CncButton variant="arrow" on:click={() => adjustZOffset(1)}>+</CncButton>
            <CncButton variant="arrow" on:click={() => adjustZOffset(-1)}>-</CncButton>
        </div>

        <div class="z-offset-increments">
            {#each zOffsetIncrements as increment}
                <button
                    class="increment-button"
                    class:active={currentZOffsetIncrement === increment}
                    on:click={() => setZOffsetIncrement(increment)}
                >
                    {increment}
                </button>
            {/each}
        </div>
    </div>

    <RetroSlider label="SPEED FACTOR" bind:value={$machineState.speedFactor} />
</PanelModule>

<style>
    .led-display {
        background: #000;
        border: 6px solid #2a2a2a;
        padding: 25px;
        margin-bottom: 20px;
        box-shadow:
            inset 0 0 40px rgba(0, 255, 0, 0.1),
            inset 0 0 10px rgba(0, 0, 0, 0.8);
        font-family: "Orbitron", monospace;
        position: relative;
    }

    .led-display::before {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: repeating-linear-gradient(
            0deg,
            rgba(0, 255, 0, 0.03) 0px,
            rgba(0, 255, 0, 0.03) 2px,
            transparent 2px,
            transparent 4px
        );
        pointer-events: none;
    }

    .axis-readout {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 15px;
    }

    .axis {
        text-align: center;
    }

    .axis-label {
        font-size: 24px;
        font-weight: 900;
        color: var(--retro-orange);
        margin-bottom: 8px;
    }

    .axis-value {
        font-size: 32px;
        color: var(--retro-green);
        font-weight: 700;
        letter-spacing: 3px;
    }

    .control-pad {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        grid-template-rows: repeat(3, 1fr);
        gap: 10px;
        margin-bottom: 20px;
    }

    .z-controls {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-bottom: 20px;
    }

    .distance-select {
        display: flex;
        gap: 8px;
        margin-bottom: 20px;
    }

    .distance-button {
        flex: 1;
        background: #1a1a1a;
        border: 2px solid #333;
        color: var(--retro-green);
        padding: 12px;
        font-family: "Share Tech Mono", monospace;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s;
    }

    .distance-button.active {
        background: var(--retro-green);
        color: #000;
        border-color: var(--retro-green);
        box-shadow: 0 0 20px var(--retro-green);
    }

    .z-offset-section {
        margin-bottom: 20px;
    }

    .z-offset-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        padding: 8px;
        background: #000;
        border: 2px solid #333;
    }

    .z-offset-label {
        font-family: "Share Tech Mono", monospace;
        font-size: 14px;
        font-weight: 700;
        color: var(--retro-orange);
        letter-spacing: 2px;
    }

    .z-offset-value {
        font-family: "Orbitron", monospace;
        font-size: 20px;
        font-weight: 700;
        color: var(--retro-green);
        letter-spacing: 2px;
    }

    .z-offset-controls {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-bottom: 12px;
    }

    .z-offset-increments {
        display: flex;
        gap: 6px;
    }

    .increment-button {
        flex: 1;
        background: #1a1a1a;
        border: 2px solid #333;
        color: var(--retro-green);
        padding: 10px;
        font-family: "Share Tech Mono", monospace;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s;
    }

    .increment-button.active {
        background: var(--retro-green);
        color: #000;
        border-color: var(--retro-green);
        box-shadow: 0 0 20px var(--retro-green);
    }
</style>
