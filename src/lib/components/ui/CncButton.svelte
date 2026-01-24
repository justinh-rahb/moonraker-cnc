<script>
    export let variant = "standard"; // standard, arrow, z-up, z-down, home, active, center, danger
    export let active = false;
    export let disabled = false;

    // Compute classes based on variant
    $: classes = [
        "cnc-button",
        variant,
        active ? "active" : "",
        disabled ? "disabled" : "",
    ]
        .filter(Boolean)
        .join(" ");
</script>

<button class={classes} on:click {disabled}>
    <slot></slot>
</button>

<style>
    .cnc-button {
        background: linear-gradient(180deg, #3a3a3a 0%, #2a2a2a 100%);
        border: 3px solid #4a4a4a;
        color: var(--retro-green);
        padding: 20px;
        font-family: "Orbitron", monospace;
        font-size: 18px;
        font-weight: 700;
        cursor: pointer;
        box-shadow:
            0 4px 0 #1a1a1a,
            0 6px 15px rgba(0, 0, 0, 0.8),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
        transition: all 0.1s;
        width: 100%; /* Ensure it fills grid cells */
    }

    .cnc-button:hover:not(:disabled) {
        background: linear-gradient(180deg, #4a4a4a 0%, #3a3a3a 100%);
        color: var(--retro-green-hover);
    }

    .cnc-button:active:not(:disabled),
    .cnc-button.active {
        transform: translateY(4px);
        box-shadow:
            0 0 0 #1a1a1a,
            0 2px 8px rgba(0, 0, 0, 0.8),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
    }

    /* Variants */
    .cnc-button.arrow {
        font-size: 24px;
    }

    .cnc-button.z-up,
    .cnc-button.z-down {
        font-size: 20px;
    }

    .cnc-button.home {
        background: linear-gradient(
            180deg,
            var(--retro-orange) 0%,
            var(--retro-orange-dim) 100%
        );
        color: #000;
        border-color: #ff8833;
        padding: 16px;
        font-size: 16px; /* Equalized font size */
        letter-spacing: 1px;
        text-transform: uppercase;
    }
    .cnc-button.home:hover:not(:disabled) {
        background: linear-gradient(180deg, #ff7722 0%, #dd6611 100%);
    }

    .cnc-button.center {
        background: #0a0a0a;
        cursor: default;
        border-color: #333;
        box-shadow: none;
    }
    .cnc-button.center:hover {
        background: #0a0a0a;
        color: var(--retro-green);
    }

    /* Action button style (reusing base but modifying) */
    .cnc-button.action {
        background: linear-gradient(180deg, #004400 0%, #003300 100%);
        border: 3px solid #006600;
        padding: 16px;
        font-size: 16px; /* Equalized font size */
        letter-spacing: 1px;
        text-transform: uppercase;
        box-shadow:
            0 4px 0 #002200,
            0 6px 15px rgba(0, 100, 0, 0.5);
    }

    .cnc-button.action:active {
        transform: translateY(4px);
        box-shadow:
            0 0 0 #002200,
            0 2px 8px rgba(0, 100, 0, 0.3);
    }

    .cnc-button.danger {
        background: linear-gradient(180deg, #440000 0%, #330000 100%);
        border-color: #660000;
        color: #ff4444;
        padding: 16px;
        font-size: 16px; /* Equalized font size */
        letter-spacing: 1px;
        text-transform: uppercase;
        box-shadow:
            0 4px 0 #220000,
            0 6px 15px rgba(100, 0, 0, 0.5);
    }

    /* Darkened variant - like move buttons */
    .cnc-button.dark {
        background: linear-gradient(180deg, #3a3a3a 0%, #2a2a2a 100%);
        border: 3px solid #4a4a4a;
        color: var(--retro-green);
        padding: 16px;
        font-size: 16px;
        letter-spacing: 1px;
        text-transform: uppercase;
        box-shadow:
            0 4px 0 #1a1a1a,
            0 6px 15px rgba(0, 0, 0, 0.8),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
    }

    .cnc-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        filter: grayscale(0.8);
    }
</style>
