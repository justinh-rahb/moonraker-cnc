// AFC's public Klipper status/command contract, shared by real AFC and AFC-Lite.
export const afcObjectNames = names => names.includes('AFC') ? names.filter(name => /^AFC(?:$|_)/.test(name)) : [];
export function mergeAfcStatus(previous, status) {
    const next = {...previous};
    for (const key of Object.keys(previous)) {
        if (status[key] && typeof status[key] === 'object') next[key] = {...previous[key], ...status[key]};
    }
    return next;
}
const strings = value => Array.isArray(value) ? value.filter(v => typeof v === 'string') : [];
export const filamentColor = value => typeof value === 'string' && /^#?[\da-f]{6}$/i.test(value) ? '#' + value.replace(/^#/,'') : '#7c8780';
export function afcModel(objects = {}) {
    const afc = objects.AFC;
    if (!afc || !Object.keys(afc).length) return null;
    const current = afc.current_load ?? afc.current_lane;
    const names = [...new Set([...strings(afc.lanes), ...Object.keys(objects).filter(k => /^AFC_(lane|stepper) /.test(k)).map(k => k.slice(k.indexOf(' ') + 1))])];
    const lanes = names.map(name => {
        const raw = objects['AFC_stepper ' + name] || objects['AFC_lane ' + name];
        if (!raw) return null;
        const reportedState = typeof raw.status === 'string' && !['none','empty','loaded','tooled','tool loaded'].includes(raw.status.toLowerCase()) ? raw.status : null;
        return {...raw, name, color:filamentColor(raw.color), tools:strings(Array.isArray(raw.map) ? raw.map : [raw.map]), active:current === name,
            // Some compatibility stubs report "empty" despite true sensors.
            filamentState:reportedState || (raw.tool_loaded === true ? 'In tool' : raw.load === true && raw.prep === true ? 'Ready' : raw.prep === true ? 'Prep' : raw.prep === false ? 'Empty' : 'Unknown')};
    }).filter(Boolean);
    const assigned = new Set();
    const units = strings(afc.units).map(unit => {
        const key = Object.keys(objects).find(k => k.toLowerCase() === ('AFC_' + unit).toLowerCase());
        const name = unit.includes(' ') ? unit.slice(unit.indexOf(' ') + 1) : unit;
        const members = lanes.filter(l => strings(objects[key]?.lanes).includes(l.name) || l.unit === name);
        members.forEach(l => assigned.add(l.name));
        return {name, type:unit.split(' ')[0], lanes:members};
    });
    const remaining = lanes.filter(l => !assigned.has(l.name));
    if (remaining.length) units.push({name:'Lanes', type:'', lanes:remaining});
    const devices = kind => Object.entries(objects).filter(([k]) => k.startsWith('AFC_' + kind + ' ')).map(([k,v]) => ({...v,name:k.slice(k.indexOf(' ') + 1)}));
    return {afc, lanes, units, extruders:devices('extruder'), hubs:devices('hub'), buffers:devices('buffer'), current,
        state:typeof afc.current_state === 'string' ? afc.current_state : 'Unknown',
        message:typeof afc.message === 'string' ? afc.message : afc.message?.message || ''};
}
export const afcPanelVisible = (objects, config) => config.afc?.enabled !== false && !!afcModel(objects);
export function afcControlBlock(status, {allowError = false} = {}) {
    if (status.webhooks?.state !== 'ready') return 'Printer is not ready';
    if (!status.print_stats || !['standby','complete','cancelled','error'].includes(status.print_stats.state) || status.virtual_sdcard?.is_active !== false || status.pause_resume?.is_paused !== false) return 'Finish the current print before changing AFC';
    if (!status.idle_timeout || !['Idle','Ready'].includes(status.idle_timeout.state)) return 'Printer is busy';
    if (!status.AFC) return 'AFC is no longer available';
    if (!allowError && (status.AFC.error_state === true || String(status.AFC.current_state).toLowerCase() === 'error')) return 'Resolve the AFC error first';
    if (!['idle','initialized','error'].includes(String(status.AFC.current_state).toLowerCase())) return 'AFC is busy';
    return '';
}
// Reject G-code delimiters rather than letting names or form input add commands.
function param(value) {
    if (typeof value !== 'string' || !value.length || value.length > 120 || /[\x00-\x1f\x7f"'\\#;=]/.test(value)) throw new Error('Unsupported characters in AFC parameter');
    return /\s/.test(value) ? `"${value}"` : value;
}
const commandsFor = {load:'CHANGE_TOOL',unload:'TOOL_UNLOAD',eject:'LANE_UNLOAD',map:'SET_MAP',runout:'SET_RUNOUT',clear:'AFC_CLEAR_MESSAGE',ledOn:'TURN_ON_AFC_LED',ledOff:'TURN_OFF_AFC_LED',select:'AFC_SELECT_TOOL',unselect:'AFC_UNSELECT_TOOL'};
export const afcCommandAvailable = (commands, action) => !!commands && Object.hasOwn(commands,commandsFor[action]);
export function afcScript(status, action, data = {}) {
    const commands = status.gcode?.commands || {};
    const model = afcModel(status);
    if (!model) throw new Error('AFC is unavailable');
    const requireCommand = command => { if (!Object.hasOwn(commands,command)) throw new Error(`${command} is not available on this printer`); return command; };
    const lane = model.lanes.find(l => l.name === data.lane);
    if (['load','unload','eject','map','runout','filament'].includes(action) && !lane) throw new Error('This AFC lane is no longer available');
    const laneParam = lane ? ` LANE=${param(lane.name)}` : '';
    if (action === 'filament') {
        const edits = data.changes;
        if (!edits || !Object.keys(edits).length) throw new Error('No filament changes to save');
        const fields = {color:['SET_COLOR','COLOR'],material:['SET_MATERIAL','MATERIAL'],spool_id:['SET_SPOOL_ID','SPOOL_ID'],weight:['SET_WEIGHT','WEIGHT']};
        return Object.entries(edits).map(([field,value]) => {
            if (!fields[field]) throw new Error('Unsupported filament field');
            const [command,key] = fields[field];requireCommand(command);
            if (field === 'color') { if (typeof value !== 'string' || !/^#?[\da-f]{6}$/i.test(value)) throw new Error('Enter a six-digit filament colour'); value = value.replace(/^#/,''); }
            else if (field === 'spool_id' || field === 'weight') {
                if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (field === 'spool_id' && !Number.isSafeInteger(value))) throw new Error('Enter a valid non-negative ' + (field === 'weight' ? 'weight' : 'spool ID'));
                value = field === 'spool_id' && value === 0 ? '' : String(value);
            } else value = param(value);
            return `${command}${laneParam} ${key}=${value}`;
        }).join('\n');
    }
    const command = requireCommand(commandsFor[action] || '');
    if (action === 'load') {
        if (!lane.prep || !lane.load) throw new Error('Prepare filament in this lane before loading');
        if (lane.active && lane.tool_loaded) throw new Error('This lane is already active');
    }
    if (action === 'unload' && !lane.tool_loaded) throw new Error('This lane has no filament in the tool');
    if (action === 'eject' && lane.tool_loaded) throw new Error('Unload the tool before ejecting this lane');
    if (action === 'map') {
        if (!/^T\d{1,3}$/.test(data.tool)) throw new Error('Enter a tool such as T0');
        return `${command}${laneParam} MAP=${data.tool}`;
    }
    if (action === 'runout') {
        if (data.runout !== 'NONE' && !model.lanes.some(l => l.name === data.runout && l.name !== lane.name && l.prep && l.load)) throw new Error('Select another prepared lane');
        return `${command}${laneParam} RUNOUT=${param(data.runout)}`;
    }
    if (action === 'select') {
        if (!model.extruders.some(e => e.name === data.tool && e.on_shuttle !== true)) throw new Error('This AFC extruder is unavailable');
        return `${command} TOOL=${param(data.tool)}`;
    }
    if (action === 'unselect' && !model.extruders.some(e => e.on_shuttle === true)) throw new Error('No AFC tool is currently mounted');
    return command + laneParam;
}
