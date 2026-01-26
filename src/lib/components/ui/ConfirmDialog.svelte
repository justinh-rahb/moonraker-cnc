<script>
    import { onDestroy } from "svelte";

    export let isOpen = false;
    export let title = "CONFIRM";
    export let message = "Are you sure?";
    export let confirmButtonText = "CONFIRM";
    export let onConfirm = () => {};
    export let onCancel = () => {};

    $: if (typeof document !== "undefined") {
        document.body.style.overflow = isOpen ? "hidden" : "";
    }

    onDestroy(() => {
        if (typeof document !== "undefined") {
            document.body.style.overflow = "";
        }
    });

    const handleConfirm = () => {
        isOpen = false;
        onConfirm();
    };

    const handleCancel = () => {
        isOpen = false;
        onCancel();
    };

    const handleKeydown = (e) => {
        if (!isOpen) return;
        if (e.key === "Escape") {
            e.preventDefault();
            handleCancel();
        }
    };

    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            handleCancel();
        }
    };
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isOpen}
    <div class="confirm-overlay" on:click={handleOverlayClick}>
        <div class="confirm-dialog">
            <div class="confirm-header">
                <span>▸ {title}</span>
            </div>
            <div class="confirm-body">
                <p>{message}</p>
            </div>
            <div class="confirm-actions">
                <button class="cancel-btn" on:click={handleCancel}>
                    CANCEL
                </button>
                <button class="confirm-btn" on:click={handleConfirm}>
                    {confirmButtonText}
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    .confirm-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.85);
        z-index: 3000;
        display: flex;
        justify-content: center;
        align-items: center;
        backdrop-filter: blur(2px);
    }

    .confirm-dialog {
        width: 400px;
        background: var(--bg-module);
        border: 4px solid var(--retro-orange);
        box-shadow:
            0 0 30px rgba(255, 136, 0, 0.3),
            0 0 0 2px #000;
    }

    .confirm-header {
        font-family: "Orbitron", monospace;
        font-size: 16px;
        font-weight: 900;
        color: var(--retro-orange);
        padding: 12px 15px;
        background: #000;
        border-bottom: 2px solid var(--retro-orange);
        letter-spacing: 2px;
    }

    .confirm-body {
        padding: 25px 20px;
    }

    .confirm-body p {
        color: var(--retro-green);
        font-family: "Share Tech Mono", monospace;
        font-size: 14px;
        margin: 0;
        line-height: 1.5;
    }

    .confirm-actions {
        display: flex;
        gap: 10px;
        padding: 15px 20px;
        background: #0a0a0a;
        border-top: 1px solid #333;
    }

    .cancel-btn,
    .confirm-btn {
        flex: 1;
        padding: 12px;
        font-family: "Orbitron", monospace;
        font-size: 12px;
        font-weight: bold;
        cursor: pointer;
        letter-spacing: 1px;
        border: 2px solid;
    }

    .cancel-btn {
        background: #222;
        border-color: #444;
        color: #888;
    }

    .cancel-btn:hover {
        background: #333;
        color: #aaa;
    }

    .confirm-btn {
        background: #440000;
        border-color: #880000;
        color: #ff4444;
    }

    .confirm-btn:hover {
        background: #660000;
        border-color: #aa0000;
    }
</style>
