import { writable } from 'svelte/store';

export const filePickerOpen = writable(false);
export const filePickerPath = writable("");
export const settingsOpen = writable(false);
export const settingsTab = writable("General");
export const historyOpen = writable(false);
export const hostsOpen = writable(false);
