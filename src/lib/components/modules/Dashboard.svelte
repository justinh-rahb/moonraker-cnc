<script>
    import { settingsSyncState, resolveSettingsConflict, syncSettings } from '../../../stores/settingsSync.js';
    import { onMount } from 'svelte';
    import { configStore } from '../../../stores/configStore.js';
    import { connectionState } from '../../../stores/websocket.js';
    import { machineState } from '../../../stores/machineStore.js';
    import PrintStatusPanel from './PrintStatusPanel.svelte';
    import ToolheadControl from './ToolheadControl.svelte';
    import ExtruderControl from './ExtruderControl.svelte';
    import ConsolePanel from './ConsolePanel.svelte';
    import CameraPanel from './CameraPanel.svelte';
    import TemperaturePanel from './TemperaturePanel.svelte';
    import MachineLimitsPanel from './MachineLimitsPanel.svelte';
    import MiscPanel from './MiscPanel.svelte';
    import MacroPanel from './MacroPanel.svelte';
    const modules = { status: PrintStatusPanel, toolhead: ToolheadControl, extruder: ExtruderControl, console: ConsolePanel, camera: CameraPanel, temperature: TemperaturePanel, limits: MachineLimitsPanel, misc: MiscPanel };
    const names = { status:'Print status', toolhead:'Toolhead', extruder:'Extruder', console:'Console', camera:'Camera', temperature:'Temperatures', limits:'Motion limits', misc:'Fans & lights' };
    const defaults = ['status', 'camera', 'toolhead', 'temperature', 'extruder', 'limits', 'console', 'misc'];
    let editing = false;
    let compact = false;
    let dragging = '';
    let announcement = '';
    onMount(() => {
        const media = matchMedia('(max-width: 900px)');
        const update = () => compact = media.matches;
        update(); media.addEventListener('change', update);
        return () => media.removeEventListener('change', update);
    });
    $: size = compact ? 'compact' : 'wide';
    $: available = [...defaults.filter(id => id !== 'camera' || $configStore.cameras?.some(c => c.enabled)), ...[...$configStore.panels].sort((a,b) => a.order-b.order).map(p => 'macro:' + p.id)];
    $: saved = $configStore.dashboard?.[size] || defaults;
    $: order = [...saved.filter((id,i) => available.includes(id) && saved.indexOf(id) === i), ...available.filter(id => !saved.includes(id))];
    function move(id, target) {
        if (!editing || id === target) return;
        const next = order.filter(key => key !== id);
        next.splice(order.indexOf(target), 0, id);
        configStore.update(c => ({ ...c, dashboard: { ...c.dashboard, [size]: next } }));
        announcement = `${names[id] || 'Macro panel'} moved`;
    }
    function moveBy(id, direction) {
        const target = order[order.indexOf(id) + direction];
        if (target) move(id, target);
    }
</script>
<div class="dashboard-toolbar">
    <span>{$connectionState === 'connected' ? ($machineState.isReady ? 'LIVE TELEMETRY' : 'SYNCHRONIZING') : $connectionState.toUpperCase()} · {$configStore.server.ip}</span>
    <button aria-pressed={editing} on:click={() => editing = !editing}>{editing ? 'LOCK LAYOUT' : 'ARRANGE PANELS'}</button>
    {#if editing}<button on:click={() => configStore.update(c => ({...c, dashboard:{...c.dashboard,[size]:defaults}}))}>RESET LAYOUT</button>{/if}
</div>
<div class="settings-sync" role="status">{$settingsSyncState.message}
{#if $settingsSyncState.status === 'conflict'}<button on:click={() => resolveSettingsConflict('local')}>Keep this browser's copy</button><button on:click={() => resolveSettingsConflict('remote')}>Use Moonraker copy</button>{:else if $settingsSyncState.status === 'local'}<button on:click={() => syncSettings()}>Retry sync</button>{/if}</div>
<div class="sr-only" aria-live="polite">{announcement}</div>
<div class="dashboard-grid" class:editing>
{#each order as id (id)}
    <section class="dashboard-cell" aria-label={names[id] || 'Macro panel'} on:dragover|preventDefault on:drop|preventDefault={() => { move(dragging,id); dragging = ''; }}>
        {#if editing}
        <div class="arrange-controls">
            <button draggable="true" aria-label={'Drag ' + (names[id] || 'macro panel')} on:dragstart={e => { dragging = id; e.dataTransfer.setData('text/plain',id); }} on:dragend={() => dragging = ''}>⠿ {names[id] || 'Macro panel'}</button>
            <button aria-label={'Move ' + id + ' earlier'} disabled={order.indexOf(id) === 0} on:click={() => moveBy(id,-1)}>↑</button>
            <button aria-label={'Move ' + id + ' later'} disabled={order.indexOf(id) === order.length-1} on:click={() => moveBy(id,1)}>↓</button>
        </div>
        {/if}
        <div inert={!$machineState.isReady && !['status','console','camera'].includes(id)}>
        {#if modules[id]}<svelte:component this={modules[id]} />
        {:else}{@const panel = $configStore.panels.find(p => 'macro:' + p.id === id)}{#if panel}<MacroPanel {panel} />{/if}{/if}
        </div>
    </section>
{/each}
</div>
<style>
.settings-sync { color:#a1aca4; font-size:12px; margin-bottom:14px; display:flex; gap:8px; flex-wrap:wrap; }
.dashboard-toolbar { display:flex; gap:12px; flex-wrap:wrap; justify-content:flex-end; align-items:center; margin:0 0 16px; font-size:12px; }
.dashboard-toolbar span { margin-right:auto; color:#98a89c; }
button { font:inherit; color:var(--retro-green); background:#0b100d; border:1px solid #3d5243; padding:8px; cursor:pointer; }
.dashboard-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:20px; align-items:start; }
.dashboard-cell { min-width:0; } .editing .dashboard-cell { outline:1px dashed var(--retro-green-dim); }
.arrange-controls { display:flex; gap:6px; padding:6px; background:#080d0a; }.arrange-controls button:first-child { flex:1; text-align:left; cursor:grab; }
@media(max-width:900px) { .dashboard-grid { grid-template-columns:minmax(0,1fr); gap:14px; } }
</style>
