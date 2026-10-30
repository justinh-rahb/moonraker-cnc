<script>
    import { createEventDispatcher } from 'svelte';
    export let value = 100;
    export let min = 1;
    export let max = 200;
    export let step = 1;
    export let label = 'VALUE';
    export let unit = '%';
    export let caption = null;
    export let baseline = 100;
    const dispatch = createEventDispatcher();
    let localValue = value;
    let editing = false;
    $: if (!editing) localValue = value;
    function commit(raw) {
        const next = Number(raw);
        if (raw === '' || !Number.isFinite(next) || next < min || next > max) { localValue = value; editing = false; return; }
        localValue = next;
        editing = false;
        dispatch('change', { value: next });
    }
</script>
<div class="slider-control">
    <div class="slider-label"><span>{caption ?? label}</span><div class="numeric-control">
        <input aria-label={label} type="number" {min} {max} {step} bind:value={localValue} on:focus={() => editing = true} on:change={e => commit(e.currentTarget.value)} on:blur={() => {editing = false; localValue = value;}} on:keydown={e => {if (e.key === 'Enter') {commit(e.currentTarget.value); e.currentTarget.blur();} if(e.key === 'Escape') {editing = false; localValue = value; e.currentTarget.blur();}}} /><span>{unit}</span>
        <button title={`Reset ${label} to ${baseline}${unit}`} aria-label={`Reset ${label}`} on:click={() => commit(baseline)}>↺</button>
    </div></div>
    <input aria-label={label + ' slider'} type="range" class="slider" {min} {max} {step} bind:value={localValue} on:input={() => editing = true} on:change={e => commit(e.currentTarget.value)} />
</div>
<style>
.slider-control { display:grid; gap:10px; margin-bottom:16px; width:100%; }.slider-label { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:0; min-height:32px; color:var(--retro-green); font-size:13px; }
.numeric-control { display:grid; grid-template-columns:76px 32px 32px; align-items:center; justify-items:center; gap:6px; flex-shrink:0; } input[type=number] { width:76px; background:#080c09; color:var(--retro-green); border:1px solid #405447; font:inherit; font-variant-numeric:tabular-nums; padding:6px; height:32px; min-width:0; }
button { background:#0a100c; border:1px solid #405447; color:var(--retro-green); padding:0; width:32px; height:32px; display:grid; place-items:center; font-size:18px; cursor:pointer; }
.slider { width:100%; height:8px; background:#0a0a0a; border:1px solid #405447; appearance:none; margin:7px 0; }
.slider::-webkit-slider-thumb { appearance:none; width:22px; height:22px; background:var(--retro-green); border:2px solid var(--retro-green-dim); cursor:pointer; }
.slider::-moz-range-thumb { width:22px; height:22px; background:var(--retro-green); border:2px solid var(--retro-green-dim); cursor:pointer; }
</style>
