<script>
    export let value = "0.00";
</script>

<div class="segment-display">
    <div class="segment-value"><slot>{value}</slot></div>
</div>

<style>
    .segment-display {
        background: #000;
        border: 4px solid #2a2a2a;
        padding: 20px;
        text-align: center;
        margin-bottom: 20px;
        box-shadow: inset 0 0 30px rgba(0, 255, 0, 0.05);
    }

    .segment-value {
        font-family: "Orbitron", monospace;
        font-size: 48px;
        font-weight: 900;
        color: var(--retro-orange);
        letter-spacing: 8px;
    }
</style>
