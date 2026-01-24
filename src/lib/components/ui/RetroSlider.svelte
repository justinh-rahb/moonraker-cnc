<script>
    export let value = 100;
    export let min = 0;
    export let max = 200;
    export let label = "VALUE";
</script>

<div class="slider-control">
    <div class="slider-label">
        <span>{label}</span>
        <span>{value}%</span>
    </div>
    <input type="range" class="slider" {min} {max} bind:value on:input />
</div>

<style>
    .slider-control {
        margin-bottom: 20px;
        width: 100%;
    }

    .slider-label {
        display: flex;
        justify-content: space-between;
        margin-bottom: 10px;
        color: var(--retro-green);
        font-size: 14px;
        text-transform: uppercase;
    }

    .slider {
        width: 100%;
        height: 8px;
        background: #0a0a0a;
        border: 2px solid #333;
        outline: none;
        -webkit-appearance: none;
        appearance: none;
    }

    .slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 24px;
        height: 24px;
        background: var(--retro-green);
        border: 3px solid var(--retro-green-dim);
        cursor: pointer;
    }

    .slider::-moz-range-thumb {
        width: 24px;
        height: 24px;
        background: var(--retro-green);
        border: 3px solid var(--retro-green-dim);
        cursor: pointer;
    }
</style>
