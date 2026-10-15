// 1.5 -> "1 hr 30 min"
export function formatTime(hours) {
    const totalMinutes = Math.round(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;

    if (h === 0) return `${m} min`;
    if (m === 0) return `${h} hr`;
    return `${h} hr ${m} min`;
}

// Hours since departure -> "3:05"
export function clock(hours) {
    const totalMinutes = Math.round(hours * 60);
    return `${Math.floor(totalMinutes / 60)}:${String(totalMinutes % 60).padStart(2, "0")}`;
}

export function formatMs(ms) {
    if (ms === 0) return "< 1 µs";
    return ms < 1 ? `${Math.round(ms * 1000)} µs` : `${ms.toFixed(2)} ms`;
}

export function formatBytes(bytes) {
    if (!bytes || bytes === 0) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Plain-text reason a place was skipped (used in the list and the map tooltip)
export function skipReason(place, result) {
    const why = place.why;
    const start = result.stops[0].name;
    const final = result.stops[result.stops.length - 1].name;
    const available = result.totalTime + result.remainingTime;

    if (why.reason === "tooFar") {
        return {
            label: "Too far",
            text: `${start} → ${place.name} → ${final} alone takes ${formatTime(why.aloneTime)}, ` +
                  `but you only have ${formatTime(available)}.`
        };
    }

    const detour = Math.max(0, why.detour);
    const other = why.bestWith;

    let text = `Needs at least ${formatTime(why.explore + detour)} (${formatTime(why.explore)} visit + ` +
               `${formatTime(detour)} detour), but only ${formatTime(why.remaining)} is left. `;

    if (other.value === result.totalValue) {
        text += `A plan with it is also worth ${other.value}, but takes ${formatTime(other.time - result.totalTime)} longer.`;
    } else {
        text += `The best plan with it is worth ${other.value} instead of ${result.totalValue}` +
                (other.replaces.length ? `, because it would replace ${other.replaces.join(", ")}.` : ".");
    }

    return { label: "No time", text };
}
