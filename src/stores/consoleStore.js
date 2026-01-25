import { writable } from 'svelte/store';

// Console message store
const createConsoleStore = () => {
    const { subscribe, update } = writable([]);

    return {
        subscribe,
        addCommand: (command) => {
            update(messages => {
                const newMessage = {
                    type: 'command',
                    text: command,
                    timestamp: new Date()
                };
                return [...messages, newMessage];
            });
        },
        addResponse: (response) => {
            // Filter out temperature events (e.g., "B:62.5 /65.0 T0:29.9 /0.0")
            if (/^[BT]\d*:[\d.]+\s*\/[\d.]+/.test(response)) {
                return;
            }
            
            update(messages => {
                const newMessage = {
                    type: 'response',
                    text: response,
                    timestamp: new Date()
                };
                return [...messages, newMessage];
            });
        },
        addError: (error) => {
            update(messages => {
                const newMessage = {
                    type: 'error',
                    text: error,
                    timestamp: new Date()
                };
                return [...messages, newMessage];
            });
        },
        clear: () => {
            update(() => []);
        },
        trimToLimit: (maxHistory) => {
            update(messages => {
                if (messages.length > maxHistory) {
                    return messages.slice(-maxHistory);
                }
                return messages;
            });
        }
    };
};

export const consoleStore = createConsoleStore();
