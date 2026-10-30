<script>
    $: jobActive = ["printing","paused"].includes($machineState.printStatsState);
    import { tick } from 'svelte';
    import { motorEnableState } from '../../motion.js';
    import PanelModule from "../ui/PanelModule.svelte";
    import ControlButton from "../ui/ControlButton.svelte";
    import RetroSlider from "../ui/RetroSlider.svelte";
    import {
        machineState,
        jog,
        moveAbsolute,
        setJogDistance,
        setZOffsetIncrement,
        adjustZOffset,
        home,
        homeX,
        homeY,
        homeZ,
        motorsOff,
        setSpeedFactor,
    } from "../../../stores/machineStore.js";

    let axisButtons = {};
    let editingAxis = '';
    let targetPosition;
    let moving = false;
    $: controlsLocked = jobActive || moving;
    $: if (jobActive || !$machineState.isReady) editingAxis = '';
    $: motorState = motorEnableState($machineState.stepperStates);
    $: motorDescription = {on:'Motors enabled',off:'Motors disabled',mixed:'Some motors enabled',unknown:'Motor state unavailable'}[motorState];
    $: allHomed = ['x','y','z'].every(axis => $machineState.homedAxes.includes(axis));
    $: homeDescriptions = Object.fromEntries(['x','y','z'].map(axis => [axis, `Home ${axis.toUpperCase()} — ${$machineState.homedAxes.includes(axis) ? 'homed' : 'not homed'}`]));
    function editPosition(axis) { editingAxis = axis; targetPosition = $machineState.position[axis]; }
    function focusPosition(node) { queueMicrotask(() => { node.focus(); node.select(); }); }
    async function cancelPosition() {
        const axis = editingAxis; editingAxis = '';
        await tick(); axisButtons[axis]?.focus();
    }
    async function commitPosition(axis) {
        if (moving) return;
        moving = true;
        try { if (await moveAbsolute(axis,targetPosition)) { moving = false; await cancelPosition(); } }
        finally { moving = false; }
    }
    $: pos = $machineState.position;
    $: currentDist = $machineState.jogDistance;
    $: currentZOffsetIncrement = $machineState.zOffsetIncrement;
    $: zOffset = $machineState.zOffset;
    $: speed = $machineState.speedFactor;

    const distances = [0.1, 1, 10, 25, 50, 100];
    const zOffsetIncrements = [0.005, 0.01, 0.05, 0.1];

    const onSpeedChange = (e) => {
        setSpeedFactor(e.detail.value);
    };
</script>

