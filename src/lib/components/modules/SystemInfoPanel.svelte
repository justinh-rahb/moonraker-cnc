<script>
    import PanelModule from "../ui/PanelModule.svelte";
    import { systemInfo, formatMemory } from "../../../stores/systemInfoStore.js";

    // Reactive values from store
    $: isLoading = $systemInfo.isLoading;
    $: error = $systemInfo.error;
    $: host = $systemInfo.host;
    $: klipper = $systemInfo.klipper;
    $: mcus = $systemInfo.mcus;

    // MCU list for iteration
    $: mcuList = Object.entries(mcus).map(([key, value]) => ({
        key,
        ...value
    }));

    // Format version string (truncate git hash if too long)
    const formatVersion = (version) => {
        if (!version) return 'N/A';
        // Truncate long git hashes: v0.12.0-272-g13c75ea87 -> v0.12.0-272-g13c75e...
        if (version.length > 30) {
            return version.substring(0, 27) + '...';
        }
        return version;
    };

    // Format build versions (GCC/binutils info)
    const formatBuildInfo = (buildVersions) => {
        if (!buildVersions) return null;
        // Extract just GCC version: "gcc: (GCC) 5.4.0 binutils: ..." -> "GCC 5.4.0"
        const gccMatch = buildVersions.match(/gcc:\s*\(GCC\)\s*([\d.]+)/i);
        if (gccMatch) {
            return `GCC ${gccMatch[1]}`;
        }
        return null;
    };
</script>

