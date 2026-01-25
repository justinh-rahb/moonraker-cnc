<script>
    import { animate } from 'motion';

    const { value = 0, max = 100, redline = 80, label = "GAUGE", unit = "" } = $props();
    
    // EMA smoothing configuration
    const ALPHA = 0.35; // Smoothing factor (0.35 = good balance)

    // Gauge configuration
    const startAngle = -135; // Start at bottom left
    const endAngle = 135; // End at bottom right
    const totalAngle = endAngle - startAngle; // 270 degrees
    const radius = 80;
    const centerX = 100;
    const centerY = 100;
    const strokeWidth = 12;

    // Smoothed value state (for needle animation)
    let smoothedValue = $state(0);
    let needleElement = $state(null);
    let activeArcElement = $state(null);
    let initialized = $state(false);

    // Exponential Moving Average (EMA) smoothing
    $effect(() => {
        // Initialize smoothedValue on first run
        if (!initialized) {
            smoothedValue = value;
            initialized = true;
            return;
        }
        
        // When raw value changes, apply EMA smoothing
        const newSmoothed = ALPHA * value + (1 - ALPHA) * smoothedValue;
        
        // Animate the smoothed value with spring physics
        if (needleElement && activeArcElement) {
            const newPercentage = max > 0 ? Math.min(Math.max(newSmoothed / max, 0), 1) : 0;
            const newNeedleAngle = startAngle + newPercentage * totalAngle;
            const newNeedleEndX = centerX + (radius - 15) * Math.cos(((newNeedleAngle - 90) * Math.PI) / 180);
            const newNeedleEndY = centerY + (radius - 15) * Math.sin(((newNeedleAngle - 90) * Math.PI) / 180);
            const newActiveArcPath = describeArc(centerX, centerY, radius, startAngle, newNeedleAngle);

            // Animate needle position with spring physics
            animate(
                needleElement,
                { x2: newNeedleEndX, y2: newNeedleEndY },
                { 
                    type: 'spring',
                    stiffness: 150,
                    damping: 20,
                    mass: 0.8
                }
            );

            // Animate active arc
            animate(
                activeArcElement,
                { d: newActiveArcPath },
                { 
                    type: 'spring',
                    stiffness: 150,
                    damping: 20,
                    mass: 0.8
                }
            );
        }
        
        // Update smoothed value for reactive calculations
        smoothedValue = newSmoothed;
    });

    // Calculate needle angle based on smoothed value
    const percentage = $derived(max > 0 ? Math.min(Math.max(smoothedValue / max, 0), 1) : 0);
    const needleAngle = $derived(startAngle + percentage * totalAngle);
    const redlinePercentage = $derived(max > 0 ? redline / max : 0.8);
    
    // Determine color zones
    const isRedZone = $derived(percentage >= 0.9);
    const isOrangeZone = $derived(!isRedZone && percentage >= redlinePercentage);
    const isGreenZone = $derived(!isRedZone && !isOrangeZone);

    // Calculate arc paths for the colored zones
    const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
        const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
        return {
            x: centerX + radius * Math.cos(angleInRadians),
            y: centerY + radius * Math.sin(angleInRadians),
        };
    };

    const describeArc = (x, y, radius, startAngle, endAngle) => {
        const start = polarToCartesian(x, y, radius, endAngle);
        const end = polarToCartesian(x, y, radius, startAngle);
        const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
        return [
            "M",
            start.x,
            start.y,
            "A",
            radius,
            radius,
            0,
            largeArcFlag,
            0,
            end.x,
            end.y,
        ].join(" ");
    };

    // Arc paths for zones
    const greenArc = $derived(describeArc(centerX, centerY, radius, startAngle, startAngle + redlinePercentage * totalAngle));
    const orangeArc = $derived(describeArc(centerX, centerY, radius, startAngle + redlinePercentage * totalAngle, startAngle + 0.9 * totalAngle));
    const redArc = $derived(describeArc(centerX, centerY, radius, startAngle + 0.9 * totalAngle, endAngle));

    // Needle path (initial position)
    const needleEndX = $derived(centerX + (radius - 15) * Math.cos(((needleAngle - 90) * Math.PI) / 180));
    const needleEndY = $derived(centerY + (radius - 15) * Math.sin(((needleAngle - 90) * Math.PI) / 180));

    // Format value for display (use raw value, not smoothed)
    const displayValue = $derived(value.toFixed(value >= 100 ? 0 : 1));
