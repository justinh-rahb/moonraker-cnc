// Reads should fail promptly; a G-code script can legitimately wait for heaters
// or motion to finish before Moonraker acknowledges it.
export const READ_TIMEOUT = 15000;
export const GCODE_TIMEOUT = 10 * 60 * 1000;
export const RESTART_TIMEOUT = 60000;
export const requestTimeout = method => method === 'printer.gcode.script' ? GCODE_TIMEOUT : ['printer.restart','printer.firmware_restart'].includes(method) ? RESTART_TIMEOUT : READ_TIMEOUT;
export const restartMethod = script => ({RESTART:'printer.restart',FIRMWARE_RESTART:'printer.firmware_restart'})[typeof script === 'string' ? script.trim().toUpperCase() : ''] || null;
export const isReadRequest = method => /^(server\.(info|files\.(get_directory|metadata|list)|history\.(list|totals)|database\.(list|get_item)|webcams\.list)|printer\.(info|objects\.(list|query|subscribe))|machine\.(system_info|device_power\.(devices|status)))$/.test(method);
