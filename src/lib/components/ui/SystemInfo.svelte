<script>
    import { systemInfo, formatMemory } from "../../../stores/systemInfoStore.js";

    // Reactive values from store
    $: isLoading = $systemInfo.isLoading;
    $: error = $systemInfo.error;
    $: host = $systemInfo.host;
    $: firmware = $systemInfo.firmware;
    $: mcus = $systemInfo.mcus;

    // MCU list for iteration
    $: mcuList = Object.entries(mcus).map(([key, value]) => ({
        key,
        ...value
    }));

    // Format version string (truncate git hash if too long)
    const formatVersion = (version) => {
        if (!version) return 'N/A';
        // Truncate long git hashes for display
        if (version.length > 35) {
            return version.substring(0, 32) + '...';
        }
        return version;
    };

    // Format build versions (GCC/binutils info)
    const formatBuildInfo = (buildVersions) => {
        if (!buildVersions) return null;
        // Extract just GCC version
        const gccMatch = buildVersions.match(/gcc:\s*\(GCC\)\s*([\d.]+)/i);
        if (gccMatch) {
            return `GCC ${gccMatch[1]}`;
        }
        return null;
    };
</script>

<div class="system-info-sections">
    {#if isLoading}
        <div class="loading-state">Loading system information...</div>
    {:else if error}
        <div class="error-state">{error}</div>
    {:else}
        <!-- Host Information -->
        <div class="info-section">
            <div class="section-title">HOST SYSTEM</div>
            <div class="info-grid">
                {#if host.hostname}
                    <div class="info-row">
                        <span class="info-label">HOSTNAME:</span>
                        <span class="info-value">{host.hostname}</span>
                    </div>
                {/if}
                {#if host.distribution.name}
                    <div class="info-row">
                        <span class="info-label">OS:</span>
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
                        <span class="info-label">CPU:</span>
                        <span class="info-value">
                            {host.cpu.model}
                            {#if host.cpu.cores > 0}
                                ({host.cpu.cores} {host.cpu.cores === 1 ? 'core' : 'cores'})
                            {/if}
                        </span>
                    </div>
                {/if}
                {#if host.memory.total > 0}
                    <div class="info-row">
                        <span class="info-label">MEMORY:</span>
                        <span class="info-value">
                            {formatMemory(host.memory.total, host.memory.units)}
                        </span>
                    </div>
                {/if}
            </div>
        </div>

        <!-- Firmware Information -->
        {#if firmware.name || firmware.version}
            <div class="info-section">
                <div class="section-title">FIRMWARE</div>
                <div class="info-grid">
                    {#if firmware.name}
                        <div class="info-row">
                            <span class="info-label">NAME:</span>
                            <span class="info-value firmware-name">{firmware.name}</span>
                        </div>
                    {/if}
                    {#if firmware.version}
                        <div class="info-row">
                            <span class="info-label">VERSION:</span>
                            <span class="info-value version-text">
                                {formatVersion(firmware.version)}
                            </span>
                        </div>
                    {/if}
                    {#if firmware.state}
                        <div class="info-row">
                            <span class="info-label">STATE:</span>
                            <span class="info-value state-{firmware.state}">
                                {firmware.state.toUpperCase()}
                            </span>
                        </div>
                    {/if}
                </div>
            </div>
        {/if}

        <!-- MCU Information -->
        {#if mcuList.length > 0}
            <div class="info-section">
                <div class="section-title">MICROCONTROLLER{mcuList.length > 1 ? 'S' : ''}</div>
                <div class="mcu-list">
                    {#each mcuList as mcu}
                        <div class="mcu-item">
                            <div class="mcu-header">{mcu.name}</div>
                            <div class="info-grid">
                                <div class="info-row">
                                    <span class="info-label">VERSION:</span>
                                    <span class="info-value version-text">
                                        {formatVersion(mcu.version)}
                                    </span>
                                </div>
                                {#if mcu.type}
                                    <div class="info-row">
                                        <span class="info-label">TYPE:</span>
                                        <span class="info-value">{mcu.type}</span>
                                    </div>
                                {/if}
                                {#if formatBuildInfo(mcu.buildVersions)}
                                    <div class="info-row">
                                        <span class="info-label">BUILD:</span>
                                        <span class="info-value">
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

        {#if !firmware.version && mcuList.length === 0}
            <div class="empty-state">No system information available</div>
        {/if}
    {/if}
</div>

<style>
    .system-info-sections {
        display: flex;
        flex-direction: column;
        gap: 20px;
    }

    .loading-state,
    .error-state,
    .empty-state {
        padding: 20px;
        text-align: center;
        font-size: 12px;
        color: #888;
        font-style: italic;
    }

    .error-state {
        color: #ff4444;
    }

    .info-section {
        background: #0a0a0a;
        border: 2px solid #333;
        padding: 15px;
    }

    .section-title {
        color: var(--retro-orange);
        font-weight: bold;
        margin-bottom: 15px;
        border-bottom: 1px solid #333;
        padding-bottom: 8px;
        font-size: 14px;
        font-family: 'Orbitron', monospace;
        letter-spacing: 1px;
    }

    .info-grid {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .info-row {
        display: grid;
        grid-template-columns: 120px 1fr;
        gap: 15px;
        align-items: start;
        font-size: 12px;
    }

    .info-label {
        color: #666;
        font-family: 'Orbitron', monospace;
        font-weight: 600;
        letter-spacing: 0.5px;
    }

    .info-value {
        color: var(--retro-green);
        font-family: 'Share Tech Mono', monospace;
        word-break: break-word;
        line-height: 1.4;
    }

    .firmware-name {
        color: var(--retro-orange);
        font-weight: 700;
        text-shadow: 0 0 8px rgba(255, 100, 0, 0.4);
    }

    .version-text {
        color: #00ffff;
        text-shadow: 0 0 8px rgba(0, 255, 255, 0.3);
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

    /* MCU List */
    .mcu-list {
        display: flex;
        flex-direction: column;
        gap: 15px;
    }

    .mcu-item {
        background: #000;
        border: 1px solid #222;
        padding: 12px;
    }

    .mcu-header {
        color: var(--retro-orange);
        font-family: 'Orbitron', monospace;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 1px;
        margin-bottom: 10px;
        padding-bottom: 6px;
        border-bottom: 1px solid #222;
    }

    /* Responsive */
    @media (max-width: 768px) {
        .info-row {
            grid-template-columns: 1fr;
            gap: 5px;
        }

        .info-value {
            padding-left: 10px;
        }
    }
</style>
