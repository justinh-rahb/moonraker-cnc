import { writable, derived } from 'svelte/store';

function createNotificationStore() {
    const { subscribe, update, set } = writable([]);

    let nextId = 0;

    return {
        subscribe,
        addError: (error) => {
            const id = ++nextId;
            let title = 'Error';
            let message = '';
            let code = null;

            if (typeof error === 'string') {
                message = error;
            } else if (error && typeof error === 'object') {
                code = error.code;
                message = error.message;
                // Try to handle specific Klipper/Moonraker error formats
                if (typeof message === 'string' && message.includes('Move out of range')) {
                     // Custom parsing if needed, but display raw message is usually best
                }
            } else {
                message = 'Unknown error occurred';
            }

            const notification = {
                id,
                type: 'error',
                title: code ? `Error ${code}` : 'Error',
                message,
                timestamp: Date.now(),
                dismissible: true
            };

            update(n => [...n, notification]);
        },
        addSystemError: (message) => {
            // These are persistent errors (like Klipper stopped)
            // Check if already exists to avoid dupes?
            update(n => {
                 // Check if we already have a specialized system error for this? 
                 // For now just add it.
                 // Actually, requirement says "Light persists until user dismisses error notifications"
                 // BUT "For Klipper stop conditions: light remains until Klippy/firmware successfully restarts. Cannot dismiss Klipper stop errors until system is actually recovered"
                 
                 // Let's mark these as NOT dismissible
                 const id = ++nextId;
                 return [...n, {
                     id,
                     type: 'system-error',
                     title: 'System Error',
                     message,
                     timestamp: Date.now(),
                     dismissible: false
                 }];
            })
        },
        remove: (id) => update(n => n.filter(i => i.id !== id)),
        clearDismissible: () => update(n => n.filter(i => !i.dismissible)),
        setSystemStatus: (status) => {
             // Logic to handle system wide status like "startup", "ready", "shutdown", "error"
             // If status is "shutdown" or "error", add a locked notification if one doesn't exist.
             // If status returns to "ready", remove that locked notification.
             update(notifications => {
                 const SYSTEM_ERR_ID = -1; // Special ID for the persistent system error
                 const hasSystemErr = notifications.find(n => n.id === SYSTEM_ERR_ID);
                 
                 if (status === 'shutdown' || status === 'error') {
                     if (!hasSystemErr) {
                         return [...notifications, {
                             id: SYSTEM_ERR_ID,
                             type: 'system-error',
                             title: 'Klipper Stopped',
                             message: 'System is in shutdown or error state',
                             timestamp: Date.now(),
                             dismissible: false
                         }];
                     }
                 } else if (status === 'ready' || status === 'startup') {
                     if (hasSystemErr) {
                         return notifications.filter(n => n.id !== SYSTEM_ERR_ID);
                     }
                 }
                 return notifications;
             });
        }
    };
}

export const notificationStore = createNotificationStore();

export const hasErrors = derived(notificationStore, $notifications => {
    return $notifications.length > 0;
});

export const hasSystemError = derived(notificationStore, $notifications => {
    return $notifications.some(n => n.type === 'system-error');
});