</script>

<div class="gauge-container">
    <div class="gauge-label">{label}</div>
    <svg viewBox="0 0 200 160" class="gauge-svg">
        <!-- Background arc -->
        <path
            d={describeArc(centerX, centerY, radius, startAngle, endAngle)}
            fill="none"
            stroke="#1a1a1a"
            stroke-width={strokeWidth}
            stroke-linecap="round"
        />
        
        <!-- Green zone -->
        <path
            d={greenArc}
            fill="none"
            stroke="var(--retro-green-dim)"
            stroke-width={strokeWidth}
            stroke-linecap="round"
            opacity="0.6"
        />
        
        <!-- Orange zone -->
        <path
            d={orangeArc}
            fill="none"
            stroke="#ff8800"
            stroke-width={strokeWidth}
            stroke-linecap="round"
            opacity="0.6"
        />
        
        <!-- Red zone -->
        <path
            d={redArc}
            fill="none"
            stroke="#ff0000"
            stroke-width={strokeWidth}
            stroke-linecap="round"
            opacity="0.6"
        />

        <!-- Active arc (shows current value) -->
        <path
            bind:this={activeArcElement}
            d={describeArc(centerX, centerY, radius, startAngle, needleAngle)}
            fill="none"
            stroke={isRedZone ? '#ff0000' : isOrangeZone ? 'var(--retro-orange)' : 'var(--retro-green)'}
            stroke-width={strokeWidth}
            stroke-linecap="round"
            class="active-arc"
            class:red-zone={isRedZone}
        />

        <!-- Needle -->
        <line
            bind:this={needleElement}
            x1={centerX}
            y1={centerY}
            x2={needleEndX}
            y2={needleEndY}
            stroke={isRedZone ? '#ff0000' : isOrangeZone ? 'var(--retro-orange)' : 'var(--retro-green)'}
            stroke-width="3"
            stroke-linecap="round"
            class="needle"
        />
        
        <!-- Center dot -->
        <circle
            cx={centerX}
            cy={centerY}
            r="5"
            fill={isRedZone ? '#ff0000' : isOrangeZone ? 'var(--retro-orange)' : 'var(--retro-green)'}
        />
    </svg>
    
    <div class="gauge-readout">
        <span class="readout-value">{displayValue}</span>
        {#if unit}
            <span class="readout-unit">{unit}</span>
        {/if}
    </div>
</div>

<style>
    .gauge-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        background: #0a0a0a;
        border: 2px solid #333;
        padding: 16px 12px 12px;
        position: relative;
    }

    .gauge-label {
        font-family: "Orbitron", monospace;
        font-size: 11px;
        font-weight: 700;
        color: #666;
        letter-spacing: 2px;
        margin-bottom: 8px;
        text-align: center;
    }

    .gauge-svg {
        width: 100%;
        height: auto;
        max-width: 200px;
    }

    .active-arc {
        filter: drop-shadow(0 0 4px currentColor);
        transition: stroke 0.3s ease;
    }

    .active-arc.red-zone {
        animation: pulse-glow 1s ease-in-out infinite;
    }

    @keyframes pulse-glow {
        0%, 100% {
            filter: drop-shadow(0 0 4px #ff0000);
        }
        50% {
            filter: drop-shadow(0 0 8px #ff0000);
        }
    }

    .needle {
        filter: drop-shadow(0 0 2px currentColor);
    }

    .gauge-readout {
        display: flex;
        align-items: baseline;
        justify-content: center;
        margin-top: 4px;
        gap: 4px;
    }

    .readout-value {
        font-family: "Orbitron", monospace;
        font-size: 24px;
        font-weight: 900;
        color: var(--retro-orange);
        letter-spacing: 2px;
        text-shadow: 0 0 8px var(--retro-orange);
    }

    .readout-unit {
        font-family: "Share Tech Mono", monospace;
        font-size: 11px;
        color: #666;
        letter-spacing: 1px;
    }
</style>
