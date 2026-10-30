// The readout uses machine coordinates. G1 uses the current G-code origin;
// convert from one fresh status query so G92 / SET_GCODE_OFFSET stay intact.
export function absoluteMoveScript(status, axis, target, configured = {}) {
    if (typeof axis !== 'string' || !/^[xyz]$/i.test(axis) || typeof target !== 'number' || !Number.isFinite(target)) throw new Error('Enter a valid X, Y or Z position');
    axis = axis.toLowerCase();
    const index = 'xyz'.indexOf(axis);
    if (status.webhooks?.state !== 'ready' || !['standby','complete','cancelled'].includes(status.print_stats?.state)
        || status.virtual_sdcard?.is_active !== false || status.pause_resume?.is_paused !== false) throw new Error('Manual moves require an idle, ready printer');
    const toolhead = status.toolhead;
    if (!toolhead?.homed_axes?.includes(axis)) throw new Error(`Home ${axis.toUpperCase()} before moving`);
    const min = toolhead.axis_minimum?.[index], max = toolhead.axis_maximum?.[index];
    if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) throw new Error('Axis travel limits are unavailable');
    if (target < min || target > max) throw new Error(`${axis.toUpperCase()} must be between ${min} and ${max} mm`);
    const machine = status.gcode_move?.position?.[index], gcode = status.gcode_move?.gcode_position?.[index];
    const factor = status.gcode_move?.speed_factor;
    if (![machine,gcode,factor].every(Number.isFinite) || factor <= 0) throw new Error('Current coordinate or speed state is unavailable');
    const coordinate = target - machine + gcode;
    const limit = axis === 'z' ? configured.printer?.max_z_velocity ?? 10 : toolhead.max_velocity;
    if (!Number.isFinite(limit) || limit <= 0) throw new Error('Motion speed limit is unavailable');
    const feedrate = Math.min(limit, axis === 'z' ? 10 : 50) * 60 / factor;
    return `SAVE_GCODE_STATE NAME=retro_absolute_move\nG90\nG1 ${axis.toUpperCase()}${coordinate.toFixed(6)} F${feedrate.toFixed(3)}\nRESTORE_GCODE_STATE NAME=retro_absolute_move`;
}
export function motorEnableState(steppers) {
    const values = Object.values(steppers || {});
    if (!values.length || values.some(value => typeof value !== 'boolean')) return 'unknown';
    if (values.every(Boolean)) return 'on';
    if (values.every(value => !value)) return 'off';
    return 'mixed';
}
