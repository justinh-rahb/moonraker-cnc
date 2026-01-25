<script>
    import PanelModule from "../ui/PanelModule.svelte";
    import RetroSlider from "../ui/RetroSlider.svelte";
    import CncButton from "../ui/CncButton.svelte";
    import {
        machineState,
        setActiveExtruder,
        setExtrudeAmount,
        setExtrudeSpeed,
        extrude as extrudeCmd,
        updatePressureAdvance,
        updateSmoothTime,
        loadFilament,
        unloadFilament,
    } from "../../../stores/machineStore.js";
    import { send } from "../../../stores/websocket.js";

    $: extruders = $machineState.availableExtruders || [];
    $: activeExt = $machineState.activeExtruder || "extruder";
    $: currentAmount = $machineState.extrudeAmount;
    $: currentSpeed = $machineState.extrudeSpeed;

    $: pa = $machineState.pressureAdvance || 0;
    $: st = $machineState.smoothTime || 0.04;

    const amounts = [1, 5, 10, 25, 50, 100];
    const speeds = [1, 2, 5, 10, 20];

    // Commands
    const retract = () => extrudeCmd(-1);
    const extrude = () => extrudeCmd(1);

    $: shortName = (name) => {
        // extruder -> T0, extruder1 -> T1, etc.
        const num = name.replace("extruder", "");
        return num === "" ? "T0" : `T${num}`;
    };

    const adjustPA = (delta) => {
        const val = Math.max(0, pa + delta);
        updatePressureAdvance(val);
    };

    const adjustST = (delta) => {
        const val = Math.max(0, st + delta);
        updateSmoothTime(val);
    };
</script>

<PanelModule title="EXTRUDER">
    {#if extruders.length > 1}
        <div class="tool-select">
            {#each extruders as ext}
                <button
                    class="tool-btn"
                    class:active={activeExt === ext}
                    on:click={() => setActiveExtruder(ext)}
                >
                    {shortName(ext)}
                </button>
            {/each}
        </div>
    {/if}

    <RetroSlider
        label="EXTRUSION FACTOR ({$machineState.extrusionFactor}%)"
        bind:value={$machineState.extrusionFactor}
    />

    <div class="divider"></div>

    <div class="tuning-grid">
        <div class="tuning-card">
            <span class="tuning-label">PRESSURE ADVANCE</span>
            <div class="tuning-val-row">
                <button class="adj-btn" on:click={() => adjustPA(-0.005)}
                    >-</button
                >
                <div class="value-box">{pa.toFixed(3)}</div>
                <button class="adj-btn" on:click={() => adjustPA(0.005)}
                    >+</button
                >
            </div>
        </div>
        <div class="tuning-card">
            <span class="tuning-label">SMOOTH TIME</span>
            <div class="tuning-val-row">
                <button class="adj-btn" on:click={() => adjustST(-0.005)}
                    >-</button
                >
                <div class="value-box">{st.toFixed(3)}</div>
                <button class="adj-btn" on:click={() => adjustST(0.005)}
                    >+</button
                >
            </div>
        </div>
    </div>

    <div class="control-section">
        <span class="section-label">AMOUNT (mm)</span>
        <div class="selector-grid">
            {#each amounts as amt}
                <button
                    class="select-btn"
                    class:active={currentAmount === amt}
                    on:click={() => setExtrudeAmount(amt)}
                >
                    {amt}
                </button>
            {/each}
        </div>
    </div>

    <div class="control-section">
        <span class="section-label">SPEED (mm/s)</span>
        <div class="selector-grid">
            {#each speeds as spd}
                <button
                    class="select-btn"
                    class:active={currentSpeed === spd}
                    on:click={() => setExtrudeSpeed(spd)}
                >
                    {spd}
                </button>
            {/each}
        </div>
    </div>

    <div class="action-buttons">
        <CncButton variant="action" on:click={retract}>RETRACT</CncButton>
        <CncButton variant="action" on:click={extrude}>EXTRUDE</CncButton>
    </div>

    <div class="action-buttons filament-actions">
        <CncButton variant="action" on:click={unloadFilament}>UNLOAD</CncButton>
        <CncButton variant="action" on:click={loadFilament}>LOAD</CncButton>
    </div>
</PanelModule>

<style>
    .action-buttons {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
        margin-bottom: 12px;
    }

    .filament-actions {
        margin-bottom: 0;
    }

    .filament-actions :global(.cnc-button.action) {
        background: linear-gradient(180deg, #333 0%, #222 100%);
        border-color: #444;
        box-shadow: 0 4px 0 #111;
    }

    .control-section {
        margin-bottom: 15px;
    }

    .section-label {
        display: block;
        font-family: "Orbitron", sans-serif;
        font-size: 10px;
        color: #666;
        margin-bottom: 8px;
        letter-spacing: 1px;
    }

    .selector-grid {
        display: flex;
        gap: 6px;
    }

    .select-btn {
        flex: 1;
        background: #1a1a1a;
        border: 2px solid #333;
        color: var(--retro-orange);
        padding: 10px;
        font-family: "Share Tech Mono", monospace;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s;
    }

    .select-btn:hover {
        border-color: #555;
    }

    .select-btn.active {
        background: var(--retro-orange);
        color: #000;
        border-color: var(--retro-orange);
        box-shadow: 0 0 20px var(--retro-orange);
    }

    .divider {
        height: 1px;
        background: #222;
        margin: 20px 0;
    }

    .tool-select {
        display: flex;
        gap: 8px;
        margin-bottom: 20px;
    }

    .tool-btn {
        flex: 1;
        background: #000;
        border: 2px solid #333;
        color: #666;
        padding: 5px;
        font-family: "Share Tech Mono", monospace;
        font-size: 14px;
        cursor: pointer;
    }

    .tool-btn.active {
        border-color: var(--retro-orange);
        color: var(--retro-orange);
        background: rgba(255, 100, 0, 0.1);
        font-weight: bold;
    }

    .tuning-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-bottom: 20px;
    }

    .tuning-card {
        background: #000;
        border: 1px solid #222;
        padding: 10px;
        text-align: center;
    }

    .tuning-label {
        display: block;
        font-family: "Orbitron", sans-serif;
        font-size: 8px;
        color: #666;
        margin-bottom: 8px;
        letter-spacing: 1px;
    }

    .tuning-val-row {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
    }

    .value-box {
        font-family: "Share Tech Mono", monospace;
        font-size: 16px;
        color: var(--retro-orange);
        min-width: 60px;
    }

    .adj-btn {
        background: #1a1a1a;
        border: 1px solid #333;
        color: #fff;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: "Share Tech Mono", monospace;
        font-size: 16px;
        cursor: pointer;
    }

    .adj-btn:hover {
        border-color: var(--retro-orange);
        color: var(--retro-orange);
    }
</style>
