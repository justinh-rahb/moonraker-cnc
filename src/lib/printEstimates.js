export function estimatePrint(state, now = Date.now()) {
    const active = state.printStatsState === 'printing';
    const paused = state.printStatsState === 'paused';
    const complete = state.printStatsState === 'complete';
    // Interpolate at most one status interval. Never invent progress after a lost connection.
    const tick = active && state.isReady && state.statusUpdatedAt ? Math.min(2, Math.max(0,(now-state.statusUpdatedAt)/1000)) : 0;
    const elapsed = Math.max(0, state.totalDuration || state.printDuration || 0) + tick;
    const printing = Math.max(0,state.printDuration || 0) + tick;
    const progress = complete ? 1 : Math.min(1, Math.max(0, Number(state.printProgress) || 0));
    let remaining = null, source = 'Waiting for progress';
    if (complete) { remaining = 0; source = 'Completed'; }
    else if (active || paused) {
        if (progress >= 0.02 && printing >= 30) { remaining = printing * (1-progress) / progress; source = 'File progress estimate'; }
        else if (state.estimatedTime > 0) { remaining = Math.max(0,state.estimatedTime-printing); source = 'Slicer estimate'; }
    }
    return { elapsed, printing, progress, remaining, source, completion: active && state.isReady && remaining !== null ? now + remaining*1000 : null };
}
