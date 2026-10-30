import { writable } from 'svelte/store';
import { send, getConnectionGeneration, connectionState } from './websocket.js';
import { notificationStore } from './notificationStore.js';

// Store for available cameras from Moonraker
export const availableCameras = writable([]);
export const isFetchingCameras = writable(false);

/**
 * Fetch cameras from Moonraker API
 * Calls server.webcams.list endpoint
 */
export async function fetchMoonrakerCameras() {
    const generation = getConnectionGeneration();
    isFetchingCameras.set(true);
    
    try {
        const response = await send('server.webcams.list', {});
        
        if (generation !== getConnectionGeneration()) return [];
        if (response?.webcams) {
            const cameras = response.webcams.map(cam => ({
                uid: cam.uid || cam.name,
                name: cam.name || 'Unknown Camera',
                stream_url: cam.stream_url || cam.urlStream || '',
                snapshot_url: cam.snapshot_url || cam.urlSnapshot || '',
                flip_horizontal: cam.flip_horizontal || false,
                flip_vertical: cam.flip_vertical || false,
                rotation: cam.rotation || 0,
                service: cam.service || 'unknown'
            }));
            
            availableCameras.set(cameras);
            
            console.log(`Found ${cameras.length} camera${cameras.length !== 1 ? 's' : ''} from Moonraker`);
            
            return cameras;
        } else {
            availableCameras.set([]);
            console.warn('No cameras found in Moonraker response');
            return [];
        }
    } catch (error) {
        if (generation !== getConnectionGeneration()) return [];
        console.error('Failed to fetch cameras from Moonraker:', error);
        notificationStore.addError(
            error?.message || 'Failed to fetch cameras from Moonraker'
        );
        availableCameras.set([]);
        return [];
    } finally {
        if (generation === getConnectionGeneration()) isFetchingCameras.set(false);
    }
}

/**
 * Clear the available cameras list
 */
export function clearAvailableCameras() {
    availableCameras.set([]);
}

connectionState.subscribe(state => { if (state !== 'connected') { availableCameras.set([]); isFetchingCameras.set(false); } });
