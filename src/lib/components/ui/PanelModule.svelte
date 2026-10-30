<script>
    import { configStore } from '../../../stores/configStore.js';
    import { machineState } from '../../../stores/machineStore.js';
    export let title = "MODULE";
    export let panelKey = '';
    export let requiresReady = true;
    $: key = panelKey || title;
    $: collapsed = ($configStore.collapsedPanels || []).includes(key);
    function toggle() {
        configStore.update(config => ({ ...config, collapsedPanels: collapsed
            ? (config.collapsedPanels || []).filter(id => id !== key)
            : [...(config.collapsedPanels || []), key] }));
    }
</script>

<div class="module" class:collapsed>
    <button class="module-header" aria-expanded={!collapsed} aria-controls={'panel-content-' + encodeURIComponent(key)} on:click={toggle}>
        <span class="disclosure" aria-hidden="true">{collapsed ? '▸' : '▾'}</span> {title}
    </button>
    <div id={'panel-content-' + encodeURIComponent(key)} hidden={collapsed} inert={requiresReady && !$machineState.isReady}>
        <slot></slot>
    </div>
</div>

<style>
    .module {
        background: var(--bg-module);
        border: 4px solid #333;
        padding: 20px;
        box-shadow:
            inset 0 0 20px rgba(0, 0, 0, 0.5),
            0 4px 15px rgba(0, 0, 0, 0.7);
        height: 100%; /* Ensure modules can stretch if needed */
    }

    .collapsed .module-header { margin-bottom:0; }
    .module-header {
        display:block;
        width:100%;
        text-align:left;
        border:0;
        cursor:pointer;

        font-family: "Orbitron", monospace;
        font-size: 18px;
        font-weight: 700;
        color: var(--retro-green);
        margin-bottom: 20px;
        padding: 10px;
        background: #0a0a0a;
        border-left: 4px solid var(--retro-green);
        text-transform: uppercase;
        letter-spacing: 2px;
    }
</style>
