<script>
    import { dialog } from '../../dialog.js';
    import { filamentColor } from '../../afc.js';
    import { afcDisabledReason, runAfcAction } from '../../../stores/afcStore.js';
    import { getConnectionGeneration } from '../../../stores/websocket.js';
    export let lane;
    export let commands;
    export let lanes;
    export let close;
    const generation = getConnectionGeneration();
    let color = filamentColor(lane.color);
    let material = lane.material || '';
    let weight = lane.weight ?? '';
    let spoolId = lane.spool_id || 0;
    let tool = '';
    let runout = lane.runout_lane || 'NONE';
    let error = '';
    const canFilament = ['SET_COLOR','SET_MATERIAL','SET_WEIGHT','SET_SPOOL_ID'].some(command => Object.hasOwn(commands,command));
    const has = command => Object.hasOwn(commands,command);
    async function submit(action,data) {
        error = '';
        try { await runAfcAction(action,{lane:lane.name,...data},generation); close(); }
        catch(e) { error = e.message || 'AFC update failed'; }
    }
    function saveFilament() {
        const changes = {};
        if (has('SET_COLOR') && color !== filamentColor(lane.color)) changes.color = color;
        if (has('SET_MATERIAL') && material !== (lane.material || '')) changes.material = material;
        if (has('SET_WEIGHT') && weight !== '' && weight !== lane.weight) changes.weight = weight;
        if (has('SET_SPOOL_ID') && spoolId !== (lane.spool_id || 0)) changes.spool_id = spoolId;
        if (!Object.keys(changes).length) {close();return;}
        submit('filament',{changes});
    }
</script>
<div class="overlay">
    <div class="editor" use:dialog={{label:'AFC lane ' + lane.name,close}}>
        <div class="modal-header"><h2>{lane.name} · FILAMENT</h2><button aria-label="Close AFC lane" on:click={close}>×</button></div>
        {#if canFilament}
        <form on:submit|preventDefault={saveFilament}>
            <fieldset disabled={!!$afcDisabledReason}>
                <div class="fields">
                    {#if has('SET_COLOR')}<label>COLOUR<input type="color" bind:value={color} /></label>{/if}
                    {#if has('SET_MATERIAL')}<label>MATERIAL<input maxlength="120" required bind:value={material} /></label>{/if}
                    {#if has('SET_WEIGHT')}<label>REMAINING WEIGHT (g)<input type="number" min="0" step="any" bind:value={weight} /></label>{/if}
                    {#if has('SET_SPOOL_ID')}<label>SPOOL ID<input type="number" min="0" step="1" required bind:value={spoolId} /><small>0 clears the spool assignment.</small></label>{/if}
                </div>
                <button type="submit">SAVE FILAMENT</button>
            </fieldset>
        </form>
        {/if}
        {#if has('SET_MAP')}
        <form on:submit|preventDefault={() => submit('map',{tool})}>
            <fieldset disabled={!!$afcDisabledReason}>
                <label>ASSIGN TOOL <small>Current: {lane.tools.join(', ') || 'Unmapped'}</small><input placeholder="T0" pattern="T[0-9]{1,3}" required bind:value={tool} /></label>
                <button type="submit">SET MAPPING</button>
            </fieldset>
        </form>
        {/if}
        {#if has('SET_RUNOUT')}
        <form on:submit|preventDefault={() => submit('runout',{runout})}>
            <fieldset disabled={!!$afcDisabledReason}>
                <label>RUNOUT BACKUP<select bind:value={runout}><option value="NONE">None</option>{#each lanes.filter(l => l.name !== lane.name && l.prep && l.load) as other}<option value={other.name}>{other.name}</option>{/each}</select></label>
                <button type="submit">SET BACKUP</button>
            </fieldset>
        </form>
        {/if}
        {#if $afcDisabledReason}<p class="hint" role="status">{$afcDisabledReason}</p>{/if}
        {#if error}<p class="error" role="alert">{error} Check current state before retrying.</p>{/if}
        <button on:click={close}>CANCEL</button>
    </div>
</div>
<style>
.overlay {position:fixed;inset:0;z-index:2500;background:#000c;display:grid;place-items:center;padding:16px;}
.editor {width:min(560px,100%);max-height:90vh;overflow:auto;box-sizing:border-box;padding:18px;border:1px solid var(--retro-green);background:var(--bg-module);color:var(--retro-green);}
.modal-header {display:flex;align-items:center;justify-content:space-between;gap:12px;} h2 {font:inherit;font-size:17px;margin:0;}
form {border-bottom:1px solid var(--border-color);padding:16px 0;margin-bottom:12px;} fieldset {border:0;margin:0;padding:0;min-width:0;} .fields {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;}
label {display:flex;flex-direction:column;gap:7px;font-size:12px;margin-bottom:14px;} input,select {font:inherit;box-sizing:border-box;min-width:0;width:100%;padding:8px;background:#080d0a;color:var(--retro-green);border:1px solid var(--border-color);} input[type=color] {height:38px;padding:3px;}
button {font:inherit;cursor:pointer;padding:8px 12px;border:1px solid var(--border-color);background:#080d0a;color:var(--retro-green);} button:disabled,fieldset:disabled {opacity:.5;} small,.hint {font-size:12px;color:#99a99d;} .error {color:var(--retro-orange);white-space:pre-wrap;}
@media(max-width:480px) {.fields {grid-template-columns:1fr;}}
</style>
