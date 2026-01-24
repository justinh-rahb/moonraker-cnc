<script>
    // Pure CSS effect, no logic needed
</script>

<div class="scanline"></div>

<style>
    .scanline {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: repeating-linear-gradient(
            0deg,
            rgba(0,0,0,0.15) 0px,
            rgba(0,0,0,0.15) 1px,
            transparent 1px,
            transparent 3px
        );
        pointer-events: none;
        z-index: 1000;
    }
</style>
