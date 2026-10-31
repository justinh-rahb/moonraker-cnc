import { requestTimeout, isReadRequest } from '../lib/rpc.js';
import { writable } from 'svelte/store';
import { notificationStore } from './notificationStore.js';
import { consoleStore } from './consoleStore.js';

export const connectionState = writable('disconnected');
export const lastError = writable(null);
const listeners = new Set();
let socket;
let endpoint;
let generation = 0;
let requestId = 0;
let retries = 0;
let reconnectTimer;
let heartbeatTimer;
let openingTimer;
let desired = false;
const pending = new Map();
export const getConnectionGeneration = () => generation;

export function normalizeWebsocketUrl(input) {
    const url = new URL(input.includes('://') ? input : `${globalThis.location?.protocol === 'https:' ? 'wss' : 'ws'}://${input}`);
    url.protocol = ['https:', 'wss:'].includes(url.protocol) ? 'wss:' : 'ws:';
    url.pathname = `${url.pathname.replace(/\/(websocket)?\/*$/, '').replace(/\/$/, '')}/websocket`;
    return url.href;
}
function cleanup(message = 'Connection closed; request was not retried') {
    clearTimeout(reconnectTimer);
    clearInterval(heartbeatTimer);
    clearTimeout(openingTimer);
    for (const { reject, timer } of pending.values()) { clearTimeout(timer); reject(new Error(message)); }
    pending.clear();
    const previous = socket;
    socket = undefined;
    if (previous) { previous.onclose = previous.onmessage = previous.onopen = previous.onerror = null; previous.close(); }
}
function retry() {
    if (!desired) return;
    connectionState.set('reconnecting');
    const delay = Math.min(30000, 1000 * 2 ** Math.min(retries++, 5)) + Math.random() * 300;
    reconnectTimer = setTimeout(openSocket, delay);
}
function openSocket() {
    cleanup();
    const session = ++generation;
    connectionState.set(retries ? 'reconnecting' : 'connecting');
    let current;
    try { current = new WebSocket(endpoint); socket = current; }
    catch (error) { lastError.set(error.message); retry(); return; }
    const currentSession = () => session === generation && socket === current;
    openingTimer = setTimeout(() => { if (currentSession() && current.readyState !== 1) current.close(); }, 12000);
    current.onopen = () => {
        if (!currentSession()) return;
        clearTimeout(openingTimer);
        retries = 0;
        lastError.set(null);
        connectionState.set('connected');
        heartbeatTimer = setInterval(() => {
            send('server.info', {}, { timeout: 10000, silent: true }).catch(() => {
                if (currentSession()) current.close();
            });
        }, 20000);
    };
    current.onclose = () => {
        if (!currentSession()) return;
        clearTimeout(openingTimer);
        generation++;
        cleanup();
        lastError.set('Connection interrupted. Reconnecting automatically…');
        retry();
    };
    current.onerror = () => { if (currentSession()) lastError.set('Unable to reach Moonraker'); };
    current.onmessage = message => {
        if (!currentSession()) return;
        let data;
        try { data = JSON.parse(message.data); } catch { return; }
        if (data.id !== undefined && pending.has(data.id)) {
            const request = pending.get(data.id);
            clearTimeout(request.timer);
            pending.delete(data.id);
            if (data.error) {
                if (!request.silent && data.error.code !== -32601) notificationStore.addError(data.error);
                request.reject(data.error);
            } else request.resolve(data.result);
        } else if (data.method) {
            if (data.method === 'notify_klippy_shutdown') notificationStore.setSystemStatus('shutdown');
            if (data.method === 'notify_klippy_disconnected') notificationStore.setSystemStatus('error');
            if (data.method === 'notify_klippy_ready') notificationStore.setSystemStatus('ready');
            for (const listener of listeners) { try { listener(data.method, data.params); } catch (error) { console.error('Notification handler failed', error); } }
        }
    };
}
export function connect(url) {
    try { endpoint = normalizeWebsocketUrl(url); }
    catch (error) { lastError.set(error.message); return; }
    desired = true;
    retries = 0;
    openSocket();
}
export function disconnect() {
    desired = false;
    generation++;
    cleanup();
    connectionState.set('disconnected');
}
export function send(method, params = {}, { timeout = requestTimeout(method), silent = false } = {}) {
    const promise = new Promise((resolve, reject) => {
        if (import.meta.env?.VITE_READ_ONLY === 'true' && !isReadRequest(method)) { reject(new Error('Hardware writes are disabled in this validation build')); return; }
        if (!socket || socket.readyState !== 1) {
            const error = new Error('Moonraker is disconnected. Reconnect before sending commands.');
            if (!silent) notificationStore.addError(error);
            reject(error);
            return;
        }
        const id = ++requestId;
        const timer = setTimeout(() => {
            pending.delete(id);
            const error = new Error(isReadRequest(method) ? `${method} timed out. Moonraker did not respond; check the connection.` : `${method} timed out. It may still be running; check printer state before retrying.`);
            error.code = 'RPC_TIMEOUT';
            error.method = method;
            if (!silent) notificationStore.addError(error);
            reject(error);
        }, timeout);
        pending.set(id, { resolve, reject, timer, silent });
        try {
            socket.send(JSON.stringify({ jsonrpc: '2.0', method, params, id }));
            if (method === 'printer.gcode.script' && params.script) consoleStore.addCommand(params.script);
        } catch (error) { clearTimeout(timer); pending.delete(id); reject(error); }
    });
    // Event handlers can fire and forget; callers that await still receive rejection.
    promise.catch(() => {});
    return promise;
}
export const onNotification = callback => { listeners.add(callback); return () => listeners.delete(callback); };

// A heartbeat detects half-open sockets after sleep; focus probes immediately.
async function resume() {
    if (!desired || globalThis.document?.visibilityState === 'hidden') return;
    const session = generation;
    if (socket?.readyState === 1) {
        try { await send('server.info', {}, { timeout: 5000, silent: true }); }
        catch { if (session === generation) openSocket(); }
    } else openSocket();
}
if (typeof window !== 'undefined') {
    window.addEventListener('online', resume);
    window.addEventListener('focus', resume);
    window.addEventListener('pageshow', resume);
    document.addEventListener('visibilitychange', resume);
}

if (import.meta.hot) import.meta.hot.dispose(() => {
    disconnect();
    window.removeEventListener('online',resume);
    window.removeEventListener('focus',resume);
    window.removeEventListener('pageshow',resume);
    document.removeEventListener('visibilitychange',resume);
});
