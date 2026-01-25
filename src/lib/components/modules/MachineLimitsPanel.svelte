<script>
    import PanelModule from "../ui/PanelModule.svelte";
    import { machineState, setVelocityLimit } from "../../../stores/machineStore.js";
    import { send } from "../../../stores/websocket.js";

    // Current values from machine state
    $: maxVelocity = $machineState.maxVelocity;
    $: maxAccel = $machineState.maxAccel;
    $: squareCornerVelocity = $machineState.squareCornerVelocity;
    $: minimumCruiseRatio = $machineState.minimumCruiseRatio;
    $: maxAccelToDecel = $machineState.maxAccelToDecel;

    // Determine which decel parameter is active (newer Klipper uses minimum_cruise_ratio)
    $: usingMinimumCruiseRatio = minimumCruiseRatio !== null;
    $: activeDecelValue = usingMinimumCruiseRatio ? minimumCruiseRatio : maxAccelToDecel;
    $: decelLabel = usingMinimumCruiseRatio ? "Min Cruise Ratio" : "Max Accel to Decel";
    $: decelUnit = usingMinimumCruiseRatio ? "" : "mm/s²";

    // Edit states for each value
    let editingVelocity = false;
    let editingAccel = false;
    let editingSquareCorner = false;
    let editingDecel = false;

    // Input values
    let velocityInput = 0;
    let accelInput = 0;
    let squareCornerInput = 0;
    let decelInput = 0;

    // Start editing a value
    const startEdit = (field) => {
        switch (field) {
            case "velocity":
                velocityInput = maxVelocity;
                editingVelocity = true;
                break;
            case "accel":
                accelInput = maxAccel;
                editingAccel = true;
                break;
            case "squareCorner":
                squareCornerInput = squareCornerVelocity;
                editingSquareCorner = true;
                break;
            case "decel":
                decelInput = activeDecelValue || 0;
                editingDecel = true;
                break;
        }
    };

    // Cancel editing
    const cancelEdit = (field) => {
        switch (field) {
            case "velocity":
                editingVelocity = false;
                break;
            case "accel":
                editingAccel = false;
                break;
            case "squareCorner":
                editingSquareCorner = false;
                break;
            case "decel":
                editingDecel = false;
                break;
        }
    };

    // Apply changes
    const applyVelocity = () => {
        const value = Number(velocityInput);
        if (!isNaN(value) && value > 0 && value <= 1000) {
            setVelocityLimit({ velocity: value });
            editingVelocity = false;
        }
    };

    const applyAccel = () => {
        const value = Number(accelInput);
        if (!isNaN(value) && value > 0 && value <= 50000) {
            setVelocityLimit({ accel: value });
            editingAccel = false;
        }
    };

    const applySquareCorner = () => {
        const value = Number(squareCornerInput);
        if (!isNaN(value) && value >= 0 && value <= 50) {
            setVelocityLimit({ squareCornerVelocity: value });
            editingSquareCorner = false;
        }
    };

    const applyDecel = () => {
        const value = Number(decelInput);
        if (usingMinimumCruiseRatio) {
            // Minimum cruise ratio: 0.0 = disabled, 0.5 = default, 1.0 = maximum
            if (!isNaN(value) && value >= 0 && value <= 1) {
                setVelocityLimit({ minimumCruiseRatio: value });
                editingDecel = false;
            }
        } else {
            // Max accel to decel (legacy)
            if (!isNaN(value) && value > 0 && value <= 50000) {
                setVelocityLimit({ accelToDecel: value });
                editingDecel = false;
            }
        }
    };

    // Save config to persist changes
    const saveConfig = () => {
        send("printer.gcode.script", { script: "SAVE_CONFIG" });
    };

    // Handle Enter key
    const handleKeydown = (e, applyFn) => {
        if (e.key === "Enter") {
            applyFn();
        } else if (e.key === "Escape") {
            const field = e.target.dataset.field;
            cancelEdit(field);
        }
    };
</script>

