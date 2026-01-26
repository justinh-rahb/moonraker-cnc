<script>
    import { onDestroy, tick } from "svelte";

    export let isOpen = false;
    export let title = "INPUT";
    export let message = "Enter value:";
    export let value = "";
    export let placeholder = "";
    export let confirmButtonText = "CONFIRM";
    export let onConfirm = () => {};
    export let onCancel = () => {};

    let inputEl;

    $: if (typeof document !== "undefined") {
        document.body.style.overflow = isOpen ? "hidden" : "";
    }

    // Auto-focus input when opened
    $: if (isOpen) {
        focusInput();
    }

    async function focusInput() {
        await tick();
        if (inputEl) {
            inputEl.focus();
            inputEl.select();
        }
    }

    onDestroy(() => {
        if (typeof document !== "undefined") {
            document.body.style.overflow = "";
        }
    });

    const handleConfirm = () => {
        isOpen = false;
        onConfirm(value);
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
        if (e.key === "Enter") {
            e.preventDefault();
            handleConfirm();
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
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="confirm-overlay" on:click={handleOverlayClick}>
        <div class="confirm-dialog">
            <div class="confirm-header">
                <span>▸ {title}</span>
            </div>
            <div class="confirm-body">
                <p>{message}</p>
                <input 
                    type="text" 
                    bind:this={inputEl}
                    bind:value 
                    {placeholder}
                    spellcheck="false"
                />
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
        border: 4px solid var(--retro-green);
        box-shadow:
            0 0 30px rgba(0, 255, 0, 0.1),
            0 0 0 2px #000;
    }

    .confirm-header {
        font-family: "Orbitron", monospace;
        font-size: 16px;
        font-weight: 900;
        color: var(--retro-green);
        padding: 12px 15px;
        background: #000;
        border-bottom: 2px solid var(--retro-green);
        letter-spacing: 2px;
    }

    .confirm-body {
        padding: 25px 20px;
        display: flex;
        flex-direction: column;
        gap: 15px;
    }

    .confirm-body p {
        color: var(--retro-green);
        font-family: "Share Tech Mono", monospace;
        font-size: 14px;
        margin: 0;
        line-height: 1.5;
    }

    input {
        background: #000;
        border: 2px solid #333;
        color: var(--retro-green);
        font-family: "Share Tech Mono", monospace;
        font-size: 16px;
        padding: 10px;
        width: 100%;
        outline: none;
    }

    input:focus {
        border-color: var(--retro-green);
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
        background: linear-gradient(180deg, #1a2a1a 0%, #0a1a0a 100%);
        border-color: var(--retro-green-dim);
        color: var(--retro-green);
    }

    .confirm-btn:hover {
        background: #1f3f1f;
        border-color: var(--retro-green);
        box-shadow: 0 0 15px rgba(0, 255, 0, 0.2);
    }
</style>
