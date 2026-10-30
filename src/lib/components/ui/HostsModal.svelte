<script>
    import { dialog } from "../../dialog.js";
    import { get } from 'svelte/store';
    import ConfirmDialog from './ConfirmDialog.svelte';
    import { workspaceStore, addHost, editHost, removeHost, switchHost } from '../../../stores/configStore.js';
    import { hostsOpen } from '../../../stores/uiStore.js';
    import { connect, connectionState } from '../../../stores/websocket.js';
    import { serverUrl } from '../../config.js';
    let editing = null;
    let removeId = null;
    let autoConnect = true;
    let name = '', ip = '', port = '7125', protocol = 'http', error = '';
    const edit = host => {
        editing = host.id; name = host.name; ip = host.config.server.ip;
        autoConnect = host.config.server.autoConnect;
        port = host.config.server.port; protocol = host.config.server.protocol || 'http'; error = '';
    };
    function save() {
        try {
            const server = { ip, port, protocol, autoConnect };
            if (editing) editHost(editing, name, server); else addHost(name, server);
            editing = null; name = ip = ''; error = '';
        } catch (e) { error = e.message; }
    }
    function select(host) {
        switchHost(host.id);
        if (!['connected','connecting'].includes(get(connectionState))) connect(serverUrl(host.config.server));
        $hostsOpen = false;
    }
</script>
{#if $hostsOpen}
<div class="overlay" role="presentation">
<div use:dialog={{label:"Moonraker hosts",close:() => $hostsOpen = false}} class="host-dialog" role="dialog" aria-modal="true" aria-label="Moonraker hosts" tabindex="-1" on:keydown={e => { if (e.key === 'Escape') $hostsOpen = false; }}>
    <header><h2>MOONRAKER HOSTS</h2><button on:click={() => $hostsOpen = false} aria-label="Close hosts">×</button></header>
    <p>Each host keeps its own macros, cameras, presets and dashboard layout.</p>
    {#each $workspaceStore.hosts as host (host.id)}
        <div class="host-row">
            <button class="host-name" on:click={() => select(host)} aria-current={host.id === $workspaceStore.activeHostId ? 'true' : undefined}>{host.name} {host.id === $workspaceStore.activeHostId ? '●' : ''}<small>{serverUrl(host.config.server)}</small></button>
            <button on:click={() => edit(host)}>Edit</button>
            <button disabled={$workspaceStore.hosts.length === 1} on:click={() => removeId = host.id}>Remove</button>
        </div>
    {/each}
    <form on:submit|preventDefault={save}>
        <h3>{editing ? 'EDIT HOST' : 'ADD HOST'}</h3>
        <label>Name<input bind:value={name} required /></label>
        <label>Host address<input bind:value={ip} placeholder="printer.local" required /></label>
        <label>Port<input type="number" min="1" max="65535" bind:value={port} /></label>
        <label>Protocol<select bind:value={protocol}><option value="http">HTTP</option><option value="https">HTTPS</option></select></label>
        <label><input type="checkbox" bind:checked={autoConnect} /> Connect automatically</label>
        {#if error}<p role="alert">{error}</p>{/if}
        <button type="submit">{editing ? 'Save host' : 'Add host'}</button>
        {#if editing}<button type="button" on:click={() => { editing = null; name = ip = ''; }}>Cancel edit</button>{/if}
    </form>
</div>
</div>
{/if}
<ConfirmDialog isOpen={removeId !== null} title="REMOVE HOST" message="Remove this saved connection? Settings already synchronized to Moonraker stay on that printer." onConfirm={() => { try {removeHost(removeId);} catch(e) {error = e.message;} removeId = null;}} onCancel={() => removeId = null} />
<style>
.overlay { position:fixed; inset:0; background:#000d; z-index:2200; display:grid; place-items:center; padding:16px; }
.host-dialog { width:min(680px,100%); max-height:90dvh; overflow:auto; background:#101713; border:1px solid var(--retro-green-dim); padding:24px; }
header,.host-row { display:flex; gap:10px; align-items:center; justify-content:space-between; margin-bottom:16px; }
h2 { font-size:18px; } p,small { color:#a1aca4; margin:12px 0; } small { display:block; }
.host-name { flex:1; text-align:left; } form { display:grid; gap:12px; } label { display:grid; gap:6px; }
button,input,select { background:#080e0b; color:var(--retro-green); border:1px solid #3e5145; padding:10px; font:inherit; min-width:0; } button { cursor:pointer; } button:disabled { opacity:.4; }
</style>
