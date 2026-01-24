<script>
    export let title = "MODULE";
</script>

<div class="module">
    <div class="module-header">▸ {title}</div>
    <slot></slot>
</div>

<style>
    .module {
        background: var(--bg-module);
        border: 4px solid #333;
        padding: 20px;
        box-shadow:
            inset 0 0 20px rgba(0, 0, 0, 0.5),
            0 4px 15px rgba(0, 0, 0, 0.7);
        height: 100%; /* Ensure modules can stretch if needed */
    }

    .module-header {
        font-family: "Orbitron", monospace;
        font-size: 18px;
        font-weight: 700;
        color: var(--retro-green);
        margin-bottom: 20px;
        padding: 10px;
        background: #0a0a0a;
        border-left: 4px solid var(--retro-green);
        text-transform: uppercase;
        letter-spacing: 2px;
    }
</style>
