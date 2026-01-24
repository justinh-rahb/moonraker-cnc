<script>
    export let selectedColor = "action";
    export let onChange = (color) => {};

    const colors = [
        { value: "action", label: "Green (Action)", class: "action" },
        { value: "danger", label: "Red (Danger)", class: "danger" },
        { value: "home", label: "Orange (Home)", class: "home" },
    ];

    const handleChange = (color) => {
        selectedColor = color;
        onChange(color);
    };
</script>

<div class="color-picker">
    {#each colors as color}
        <button
            class="color-option {color.class} {selectedColor === color.value
                ? 'selected'
                : ''}"
            on:click={() => handleChange(color.value)}
            title={color.label}
        >
            {color.label}
        </button>
    {/each}
</div>

<style>
    .color-picker {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
    }

    .color-option {
        padding: 8px 12px;
        border: 2px solid transparent;
        font-family: "Share Tech Mono", monospace;
        font-size: 11px;
        cursor: pointer;
        transition: all 0.2s;
        flex: 1;
        min-width: 100px;
    }

    .color-option.action {
        background: linear-gradient(180deg, #004400 0%, #003300 100%);
        color: var(--retro-green);
    }

    .color-option.danger {
        background: linear-gradient(180deg, #440000 0%, #330000 100%);
        color: #ff4444;
    }

    .color-option.home {
        background: linear-gradient(
            180deg,
            var(--retro-orange) 0%,
            var(--retro-orange-dim) 100%
        );
        color: #000;
    }

    .color-option.selected {
        border-color: #fff;
        box-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
    }

    .color-option:hover {
        transform: scale(1.05);
    }
</style>
