<script>
    import PanelModule from '../ui/PanelModule.svelte';
    import ConfirmDialog from '../ui/ConfirmDialog.svelte';
    import AfcLaneDialog from '../ui/AfcLaneDialog.svelte';
    import { machineState } from '../../../stores/machineStore.js';
    import { connectionState, getConnectionGeneration } from '../../../stores/websocket.js';
    import { afcDisabledReason, afcClearDisabledReason, runAfcAction } from '../../../stores/afcStore.js';
    import { afcModel, afcCommandAvailable } from '../../afc.js';
    let editingLane = null;
    let confirmation = null;
    let error = '';
    $: model = afcModel($machineState.afcObjects);
    $: commands = $machineState.availableCommands;
    $: blocked = !!$afcDisabledReason;
    $: if ($connectionState !== 'connected') {editingLane = null; confirmation = null;}
    $: if (editingLane && !model?.lanes.some(l => l.name === editingLane.name)) editingLane = null;
    $: canEdit = ['SET_COLOR','SET_MATERIAL','SET_WEIGHT','SET_SPOOL_ID','SET_MAP','SET_RUNOUT'].some(k => Object.hasOwn(commands,k));
    const has = action => afcCommandAvailable(commands,action);
    const sensor = value => value === true ? 'detected' : value === false ? 'empty' : 'unknown';
    function request(action,data,label) {
        confirmation = {action,data,label,generation:getConnectionGeneration()};
    }
    async function confirm() {
        const operation = confirmation;confirmation = null;error = '';
        if (!operation) return;
        try {await runAfcAction(operation.action,operation.data,operation.generation);}
        catch(e) {error = e.message || 'AFC operation failed';}
    }
