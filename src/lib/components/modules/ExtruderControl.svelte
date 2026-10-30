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
        setExtrusionFactor,
    } from "../../../stores/machineStore.js";

    $: extruders = $machineState.availableExtruders || [];
    $: activeExt = $machineState.activeExtruder || "extruder";
    $: currentAmount = $machineState.extrudeAmount;
    $: currentSpeed = $machineState.extrudeSpeed;

    $: pa = $machineState.pressureAdvance || 0;
    $: st = $machineState.smoothTime ?? 0.04;
    $: cold = ($machineState.temperatures[activeExt]?.current || 0) < ($machineState.configured[activeExt]?.min_extrude_temp ?? 170);
    $: manualDisabled = cold || ["printing", "paused"].includes($machineState.printStatsState);

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

    const onExtrusionChange = (e) => {
        setExtrusionFactor(e.detail.value);
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
        label="EXTRUSION FACTOR"
        value={$machineState.extrusionFactor}
        on:change={onExtrusionChange}
    />

    <div class="divider"></div>

    <div class="tuning-grid">
        <div class="tuning-card">
            <span class="tuning-label">PRESSURE ADVANCE</span>
            <div class="tuning-val-row">
                <button class="adj-btn" on:click={() => adjustPA(-0.005)}
                    >-</button
                >
                <input class="value-box" aria-label="Pressure advance" type="number" min="0" max="1" step="0.001" value={pa} on:change={e => {if(e.currentTarget.checkValidity() && e.currentTarget.value !== '') updatePressureAdvance(Number(e.currentTarget.value));}} />
                <button class="adj-btn" title="Reset pressure advance to configured value" on:click={() => updatePressureAdvance($machineState.configured[activeExt]?.pressure_advance ?? 0)}>↺</button>
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
                <input class="value-box" aria-label="Smooth time" type="number" min="0.001" max="0.2" step="0.001" value={st} on:change={e => {if(e.currentTarget.checkValidity() && e.currentTarget.value !== '') updateSmoothTime(Number(e.currentTarget.value));}} />
                <button class="adj-btn" title="Reset smooth time to configured value" on:click={() => updateSmoothTime($machineState.configured[activeExt]?.pressure_advance_smooth_time ?? 0.04)}>↺</button>
                <button class="adj-btn" on:click={() => adjustST(0.005)}
                    >+</button
                >
            </div>
        </div>
    </div>

    <div class="control-section">
        <label class="section-label">AMOUNT (mm) <input class="value-box" aria-label="Extrusion amount" type="number" min="0.1" max={$machineState.configured[activeExt]?.max_extrude_only_distance ?? 50} step="0.1" value={currentAmount} on:change={e => {if(e.currentTarget.checkValidity() && e.currentTarget.value !== '') setExtrudeAmount(Number(e.currentTarget.value));}} /></label>
        <button class="adj-btn" aria-label="Reset extrusion amount" on:click={() => setExtrudeAmount(10)}>↺</button>
        <div class="selector-grid">
            {#each amounts as amt}
                <button
                    class="select-btn"
                    class:active={currentAmount === amt}
                    disabled={amt > ($machineState.configured[activeExt]?.max_extrude_only_distance ?? 50)}
                    on:click={() => setExtrudeAmount(amt)}
                >
                    {amt}
                </button>
            {/each}
        </div>
    </div>

    <div class="control-section">
        <label class="section-label">SPEED (mm/s) <input class="value-box" aria-label="Extrusion speed" type="number" min="0.1" max="50" step="0.1" value={currentSpeed} on:change={e => {if(e.currentTarget.checkValidity() && e.currentTarget.value !== '') setExtrudeSpeed(Number(e.currentTarget.value));}} /></label>
        <button class="adj-btn" aria-label="Reset extrusion speed" on:click={() => setExtrudeSpeed(5)}>↺</button>
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
        <CncButton variant="action" disabled={manualDisabled} on:click={retract}>RETRACT</CncButton>
        <CncButton variant="action" disabled={manualDisabled} on:click={extrude}>EXTRUDE</CncButton>
    </div>

    {#if cold}<p class="extrusion-hint">Heat the active extruder to enable manual extrusion.</p>{/if}
    <div class="action-buttons filament-actions">
        <CncButton variant="action" disabled={["printing","paused"].includes($machineState.printStatsState)} on:click={unloadFilament}>UNLOAD</CncButton>
        <CncButton variant="action" disabled={["printing","paused"].includes($machineState.printStatsState)} on:click={loadFilament}>LOAD</CncButton>
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

    @media (max-width: 650px) {
        .tuning-grid { grid-template-columns: minmax(0, 1fr) !important; }
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
        background: #080c09;
        border: 1px solid #405447;
        padding: 6px;
        width: 84px;
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
