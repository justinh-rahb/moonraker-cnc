import { writable } from 'svelte/store';
import { notificationStore } from './notificationStore.js';
import { consoleStore } from './consoleStore.js';

export const connectionState = writable('disconnected'); // disconnected, connecting, connected, error
export const lastError = writable(null);

let socket = null;
let requestId = 0;
const pendingRequests = new Map();
const eventListeners = new Set(); // Listeners for notify_* events

export const connect = (url) => {
    if (socket) {
        socket.close();
    }

    connectionState.set('connecting');
    lastError.set(null);

    // Normalize URL
    if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
        url = `ws://${url}`;
    }
    // Append /websocket if not present
    if (!url.endsWith('/websocket')) {
        url = `${url.replace(/\/+$/, '')}/websocket`;
    }

    try {
        socket = new WebSocket(url);
    } catch (e) {
        connectionState.set('error');
        lastError.set(e.message);
        return;
    }

    socket.onopen = () => {
        connectionState.set('connected');
        console.log('Connected to Moonraker at', url);
    };

    socket.onclose = () => {
        connectionState.set('disconnected');
        console.log('Disconnected from Moonraker');
        socket = null;
        // Optionally auto-reconnect logic could go here
    };

    socket.onerror = (err) => {
        console.error('WebSocket Error:', err);
        connectionState.set('error');
        lastError.set('Connection failed');
    };

    socket.onmessage = (message) => {
        try {
            const data = JSON.parse(message.data);

            // Handle Responses
            if (data.id !== undefined && pendingRequests.has(data.id)) {
                const { resolve, reject } = pendingRequests.get(data.id);
                pendingRequests.delete(data.id);
                if (data.error) {
                    notificationStore.addError(data.error);
                    reject(data.error);
                } else {
                    resolve(data.result);
                }
            }
            // Handle Notifications (no ID)
            else if (data.method) {
                // Monitor for system-wide alerts
                if (data.method === 'notify_klippy_shutdown') {
                    notificationStore.setSystemStatus('shutdown');
                } else if (data.method === 'notify_klippy_disconnected') {
                     // Maybe treat disconnect same as shutdown/error?
                     notificationStore.setSystemStatus('error');
                } else if (data.method === 'notify_klippy_ready') {
                    notificationStore.setSystemStatus('ready');
                }
                
                eventListeners.forEach(listener => listener(data.method, data.params));
            }
        } catch (e) {
            console.error('Error parsing message:', e);
        }
    };
};

export const disconnect = () => {
    if (socket) {
        socket.close();
    }
};

export const send = (method, params = {}) => {
    return new Promise((resolve, reject) => {
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            reject(new Error('Socket not connected'));
            return;
        }

        // Log G-code commands to console
        if (method === 'printer.gcode.script' && params.script) {
            consoleStore.addCommand(params.script);
        }

        const id = ++requestId;
        const payload = JSON.stringify({
            jsonrpc: '2.0',
            method,
            params,
            id
        });

        pendingRequests.set(id, { resolve, reject });
        socket.send(payload);
    });
};

export const onNotification = (callback) => {
    eventListeners.add(callback);
    return () => eventListeners.delete(callback);
};