<PanelModule title="TOOLHEAD CONTROL">
    <!-- Axis Readout -->
    <div class="led-display">
        <div class="axis-readout">
            {#each ['x','y','z'] as axis, index}
            <div class="axis">
                <div class="axis-label">{axis.toUpperCase()}</div>
                {#if editingAxis === axis}
                    <form class="axis-editor" on:submit|preventDefault={() => commitPosition(axis)}>
                        <input type="number" step="any" bind:value={targetPosition} use:focusPosition
                            aria-label={axis.toUpperCase() + ' absolute position in millimetres'}
                            min={$machineState.axisMinimum?.[index]} max={$machineState.axisMaximum?.[index]}
                            disabled={moving} required on:keydown={e => {if(e.key === 'Escape') {e.preventDefault(); cancelPosition();}}} />
                        <div class="axis-editor-actions">
                            <button type="submit" disabled={moving} aria-label={'Move ' + axis.toUpperCase() + ' to entered position'} title="Move to position">✓</button>
                            <button type="button" disabled={moving} aria-label="Cancel position entry" title="Cancel" on:click={cancelPosition}>×</button>
                        </div>
                    </form>
                {:else}
                    <button class="axis-value" bind:this={axisButtons[axis]} on:click={() => editPosition(axis)}
                        disabled={controlsLocked || !$machineState.homedAxes.includes(axis)}
                        aria-label={'Set ' + axis.toUpperCase() + ' absolute position'}
                        title={$machineState.homedAxes.includes(axis) ? 'Enter absolute position (mm)' : 'Home this axis to enter a position'}>
                        {typeof pos[axis] === 'number' ? pos[axis].toFixed(axis === 'z' ? 3 : 2) : '—'}
                    </button>
                {/if}
            </div>
            {/each}
        </div>
    </div>

    <!-- Jog Controls -->
    <div class="control-pad">
        <ControlButton variant="action" disabled={controlsLocked} indicator={$machineState.homedAxes.includes('x') ? 'on' : 'off'} title={homeDescriptions.x} ariaLabel={homeDescriptions.x} on:click={homeX}>
            <span class="home-mark" aria-hidden="true">{$machineState.homedAxes.includes('x') ? '✓' : '○'}</span> X
        </ControlButton>
        <ControlButton variant="arrow" disabled={controlsLocked || !$machineState.homedAxes.includes("y")} on:click={() => jog("y", 1)}>Y+</ControlButton>
        <ControlButton variant="action" disabled={controlsLocked} indicator={$machineState.homedAxes.includes('y') ? 'on' : 'off'} title={homeDescriptions.y} ariaLabel={homeDescriptions.y} on:click={homeY}>
            <span class="home-mark" aria-hidden="true">{$machineState.homedAxes.includes('y') ? '✓' : '○'}</span> Y
        </ControlButton>

        <ControlButton variant="arrow" disabled={controlsLocked || !$machineState.homedAxes.includes("x")} on:click={() => jog("x", -1)}>X-</ControlButton>
        <ControlButton variant="home" disabled={controlsLocked} indicator={allHomed ? 'on' : $machineState.homedAxes ? 'mixed' : 'off'} title={'Home all axes — ' + ($machineState.homedAxes.toUpperCase() || 'none') + ' homed'} on:click={home}>
            <span class="home-mark" aria-hidden="true">{allHomed ? '✓' : $machineState.homedAxes ? '◐' : '○'}</span> ALL
        </ControlButton>
        <ControlButton variant="arrow" disabled={controlsLocked || !$machineState.homedAxes.includes("x")} on:click={() => jog("x", 1)}>X+</ControlButton>

        <ControlButton variant="action" disabled={controlsLocked} indicator={$machineState.homedAxes.includes('z') ? 'on' : 'off'} title={homeDescriptions.z} ariaLabel={homeDescriptions.z} on:click={homeZ}>
            <span class="home-mark" aria-hidden="true">{$machineState.homedAxes.includes('z') ? '✓' : '○'}</span> Z
        </ControlButton>
        <ControlButton variant="arrow" disabled={controlsLocked || !$machineState.homedAxes.includes("y")} on:click={() => jog("y", -1)}>Y-</ControlButton>
        <ControlButton variant="danger" indicator={motorState} disabled={controlsLocked || motorState === 'off'} title={'Disable motors — ' + motorDescription} ariaLabel={'Disable motors — ' + motorDescription} on:click={motorsOff}>
            <span class="motor-mark" class:enabled={motorState === 'on'} class:mixed={motorState === 'mixed'} aria-hidden="true">{motorState === 'unknown' ? '?' : motorState === 'off' ? '○' : motorState === 'mixed' ? '◐' : '●'}</span> M-OFF
        </ControlButton>
    </div>

    <!-- Z Controls -->
    <div class="z-controls">
        <ControlButton variant="z-up" disabled={controlsLocked || !$machineState.homedAxes.includes("z")} title="Z+: increase nozzle–bed gap" ariaLabel="Z plus: increase nozzle–bed gap" on:click={() => jog("z", 1)}>
            <svg class="z-direction" viewBox="0 0 44 36" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 31h32M14 4h16l-4 7h-8zM22 14v13m-4-9 4-4 4 4m-8 5 4 4 4-4"/></svg>Z+
        </ControlButton>
        <ControlButton variant="z-down" disabled={controlsLocked || !$machineState.homedAxes.includes("z")} title="Z−: decrease nozzle–bed gap" ariaLabel="Z minus: decrease nozzle–bed gap" on:click={() => jog("z", -1)}>
            <svg class="z-direction" viewBox="0 0 44 36" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 31h32M14 4h16l-4 7h-8zM22 14v13m-4-13 4 4 4-4m-8 13 4-4 4 4"/></svg>Z−
        </ControlButton>
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
                {zOffset >= 0 ? "+" : ""}{zOffset.toFixed(3)}
            </div>
        </div>

        <div class="z-offset-controls">
            <ControlButton variant="arrow" on:click={() => adjustZOffset(1)}
                >+</ControlButton
            >
            <ControlButton variant="arrow" on:click={() => adjustZOffset(-1)}
                >-</ControlButton
            >
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

    <RetroSlider
        label="SPEED FACTOR"
        value={$machineState.speedFactor}
        on:change={onSpeedChange}
    />
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

    .axis-editor input { width:100%; min-width:0; box-sizing:border-box; padding:6px 2px; font:inherit; font-size:24px; font-family:var(--numeric-font); color:var(--retro-green); background:#080d0b; border:1px solid var(--retro-green); text-align:center; }
    .axis-editor-actions { display:flex; gap:4px; margin-top:4px; }
    .axis-editor-actions button { flex:1; min-height:30px; font-size:18px; cursor:pointer; background:#17251c; color:var(--retro-green); border:1px solid var(--border-color); }
    .home-mark,.motor-mark { display:inline-block; min-width:1em; font-family:var(--numeric-font); }
    .motor-mark { color:#91a297; } .motor-mark.enabled { color:var(--retro-green); } .motor-mark.mixed { color:var(--retro-orange); }
    .z-direction { display:inline-block; width:38px; height:32px; vertical-align:middle; margin-right:10px; }
    .axis { min-width:0; }
    .axis-value {
        width:100%; padding:4px 0; border:1px solid transparent; background:transparent; font-family:inherit; cursor:pointer;

        font-size: 32px;
        color: var(--retro-green);
        font-weight: 700;
        letter-spacing: 3px;
    }

    .axis-value:hover:not(:disabled) { border-color:var(--retro-green-dim); }
    .axis-value:disabled { opacity:.6; cursor:default; }

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
