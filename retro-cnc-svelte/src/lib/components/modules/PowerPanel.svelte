<script>
    import PanelModule from "../ui/PanelModule.svelte";
    import CncButton from "../ui/CncButton.svelte";
    import SettingsModal from "../ui/SettingsModal.svelte";
    import { send } from "../../../stores/websocket.js";
    import { configStore } from "../../../stores/configStore.js";

    let isSettingsOpen = false;

    // Get last 4 macros (mapped to power panel)
    $: macros = $configStore.macros.slice(4, 8);

    const runMacro = (gcode) => {
        send("printer.gcode.script", { script: gcode });
    };
</script>

<PanelModule title="POWER">
    <div class="action-buttons">
        {#each macros as macro}
            <CncButton
                variant={macro.style || "action"}
                on:click={() => runMacro(macro.gcode)}
            >
                {macro.label}
            </CncButton>
        {/each}
    </div>

    <div style="margin-top: 10px;">
        <button class="settings-link" on:click={() => (isSettingsOpen = true)}>
            CONFIGURE PANEL
        </button>
    </div>

    <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => (isSettingsOpen = false)}
    />
</PanelModule>

<style>
    .action-buttons {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
    }

    .settings-link {
        background: none;
        border: none;
        color: #444;
        text-decoration: underline;
        font-family: "Share Tech Mono", monospace;
        font-size: 12px;
        cursor: pointer;
        width: 100%;
        text-align: right;
    }
    .settings-link:hover {
        color: #888;
    }
</style>
