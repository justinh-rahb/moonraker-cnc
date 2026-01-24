<script>
    export let color = "green"; // green, red, off
    export let on = true;
</script>

<div class="led {color}" class:on></div>

<style>
    .led {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        border: 3px solid #000;
        position: relative;
        background: #111;
        box-shadow: inset 0 0 8px rgba(0, 0, 0, 0.8);
        transition: all 0.2s;
    }

    .led.green.on {
        background: radial-gradient(
            circle at 30% 30%,
            var(--retro-green),
            var(--retro-green-dim)
        );
        box-shadow:
            inset 0 0 8px rgba(0, 0, 0, 0.8),
            0 0 5px var(--retro-green);
    }

    .led.red.on {
        background: radial-gradient(
            circle at 30% 30%,
            var(--retro-red),
            var(--retro-red-dim)
        );
        box-shadow:
            inset 0 0 8px rgba(0, 0, 0, 0.8),
            0 0 5px var(--retro-red);
    }
</style>
