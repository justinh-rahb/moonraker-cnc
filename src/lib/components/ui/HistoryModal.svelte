<script>
    import { dialog } from "../../dialog.js";
    import { onDestroy } from 'svelte';
    import { historyOpen, filePickerOpen, filePickerPath } from '../../../stores/uiStore.js';
    import { send, connectionState, getConnectionGeneration } from '../../../stores/websocket.js';
    let jobs = [], count = 0, start = 0, loading = false, error = '', request = 0;
    async function load() {
        const ticket = ++request, generation = getConnectionGeneration();
        loading = true; error = '';
        try {
            const result = await send('server.history.list', { start, limit: 25, order:'desc' });
            if (ticket !== request || generation !== getConnectionGeneration()) return;
            jobs = result.jobs || []; count = result.count || 0;
        } catch(e) { if (ticket === request) error = e.code === -32601 ? 'Print history is not enabled on this Moonraker host.' : e.message; }
        finally { if (ticket === request) loading = false; }
    }
    $: if ($historyOpen && $connectionState === 'connected') { start = 0; load(); }
    $: if ($connectionState !== 'connected') { request++; jobs = []; loading = false; }
    const duration = seconds => `${Math.floor((seconds || 0)/3600)}h ${Math.floor(((seconds || 0)%3600)/60)}m`;
    function showFile(filename) { const parts = filename.split('/'); parts.pop(); $historyOpen = false; $filePickerPath = parts.join('/'); $filePickerOpen = true; }
    onDestroy(() => request++);
</script>
{#if $historyOpen}
<div class="history-overlay" role="presentation">
<div use:dialog={{label:"Print history",close:() => $historyOpen = false}} class="history-dialog" role="dialog" aria-modal="true" aria-label="Print history" tabindex="-1" on:keydown={e => {if(e.key === 'Escape') $historyOpen = false;}}>
    <header><h2>PRINT HISTORY</h2><button aria-label="Close history" on:click={() => $historyOpen = false}>×</button></header>
    {#if error}<p role="alert">{error}</p>{:else if loading}<p role="status">Loading jobs…</p>{:else if !jobs.length}<p>No recorded jobs.</p>{/if}
    <div class="table-scroll"><table><thead><tr><th>FILE</th><th>STARTED</th><th>RESULT</th><th>PRINT TIME</th><th>FILAMENT</th></tr></thead><tbody>
    {#each jobs as job (job.job_id)}<tr><td><button on:click={() => showFile(job.filename)}>{job.filename}</button></td><td>{new Date(job.start_time*1000).toLocaleString()}</td><td>{job.status}</td><td>{duration(job.print_duration)}</td><td>{((job.filament_used || 0)/1000).toFixed(2)} m</td></tr>{/each}
    </tbody></table></div>
    <footer><button disabled={loading || start === 0} on:click={() => {start = Math.max(0,start-25); load();}}>Previous</button><span>{count ? start+1 : 0}–{Math.min(start+25,count)} / {count}</span><button disabled={loading || start+25 >= count} on:click={() => {start += 25; load();}}>Next</button><button disabled={loading} on:click={load}>Refresh</button></footer>
</div>
</div>
{/if}
<style>
.history-overlay { position:fixed; inset:0; background:#000d; padding:20px; display:grid; place-items:center; z-index:2100; }
.history-dialog { width:min(1100px,100%); max-height:90dvh; overflow:auto; padding:24px; background:#101713; border:1px solid var(--retro-green-dim); }
header,footer { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:16px; } h2 { font-size:18px; }
button { font:inherit; color:var(--retro-green); background:#080e0b; border:1px solid #3e5145; padding:8px; cursor:pointer; } button:disabled { opacity:.4; }
.table-scroll { overflow:auto; } table { width:100%; border-collapse:collapse; } td,th { text-align:left; padding:10px 6px; border-bottom:1px solid #304236; font-size:13px; } td:first-child { overflow-wrap:anywhere; min-width:180px; } footer { margin:16px 0 0; } p { margin:16px 0; }
</style>