<PanelModule title="MOTION LIMITS">
    <div class="limits-container">
        <!-- Max Velocity -->
        <div class="limit-row">
            <div class="limit-label" title="Maximum toolhead velocity">
                Max Velocity
            </div>
            {#if editingVelocity}
                <div class="edit-controls">
                    <input
                        type="number"
                        class="limit-input"
                        bind:value={velocityInput}
                        data-field="velocity"
                        on:keydown={(e) => handleKeydown(e, applyVelocity)}
                        step="10"
                        min="1"
                        max="1000"
                    />
                    <button
                        class="btn btn-apply"
                        on:click={applyVelocity}
                        title="Apply"
                    >
                        ✓
                    </button>
                    <button
                        class="btn btn-cancel"
                        on:click={() => cancelEdit("velocity")}
                        title="Cancel"
                    >
                        ✕
                    </button>
                </div>
            {:else}
                <div
                    class="value-display"
                    role="button"
                    tabindex="0"
                    on:click={() => startEdit("velocity")}
                    on:keydown={(e) => e.key === 'Enter' && startEdit("velocity")}
                >
                    <span class="value">{maxVelocity.toFixed(1)}</span>
                    <span class="unit">mm/s</span>
                </div>
            {/if}
        </div>

        <!-- Max Acceleration -->
        <div class="limit-row">
            <div class="limit-label" title="Maximum toolhead acceleration">
                Max Accel
            </div>
            {#if editingAccel}
                <div class="edit-controls">
                    <input
                        type="number"
                        class="limit-input"
                        bind:value={accelInput}
                        data-field="accel"
                        on:keydown={(e) => handleKeydown(e, applyAccel)}
                        step="100"
                        min="1"
                        max="50000"
                    />
                    <button
                        class="btn btn-apply"
                        on:click={applyAccel}
                        title="Apply"
                    >
                        ✓
                    </button>
                    <button
                        class="btn btn-cancel"
                        on:click={() => cancelEdit("accel")}
                        title="Cancel"
                    >
                        ✕
                    </button>
                </div>
            {:else}
                <div
                    class="value-display"
                    role="button"
                    tabindex="0"
                    on:click={() => startEdit("accel")}
                    on:keydown={(e) => e.key === 'Enter' && startEdit("accel")}
                >
                    <span class="value">{maxAccel.toFixed(0)}</span>
                    <span class="unit">mm/s²</span>
                </div>
            {/if}
        </div>

        <!-- Square Corner Velocity -->
        <div class="limit-row">
            <div
                class="limit-label"
                title="Maximum velocity for 90° corners (higher = faster corners, more ringing)"
            >
                Square Corner
            </div>
            {#if editingSquareCorner}
                <div class="edit-controls">
                    <input
                        type="number"
                        class="limit-input"
                        bind:value={squareCornerInput}
                        data-field="squareCorner"
                        on:keydown={(e) => handleKeydown(e, applySquareCorner)}
                        step="0.5"
                        min="0"
                        max="50"
                    />
                    <button
                        class="btn btn-apply"
                        on:click={applySquareCorner}
                        title="Apply"
                    >
                        ✓
                    </button>
                    <button
                        class="btn btn-cancel"
                        on:click={() => cancelEdit("squareCorner")}
                        title="Cancel"
                    >
                        ✕
                    </button>
                </div>
            {:else}
                <div
                    class="value-display"
                    role="button"
                    tabindex="0"
                    on:click={() => startEdit("squareCorner")}
                    on:keydown={(e) => e.key === 'Enter' && startEdit("squareCorner")}
                >
                    <span class="value">{squareCornerVelocity.toFixed(1)}</span>
                    <span class="unit">mm/s</span>
                </div>
            {/if}
        </div>

        <!-- Minimum Cruise Ratio / Max Accel to Decel -->
        <div class="limit-row">
            <div
                class="limit-label"
                title={usingMinimumCruiseRatio
                    ? "Minimum distance at cruise speed relative to total distance (0.0 = disabled, 0.5 = default)"
                    : "Maximum deceleration rate (legacy)"}
            >
                {decelLabel}
                <span class="version-indicator"
                    >{usingMinimumCruiseRatio ? "(New)" : "(Legacy)"}</span
                >
            </div>
            {#if editingDecel}
                <div class="edit-controls">
                    <input
                        type="number"
                        class="limit-input"
                        bind:value={decelInput}
                        data-field="decel"
                        on:keydown={(e) => handleKeydown(e, applyDecel)}
                        step={usingMinimumCruiseRatio ? 0.05 : 100}
                        min={usingMinimumCruiseRatio ? 0 : 1}
                        max={usingMinimumCruiseRatio ? 1 : 50000}
                    />
                    <button
                        class="btn btn-apply"
                        on:click={applyDecel}
                        title="Apply"
                    >
                        ✓
                    </button>
                    <button
                        class="btn btn-cancel"
                        on:click={() => cancelEdit("decel")}
                        title="Cancel"
                    >
                        ✕
                    </button>
                </div>
            {:else}
                <div
                    class="value-display"
                    role="button"
                    tabindex="0"
                    on:click={() => startEdit("decel")}
                    on:keydown={(e) => e.key === 'Enter' && startEdit("decel")}
                >
                    <span class="value">
                        {activeDecelValue !== null
                            ? usingMinimumCruiseRatio
                                ? activeDecelValue.toFixed(2)
                                : activeDecelValue.toFixed(0)
                            : "N/A"}
                    </span>
                    {#if decelUnit}
                        <span class="unit">{decelUnit}</span>
                    {/if}
                </div>
            {/if}
        </div>

        <!-- Info and Actions -->
        <div class="info-section">
            <div class="info-text">
                Click values to edit. Changes apply immediately. Use SAVE_CONFIG
                to persist.
            </div>
            <button class="btn btn-save" on:click={saveConfig}>
                SAVE CONFIG
            </button>
        </div>
    </div>
</PanelModule>

<style>
    .limits-container {
        display: flex;
        flex-direction: column;
        gap: 15px;
    }

    .limit-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        align-items: center;
        gap: 15px;
        padding: 10px;
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid #333;
    }

    .limit-label {
        font-family: "Orbitron", monospace;
        font-size: 14px;
        font-weight: 600;
        color: var(--retro-green);
        text-transform: uppercase;
        letter-spacing: 1px;
    }

    .version-indicator {
        font-size: 10px;
        color: #888;
        font-weight: 400;
        margin-left: 5px;
    }

    .value-display {
        display: flex;
        align-items: baseline;
        gap: 5px;
        justify-content: flex-end;
        cursor: pointer;
        padding: 8px 12px;
        background: rgba(0, 255, 0, 0.05);
        border: 1px solid rgba(0, 255, 0, 0.2);
        transition: all 0.2s;
    }

    .value-display:hover {
        background: rgba(0, 255, 0, 0.1);
        border-color: var(--retro-green);
        box-shadow: 0 0 10px rgba(0, 255, 0, 0.3);
    }

    .value {
        font-family: "Orbitron", monospace;
        font-size: 20px;
        font-weight: 700;
        color: var(--retro-green);
        text-shadow: 0 0 10px rgba(0, 255, 0, 0.5);
    }

    .unit {
        font-family: "Orbitron", monospace;
        font-size: 12px;
        color: #888;
    }

    .edit-controls {
        display: flex;
        gap: 5px;
        justify-content: flex-end;
    }

    .limit-input {
        font-family: "Orbitron", monospace;
        font-size: 16px;
        padding: 8px;
        background: #000;
        border: 2px solid var(--retro-green);
        color: var(--retro-green);
        text-align: right;
        width: 120px;
        box-shadow: inset 0 0 10px rgba(0, 255, 0, 0.2);
    }

    .limit-input:focus {
        outline: none;
        box-shadow:
            inset 0 0 10px rgba(0, 255, 0, 0.2),
            0 0 15px rgba(0, 255, 0, 0.5);
    }

    .btn {
        font-family: "Orbitron", monospace;
        font-size: 14px;
        font-weight: 700;
        padding: 8px 12px;
        border: 2px solid;
        background: rgba(0, 0, 0, 0.5);
        cursor: pointer;
        text-transform: uppercase;
        letter-spacing: 1px;
        transition: all 0.2s;
    }

    .btn-apply {
        color: var(--retro-green);
        border-color: var(--retro-green);
    }

    .btn-apply:hover {
        background: var(--retro-green);
        color: #000;
        box-shadow: 0 0 15px rgba(0, 255, 0, 0.5);
    }

    .btn-cancel {
        color: #ff4444;
        border-color: #ff4444;
    }

    .btn-cancel:hover {
        background: #ff4444;
        color: #000;
        box-shadow: 0 0 15px rgba(255, 68, 68, 0.5);
    }

    .info-section {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-top: 10px;
        padding-top: 15px;
        border-top: 1px solid #333;
    }

    .info-text {
        font-family: "Orbitron", monospace;
        font-size: 11px;
        color: #888;
        text-align: center;
        line-height: 1.4;
    }

    .btn-save {
        color: #00ffff;
        border-color: #00ffff;
        width: 100%;
    }

    .btn-save:hover {
        background: #00ffff;
        color: #000;
        box-shadow: 0 0 15px rgba(0, 255, 255, 0.5);
    }

    /* Remove spinner from number inputs */
    .limit-input::-webkit-inner-spin-button,
    .limit-input::-webkit-outer-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }

    .limit-input[type="number"] {
        -moz-appearance: textfield;
        appearance: textfield;
    }
</style>