</script>
{#if model}
<PanelModule title="AFC" panelKey="afc">
    <div class="afc-status" class:has-error={model.afc.error_state} aria-live="polite">
        <span class="state"><span class="indicator" class:on={!model.afc.error_state} aria-hidden="true"></span>{model.afc.error_state ? 'ERROR' : model.state.toUpperCase()}</span>
        {#if model.current}<span>ACTIVE <strong>{model.current}</strong></span>{/if}
        {#if model.afc.next_lane}<span>NEXT <strong>{model.afc.next_lane}</strong></span>{/if}
        {#if model.afc.number_of_toolchanges > 0}<span>CHANGES <strong>{model.afc.current_toolchange ?? 0}/{model.afc.number_of_toolchanges}</strong></span>{/if}
        {#if typeof model.afc.led_state === 'boolean' && has(model.afc.led_state ? 'ledOff' : 'ledOn')}
            <button class="small" disabled={blocked} on:click={() => request(model.afc.led_state ? 'ledOff' : 'ledOn',{},model.afc.led_state ? 'Turn AFC lights off?' : 'Turn AFC lights on?')}>LIGHTS {model.afc.led_state ? 'ON' : 'OFF'}</button>
        {/if}
    </div>
    {#if model.afc.bypass_state}<p class="notice">BYPASS ACTIVE</p>{/if}
    {#if model.message}<div class="notice" role={model.afc.error_state ? 'alert' : 'status'}>{model.message}
        {#if has('clear')}<button class="small" disabled={!!$afcClearDisabledReason} on:click={() => request('clear',{},'Clear the AFC message?')}>CLEAR</button>{/if}
    </div>{/if}
    {#if error}<p class="notice" role="alert">{error}</p>{/if}
    {#each model.extruders as extruder (extruder.name)}
        <div class="device-row" class:selected={extruder.on_shuttle}>
            <strong>{extruder.name}</strong>
            <span title={'Tool entry sensor: ' + sensor(extruder.tool_start_status)}><i class="indicator" class:on={extruder.tool_start_status === true} aria-hidden="true"></i>ENTRY</span>
            {#if extruder.tool_end}<span title={'Tool exit sensor: ' + sensor(extruder.tool_end_status)}><i class="indicator" class:on={extruder.tool_end_status === true} aria-hidden="true"></i>EXIT</span>{/if}
            <span>{extruder.lane_loaded || 'Empty'}{extruder.status ? ' · ' + extruder.status : ''}</span>
            {#if has('select') && !extruder.on_shuttle}<button class="small" disabled={blocked} on:click={() => request('select',{tool:extruder.name},'Select tool ' + extruder.name + '?')}>SELECT</button>{/if}
            {#if has('unselect') && extruder.on_shuttle}<button class="small" disabled={blocked} on:click={() => request('unselect',{},'Dock the active tool?')}>DOCK</button>{/if}
        </div>
    {/each}
    {#each model.units as unit (unit.name)}
        <div class="unit-heading"><h3>{unit.name}</h3>{#if unit.type && unit.type !== 'unit'}<span>{unit.type}</span>{/if}</div>
        <div class="lanes">
        {#each unit.lanes as lane (lane.name)}
            <article class="lane" class:active={lane.active} aria-label={'AFC lane ' + lane.name}>
                <div class="lane-heading"><strong>{lane.name}</strong><span>{lane.tools.join(', ') || '—'}</span>
                    {#if canEdit}<button class="edit" title={'Edit ' + lane.name + ' filament and mapping'} aria-label={'Edit AFC lane ' + lane.name} disabled={blocked} on:click={() => editingLane = lane}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16 12-12 4 4L8 20H4zM13 7l4 4" /></svg></button>{/if}
                </div>
                <div class="filament">
                    <svg class="spool" style={'--filament-color:' + lane.color} viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="26"/><circle cx="32" cy="32" r="20"/><circle class="hub" cx="32" cy="32" r="7"/><path d="M32 12v13m0 14v13M12 32h13m14 0h13"/></svg>
                    <strong>{lane.material && lane.material !== 'NONE' ? lane.material : '—'}</strong>
                </div>
                <div class="filament-name" title={lane.filament_name || ''}>{lane.filament_name || ''}</div>
                <div class="lane-state">{#if lane.active}<span class="active-mark" aria-label="Active lane">◆</span>{/if}{lane.filamentState}</div>
                <div class="sensors" aria-label={lane.name + ' filament sensors'}>
                    {#each [['PREP',lane.prep],['LOAD',lane.load],['TOOL',lane.tool_loaded],['HUB',lane.loaded_to_hub]] as [name,value]}
                        {#if value !== undefined}<span title={name + ': ' + sensor(value)} aria-label={name + ': ' + sensor(value)}><i class="indicator" class:on={value === true} aria-hidden="true"></i>{name}</span>{/if}
                    {/each}
                </div>
                {#if Number.isFinite(lane.weight)}<div class="detail">{Math.round(lane.weight)} g{#if lane.spool_id} · #{lane.spool_id}{/if}</div>{:else if lane.spool_id}<div class="detail">SPOOL #{lane.spool_id}</div>{/if}
                {#if lane.runout_lane && lane.runout_lane !== 'NONE'}<div class="detail" title="Runout backup">∞ {lane.runout_lane}</div>{/if}
                {#if lane.buffer_status}<div class="detail">BUFFER · {lane.buffer_status}</div>{/if}
                <div class="lane-actions">
                    {#if has('load') && !(lane.active && lane.tool_loaded)}<button disabled={blocked || !lane.prep || !lane.load} title={'Load/select lane ' + lane.name} on:click={() => request('load',{lane:lane.name},'Load/select lane ' + lane.name + '? This may heat the tool and move the printer.')}>{lane.tool_loaded ? 'SELECT' : 'LOAD'}</button>{/if}
                    {#if has('unload') && lane.tool_loaded}<button disabled={blocked} on:click={() => request('unload',{lane:lane.name},'Unload filament from tool for ' + lane.name + '? This may heat the tool and move the printer.')}>UNLOAD</button>{/if}
                    {#if has('eject') && !lane.tool_loaded}<button disabled={blocked || !(lane.prep || lane.load)} on:click={() => request('eject',{lane:lane.name},'Eject filament from lane ' + lane.name + '?')}>EJECT</button>{/if}
                </div>
            </article>
        {/each}
        </div>
    {/each}
    {#if !model.lanes.length}<p class="detail">Waiting for AFC lane data…</p>{/if}
    {#if model.hubs.length || model.buffers.length}<div class="devices">
        {#each model.hubs as hub (hub.name)}<span title={'Hub sensor: ' + sensor(hub.state)}><i class="indicator" class:on={hub.state === true} aria-hidden="true"></i>{hub.name} · {sensor(hub.state)}</span>{/each}
        {#each model.buffers as buffer (buffer.name)}<span>{buffer.name} · {buffer.state || 'Unknown'}{buffer.enabled === false ? ' (disabled)' : ''}</span>{/each}
    </div>{/if}
    {#if $afcDisabledReason}<p class="disabled-reason" role="status">{$afcDisabledReason}</p>{/if}
</PanelModule>
{/if}
<ConfirmDialog isOpen={!!confirmation} title="AFC" message={confirmation?.label || ''} onConfirm={confirm} onCancel={() => confirmation = null} />
{#if editingLane && model}<AfcLaneDialog lane={editingLane} {commands} lanes={model.lanes} close={() => editingLane = null} />{/if}
<style>
.afc-status,.device-row,.devices {display:flex;gap:12px;align-items:center;flex-wrap:wrap;font-size:12px;color:#9dab9f;} .afc-status {padding-bottom:12px;border-bottom:1px solid var(--border-color);} strong,.state {color:var(--retro-green);}.state {display:flex;align-items:center;gap:7px;}.has-error .state,.notice {color:var(--retro-orange);}
.indicator {display:inline-block;width:7px;height:7px;box-sizing:border-box;border:1px solid #65736a;border-radius:50%;margin-right:4px;flex-shrink:0;}.indicator.on {background:var(--retro-green);border-color:var(--retro-green);}.has-error .indicator {background:var(--retro-orange);border-color:var(--retro-orange);}
.unit-heading {display:flex;align-items:baseline;gap:10px;margin:14px 0 10px;} h3 {font:inherit;font-size:14px;margin:0;color:var(--retro-green);}.unit-heading span {font-size:11px;color:#9dab9f;}
.lanes {display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;} .lane {border:1px solid var(--border-color);background:#080d0a;padding:10px;min-width:0;display:flex;flex-direction:column;} .lane.active {border-color:var(--retro-green);box-shadow:inset 0 2px var(--retro-green);}
.lane-heading {display:flex;align-items:center;gap:7px;flex-wrap:wrap;font-size:12px;}.lane-heading>span {color:#9dab9f;overflow-wrap:anywhere;} .edit {margin-left:auto;padding:3px;display:grid;place-items:center;}.edit svg {width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.5;}
.filament {display:flex;align-items:center;gap:9px;margin:10px 0;}.spool {width:42px;height:42px;flex-shrink:0;fill:var(--filament-color);stroke:#9dab9f;stroke-width:1;}.spool .hub {fill:#080d0a;}.spool path {stroke:#080d0a;stroke-width:3;}.filament-name {font-size:11px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;color:#9dab9f;min-height:14px;}
.lane-state {font-size:12px;margin:9px 0;color:var(--retro-green);}.active-mark {margin-right:5px;}.sensors {display:flex;gap:7px;flex-wrap:wrap;font-size:9px;color:#9dab9f;}.sensors span {display:flex;align-items:center;}.detail {font-size:11px;color:#9dab9f;margin-top:8px;}.lane-actions {display:flex;flex-wrap:wrap;gap:5px;margin-top:auto;padding-top:12px;}.lane-actions button {flex:1;font-size:10px;padding:7px 4px;}
button {font:inherit;cursor:pointer;background:#0b130e;color:var(--retro-green);border:1px solid var(--border-color);padding:7px 10px;} button:disabled {opacity:.4;cursor:default;} .small {font-size:11px;padding:4px 8px;} .notice {font-size:12px;white-space:pre-wrap;display:flex;align-items:center;justify-content:space-between;gap:8px;}.device-row {padding:10px 0;border-bottom:1px solid var(--border-color);}.device-row.selected {border-left:2px solid var(--retro-green);padding-left:8px;}.devices {margin-top:12px;}.disabled-reason {margin:12px 0 0;color:var(--retro-orange);font-size:11px;}
</style>
