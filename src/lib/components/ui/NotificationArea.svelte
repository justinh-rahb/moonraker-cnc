<script>
    import { notificationStore } from "../../../stores/notificationStore.js";
    import { fly, fade } from 'svelte/transition';

    const dismiss = (id) => {
        notificationStore.remove(id);
    };
</script>

<div class="notification-area">
    {#each $notificationStore as notification (notification.id)}
        <div 
            class="notification {notification.type}" 
            transition:fly={{ y: 20, duration: 300 }}
        >
            <div class="content">
                <div class="title">{notification.title}</div>
                <div class="message">{notification.message}</div>
            </div>
            
            {#if notification.dismissible}
                <button class="dismiss-btn" on:click={() => dismiss(notification.id)}>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            {/if}
        </div>
    {/each}
</div>

<style>
    .notification-area {
        position: fixed;
        bottom: 20px;
        right: 20px; /* Or center: left: 50%; transform: translateX(-50%); */
        display: flex;
        flex-direction: column;
        gap: 10px;
        z-index: 9999;
        max-width: 400px;
        width: 100%;
        pointer-events: none; /* Let clicks pass through empty space */
        padding: 0 20px;
    }

    .notification {
        background: #1a1a1a;
        color: #fff;
        border: 1px solid #333;
        border-left: 4px solid #fff;
        padding: 15px;
        border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        pointer-events: auto;
    }

    .notification.error {
        border-left-color: #ff3e3e;
        background: rgba(40, 10, 10, 0.95);
    }

    .notification.system-error {
        border-left-color: #ff0000;
        background: rgba(60, 0, 0, 0.95);
        border: 1px solid #ff0000;
        animation: pulse-border 2s infinite;
    }

    .content {
        flex: 1;
        margin-right: 15px;
    }

    .title {
        font-weight: bold;
        font-size: 0.9rem;
        margin-bottom: 5px;
        text-transform: uppercase;
        font-family: 'Orbitron', monospace;
        letter-spacing: 1px;
    }

    .notification.error .title {
        color: #ff3e3e;
    }

    .notification.system-error .title {
        color: #ff0000;
    }

    .message {
        font-size: 0.85rem;
        word-break: break-word; /* Handle long error messages */
        line-height: 1.4;
        color: #ccc;
        font-family: monospace;
    }

    .dismiss-btn {
        background: none;
        border: none;
        color: #666;
        cursor: pointer;
        padding: 4px;
        margin: -4px;
        border-radius: 4px;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .dismiss-btn:hover {
        color: #fff;
        background: rgba(255,255,255,0.1);
    }

    @keyframes pulse-border {
        0% { box-shadow: 0 0 0 0 rgba(255, 0, 0, 0.4); }
        70% { box-shadow: 0 0 0 10px rgba(255, 0, 0, 0); }
        100% { box-shadow: 0 0 0 0 rgba(255, 0, 0, 0); }
    }
</style>
