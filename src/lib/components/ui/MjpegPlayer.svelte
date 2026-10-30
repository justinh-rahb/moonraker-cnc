<script>
    import { onDestroy } from 'svelte';
    export let url = '';
    export let active = false;
    export let maxFps = 0;
    export let label = 'Camera';
    export let transformStyle = '';
    export let onFps = () => {};
    let canvas;
    let worker;
    let native = false;
    let nativeUrl = '';
    let error = '';
    let reconnect;
    let session = 0;
    let destroyed = false;
    function stop() {
        session++;
        worker?.postMessage({type:'stop'});
        worker?.terminate(); worker = null;
        clearTimeout(reconnect); nativeUrl = '';
        onFps(0);
    }
    function start(source, visible, rate, surface) {
        stop(); error = ''; native = false;
        if (!visible || !source || !surface || destroyed) return;
        const current = session;
        const fallback = () => {
            if (current !== session || destroyed) return;
            worker?.terminate(); worker = null;
            native = true; nativeUrl = source; error = ''; onFps(0);
        };
        if (typeof Worker === 'undefined' || typeof createImageBitmap === 'undefined') { fallback(); return; }
        try {
            worker = new Worker(new URL('../../mjpeg.worker.js', import.meta.url), {type:'module'});
            const context = surface.getContext('2d');
            if (!context) { fallback(); return; }
            worker.onmessage = ({data}) => {
                if (current !== session) { data.bitmap?.close(); return; }
                if (data.type === 'frame') {
                    const bitmap = data.bitmap;
                    try {
                        if (surface.width !== bitmap.width) surface.width = bitmap.width;
                        if (surface.height !== bitmap.height) surface.height = bitmap.height;
                        context.drawImage(bitmap,0,0); error = '';
                    } finally { bitmap.close(); worker?.postMessage({type:'drawn'}); }
                } else if (data.type === 'fps') onFps(data.fps);
                else if (data.type === 'error') {
                    if (data.nativeFallback) fallback();
                    else { error = data.message; onFps(0); }
                }
            };
            worker.onerror = fallback;
            worker.postMessage({type:'start',url:source,maxFps:rate});
        } catch { fallback(); }
    }
    function nativeError(event) {
        if (!native || !active || destroyed || event.currentTarget?.src !== nativeUrl) return;
        error = 'Camera unavailable; reconnecting…';
        clearTimeout(reconnect);
        nativeUrl = '';
        reconnect = setTimeout(() => { if (active && !destroyed) nativeUrl = url; }, 3000);
    }
    $: start(url, active, maxFps, canvas);
    onDestroy(() => { destroyed = true; stop(); });
</script>
<canvas bind:this={canvas} class:hidden={native} aria-label={label} style:transform={transformStyle}></canvas>
{#if native && active && nativeUrl}
    <img src={nativeUrl} alt={label} style:transform={transformStyle} on:load={() => error = ''} on:error={nativeError} />
{/if}
{#if error && active}<div class="stream-error" role="status">{error}</div>{/if}
<style>
    canvas,img { position:absolute; inset:0; width:100%; height:100%; object-fit:contain; }
    .hidden { display:none; }
    .stream-error { position:absolute; bottom:8px; left:8px; right:8px; padding:6px; background:#080d0be6; color:var(--retro-orange); font-size:12px; z-index:2; }
</style>