<PanelModule title="SYSTEM INFO">
    <div class="system-info-container">
        {#if isLoading}
            <div class="loading-state">
                <div class="loading-text">LOADING SYSTEM INFO...</div>
            </div>
        {:else if error}
            <div class="error-state">
                <div class="error-text">{error}</div>
            </div>
        {:else}
            <!-- Host Section -->
            <div class="info-section">
                <div class="section-title">HOST</div>
                <div class="info-rows">
                    {#if host.hostname}
                        <div class="info-row">
                            <span class="info-label">Hostname</span>
                            <span class="info-value">{host.hostname}</span>
                        </div>
                    {/if}
                    {#if host.distribution.name}
                        <div class="info-row">
                            <span class="info-label">OS</span>
                            <span class="info-value">
                                {host.distribution.name}
                                {#if host.distribution.version}
                                    {host.distribution.version}
                                {/if}
                            </span>
                        </div>
                    {/if}
                    {#if host.cpu.model}
                        <div class="info-row">
                            <span class="info-label">CPU</span>
                            <span class="info-value">
                                {host.cpu.model}
                                {#if host.cpu.cores > 0}
                                    ({host.cpu.cores} cores)
                                {/if}
                            </span>
                        </div>
                    {/if}
                    {#if host.memory.total > 0}
                        <div class="info-row">
                            <span class="info-label">Memory</span>
                            <span class="info-value">
                                {formatMemory(host.memory.total, host.memory.units)}
                            </span>
                        </div>
                    {/if}
                </div>
            </div>

            <!-- Klipper Section -->
            {#if klipper.version}
                <div class="info-section">
                    <div class="section-title">KLIPPER</div>
                    <div class="info-rows">
                        <div class="info-row">
                            <span class="info-label">Version</span>
                            <span class="info-value version-highlight">
                                {formatVersion(klipper.version)}
                            </span>
                        </div>
                        {#if klipper.state}
                            <div class="info-row">
                                <span class="info-label">State</span>
                                <span class="info-value state-{klipper.state}">
                                    {klipper.state.toUpperCase()}
                                </span>
                            </div>
                        {/if}
                    </div>
                </div>
            {/if}

            <!-- MCU Section -->
            {#if mcuList.length > 0}
                <div class="info-section">
                    <div class="section-title">
                        MCU{mcuList.length > 1 ? 'S' : ''}
                    </div>
                    <div class="mcu-grid">
                        {#each mcuList as mcu}
                            <div class="mcu-card">
                                <div class="mcu-name">{mcu.name}</div>
                                <div class="mcu-details">
                                    <div class="mcu-row">
                                        <span class="mcu-label">Version</span>
                                        <span class="mcu-value version-highlight">
                                            {formatVersion(mcu.version)}
                                        </span>
                                    </div>
                                    {#if mcu.type}
                                        <div class="mcu-row">
                                            <span class="mcu-label">Type</span>
                                            <span class="mcu-value">{mcu.type}</span>
                                        </div>
                                    {/if}
                                    {#if formatBuildInfo(mcu.buildVersions)}
                                        <div class="mcu-row">
                                            <span class="mcu-label">Build</span>
                                            <span class="mcu-value">
                                                {formatBuildInfo(mcu.buildVersions)}
                                            </span>
                                        </div>
                                    {/if}
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}

            {#if !klipper.version && mcuList.length === 0}
                <div class="empty-state">No system information available</div>
            {/if}
        {/if}
    </div>
</PanelModule>

<style>
    .system-info-container {
        display: flex;
        flex-direction: column;
        gap: 15px;
    }

    /* Loading and Error States */
    .loading-state,
    .error-state {
        padding: 30px 20px;
        text-align: center;
    }

    .loading-text {
        font-family: "Orbitron", monospace;
        font-size: 14px;
        color: var(--retro-green);
        letter-spacing: 2px;
        animation: pulse 1.5s ease-in-out infinite;
    }

    @keyframes pulse {
        0%,
        100% {
            opacity: 0.5;
        }
        50% {
            opacity: 1;
        }
    }

    .error-text {
        font-family: "Orbitron", monospace;
        font-size: 12px;
        color: #ff4444;
        letter-spacing: 1px;
    }

    .empty-state {
        color: #444;
        font-size: 11px;
        text-align: center;
        padding: 20px;
        font-style: italic;
    }

    /* Section Styles */
    .info-section {
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid #333;
        padding: 12px;
    }

    .section-title {
        font-family: "Orbitron", monospace;
        font-size: 12px;
        font-weight: 700;
        color: var(--retro-green);
        text-transform: uppercase;
        letter-spacing: 2px;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid rgba(0, 255, 0, 0.2);
        text-shadow: 0 0 8px rgba(0, 255, 0, 0.5);
    }

    /* Info Rows */
    .info-rows {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .info-row {
        display: grid;
        grid-template-columns: 100px 1fr;
        gap: 10px;
        align-items: start;
        font-size: 11px;
    }

    .info-label {
        font-family: "Orbitron", monospace;
        font-weight: 600;
        color: #888;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .info-value {
        font-family: "Share Tech Mono", monospace;
        color: var(--retro-green);
        word-break: break-word;
        line-height: 1.4;
    }

    /* Version Highlighting */
    .version-highlight {
        color: #00ffff;
        text-shadow: 0 0 8px rgba(0, 255, 255, 0.4);
        font-weight: 600;
    }

    /* State Colors */
    .state-ready {
        color: var(--retro-green);
    }

    .state-shutdown,
    .state-error {
        color: #ff4444;
    }

    .state-startup {
        color: #ffaa00;
    }

    /* MCU Grid */
    .mcu-grid {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .mcu-card {
        background: #000;
        border: 1px solid rgba(0, 255, 0, 0.2);
        padding: 10px;
        box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.5);
    }

    .mcu-name {
        font-family: "Orbitron", monospace;
        font-size: 11px;
        font-weight: 700;
        color: var(--retro-orange);
        letter-spacing: 1px;
        margin-bottom: 8px;
        padding-bottom: 6px;
        border-bottom: 1px solid rgba(255, 100, 0, 0.2);
    }

    .mcu-details {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .mcu-row {
        display: grid;
        grid-template-columns: 70px 1fr;
        gap: 8px;
        font-size: 10px;
    }

    .mcu-label {
        font-family: "Orbitron", monospace;
        font-weight: 600;
        color: #666;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .mcu-value {
        font-family: "Share Tech Mono", monospace;
        color: #aaa;
        word-break: break-word;
        line-height: 1.3;
    }

    /* Responsive adjustments */
    @media (max-width: 768px) {
        .info-row {
            grid-template-columns: 1fr;
            gap: 4px;
        }

        .mcu-row {
            grid-template-columns: 1fr;
            gap: 4px;
        }

        .info-value,
        .mcu-value {
            padding-left: 10px;
        }
    }
</style>
