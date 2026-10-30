// Klipper host/MCU monitors can be named anything; classify by sensor type,
// not by whether the reading has an adjustable target.
export function isSystemTemperature(key, configured = {}) {
    const type = String(configured[key]?.sensor_type || '').toLowerCase();
    return /^(temperature_host|temperature_mcu)(\s|$)/i.test(key)
        || ['temperature_host', 'temperature_mcu'].includes(type);
}
