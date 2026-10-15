import { useEffect, useRef, useState } from "react";
import { Car } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { skipReason } from "@/lib/format";

const DRIVE_MS = 9000;    // the whole drive takes ~9 seconds
const STOP_MS = 800;      // pause at every stop
const CAR_RACE_DURATION = 8000; // time for the car race to complete

// Algorithm colors and line styles
const ALGORITHM_STYLES = {
    "Backtracking": { color: "#3b82f6", offset: -0.03, dashArray: "10, 5" }, // blue, left offset, dashed
    "Branch and Bound": { color: "#22c55e", offset: 0, dashArray: null }, // green, no offset, solid
    "Dynamic Programming": { color: "#ef4444", offset: 0.03, dashArray: "5, 5" } // red, right offset, dashed
};

function pin(className, label) {
    return L.divIcon({
        className: "",
        html: `<div class="map-pin ${className}">${label}</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
    });
}

// Tooltip built from DOM nodes, so place names are never parsed as HTML
function tooltip(title, body) {
    const el = document.createElement("div");
    const strong = document.createElement("strong");
    strong.textContent = title;
    el.append(strong);

    if (body) {
        const p = document.createElement("p");
        p.textContent = body;
        el.append(p);
    }

    return el;
}

export default function TripMap({ result, comparison, replayKey, onStop }) {
    const containerRef = useRef(null);
    const mapRef = useRef(null);
    const carIconRef = useRef(null);   // hidden lucide icon, copied into the map marker
    const onStopRef = useRef(onStop);
    onStopRef.current = onStop;
    const [isCarRace, setIsCarRace] = useState(false);
    const carRaceRef = useRef(null);
    const comparisonWithWinnerRef = useRef(null);

    // Determine fastest algorithm (lower time, or if tied, lower nodes explored)
    const comparisonWithWinner = (comparison || []).map(c => ({
        ...c,
        isFastest: false
    }));

    if (comparisonWithWinner.length > 0) {
        const sorted = [...comparisonWithWinner].sort((a, b) => {
            if (a.timeMs !== b.timeMs) return a.timeMs - b.timeMs;
            return a.nodesExplored - b.nodesExplored;
        });
        sorted[0].isFastest = true;
    }

    // Update ref when comparison changes
    comparisonWithWinnerRef.current = comparisonWithWinner;


    // Create the map once
    useEffect(() => {
        const map = L.map(containerRef.current, { zoomControl: false }).setView([20.6, 78.9], 5);

        L.control.zoom({ position: "bottomright" }).addTo(map);

        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        mapRef.current = map;
        return () => map.remove();
    }, []);


    // Draw the trip and drive the car along it
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !result) return;

        const layer = L.layerGroup().addTo(map);
        const path = result.geometry.map(([lat, lon]) => L.latLng(lat, lon));

        L.polyline(path, { color: "#a1a1aa", weight: 4, dashArray: "1 8", lineCap: "round" }).addTo(layer);
        const trail = L.polyline([], { color: "#18181b", weight: 4 }).addTo(layer);

        result.skipped.forEach(p =>
            L.marker([p.lat, p.lon], { icon: pin("skipped", "×") })
                .bindTooltip(tooltip(`${p.name} (skipped)`, skipReason(p, result).text), { className: "map-tooltip" })
                .addTo(layer));

        const pins = result.stops.map((s, k) =>
            L.marker([s.lat, s.lon], {
                icon: pin(s.type, s.type === "start" ? "A" : s.type === "final" ? "B" : k),
                zIndexOffset: 500
            }).bindTooltip(tooltip(s.name), { className: "map-tooltip" }).addTo(layer));

        const car = L.marker(path[0], {
            icon: L.divIcon({ className: "", html: `<div class="map-car">${carIconRef.current.outerHTML}</div>`, iconSize: [34, 34], iconAnchor: [17, 17] }),
            zIndexOffset: 1000
        }).addTo(layer);

        map.invalidateSize();
        map.fitBounds(L.latLngBounds([...path, ...result.skipped.map(p => [p.lat, p.lon])]), { padding: [60, 60] });

        // Distance along the road to every point
        const along = [0];
        for (let i = 1; i < path.length; i++) {
            along.push(along[i - 1] + path[i - 1].distanceTo(path[i]));
        }

        // Road point closest to each stop (searching forward)
        let from = 0;
        const stopAt = result.stops.map(s => {
            let best = from;
            for (let i = from; i < path.length; i++) {
                if (path[i].distanceTo([s.lat, s.lon]) < path[best].distanceTo([s.lat, s.lon])) best = i;
            }
            return (from = best);
        });

        const total = along[along.length - 1];
        let distance = 0, i = 0, next = 0, pauseUntil = 0, last = null, frameId;

        function frame(now) {
            const dt = last === null ? 0 : now - last;
            last = now;

            if (now >= pauseUntil) {
                distance = Math.min(distance + (total / DRIVE_MS) * dt, total);

                if (distance >= along[stopAt[next]]) {
                    distance = along[stopAt[next]];
                    pins[next].getElement().firstChild.classList.add("reached");
                    onStopRef.current(next++);
                    pauseUntil = now + STOP_MS;
                }
            }

            while (i < path.length - 2 && along[i + 1] < distance) i++;

            const a = path[i], b = path[Math.min(i + 1, path.length - 1)];
            const t = along[i + 1] > along[i] ? (distance - along[i]) / (along[i + 1] - along[i]) : 0;
            const pos = L.latLng(a.lat + (b.lat - a.lat) * t, a.lng + (b.lng - a.lng) * t);

            car.setLatLng(pos);
            trail.setLatLngs([...path.slice(0, i + 1), pos]);

            if (next < stopAt.length) frameId = requestAnimationFrame(frame);
        }

        frameId = requestAnimationFrame(frame);

        return () => {
            cancelAnimationFrame(frameId);
            layer.remove();
        };
    }, [result, replayKey]);

    function toggleCarRace() {
        if (isCarRace) {
            setIsCarRace(false);
            if (carRaceRef.current?.frameId) {
                cancelAnimationFrame(carRaceRef.current.frameId);
            }
        } else {
            // Clean up any existing animation first
            if (carRaceRef.current?.frameId) {
                cancelAnimationFrame(carRaceRef.current.frameId);
            }
            if (carRaceRef.current?.layer) {
                carRaceRef.current.layer.remove();
            }
            carRaceRef.current = null;
            setIsCarRace(true);
        }
    }

    // Car race animation
    useEffect(() => {
        if (!isCarRace || !comparisonWithWinnerRef.current?.length || !mapRef.current) return;

        // Don't restart if already running
        if (carRaceRef.current?.frameId) return;

        const map = mapRef.current;
        const layer = L.layerGroup().addTo(map);

        // Use the same path for all cars (from Branch and Bound)
        const bestAlgo = comparisonWithWinnerRef.current.find(c => c.algorithm === "Branch and Bound") || comparisonWithWinnerRef.current[0];
        const path = bestAlgo.geometry.map(([lat, lon]) => L.latLng(lat, lon));

        // Distance along the path
        const along = [0];
        for (let i = 1; i < path.length; i++) {
            along.push(along[i - 1] + path[i - 1].distanceTo(path[i]));
        }
        const total = along[along.length - 1];

        // Calculate speeds based on algorithm time and nodes explored (lower = faster)
        const maxTime = Math.max(...comparisonWithWinnerRef.current.map(c => c.timeMs));
        const maxNodes = Math.max(...comparisonWithWinnerRef.current.map(c => c.nodesExplored));
        const speedFactors = comparisonWithWinnerRef.current.map(c => {
            const timeScore = maxTime / c.timeMs;
            const nodeScore = maxNodes / c.nodesExplored;
            return (timeScore + nodeScore) / 2; // Average of time and node efficiency
        });

        // Create car markers for each algorithm
        const cars = comparisonWithWinnerRef.current.map((algo, idx) => {
            const style = ALGORITHM_STYLES[algo.algorithm];

            const car = L.marker(path[0], {
                icon: L.divIcon({
                    className: "",
                    html: `<div class="map-car-algo" style="background: ${style.color}; border-color: ${style.color}">${carIconRef.current.outerHTML}</div>`,
                    iconSize: [28, 28],
                    iconAnchor: [14, 14]
                }),
                zIndexOffset: 1100 + idx
            }).addTo(layer);

            return { car, speedFactor: speedFactors[idx], finished: false };
        });

        carRaceRef.current = { cars, path, along, total, layer, startTime: performance.now() };

        function animate(now) {
            const elapsed = now - carRaceRef.current.startTime;
            let allFinished = true;

            carRaceRef.current.cars.forEach(({ car, speedFactor }) => {
                if (car.finished) return;

                allFinished = false;

                // Calculate distance based on speed factor (faster algorithms travel more distance in same time)
                const targetDistance = (elapsed * speedFactor / CAR_RACE_DURATION) * carRaceRef.current.total;

                if (targetDistance >= carRaceRef.current.total) {
                    car.setLatLng(carRaceRef.current.path[carRaceRef.current.path.length - 1]);
                    car.finished = true;
                    return;
                }

                // Find position along path
                let i = 0;
                while (i < carRaceRef.current.path.length - 2 && carRaceRef.current.along[i + 1] < targetDistance) i++;

                const a = carRaceRef.current.path[i], b = carRaceRef.current.path[Math.min(i + 1, carRaceRef.current.path.length - 1)];
                const t = carRaceRef.current.along[i + 1] > carRaceRef.current.along[i] ? (targetDistance - carRaceRef.current.along[i]) / (carRaceRef.current.along[i + 1] - carRaceRef.current.along[i]) : 0;
                const pos = L.latLng(a.lat + (b.lat - a.lat) * t, a.lng + (b.lng - a.lng) * t);

                car.setLatLng(pos);
            });

            if (!allFinished) {
                carRaceRef.current.frameId = requestAnimationFrame(animate);
            } else {
                setIsCarRace(false);
            }
        }

        carRaceRef.current.frameId = requestAnimationFrame(animate);

        return () => {
            if (carRaceRef.current?.frameId) {
                cancelAnimationFrame(carRaceRef.current.frameId);
            }
            carRaceRef.current?.layer.remove();
        };
    }, [isCarRace, comparison]);


    return (
        <>
            <div ref={containerRef} className="absolute inset-0 z-0" />
            <span className="hidden"><Car ref={carIconRef} size={18} strokeWidth={2.25} /></span>

            {comparison && (
                <>
                    {/* Car Race Button */}
                    <button
                        onClick={toggleCarRace}
                        className="absolute top-4 left-4 z-[1000] flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-lg hover:bg-gray-50 transition-colors"
                    >
                        <Car size={20} />
                        <span className="text-sm font-medium">
                            {isCarRace ? "Stop Race" : "Race Cars"}
                        </span>
                    </button>

                    {/* Algorithm Legend */}
                    <div className="absolute top-4 right-4 z-[1000] bg-white rounded-lg shadow-lg p-3 space-y-2">
                        <div className="text-xs font-semibold text-gray-700 mb-2">Algorithm Performance</div>
                        {comparisonWithWinnerRef.current?.map(algo => {
                            const style = ALGORITHM_STYLES[algo.algorithm] || { color: "#a1a1aa" };
                            return (
                                <div key={algo.algorithm} className="flex items-center gap-2">
                                    <div
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: style.color }}
                                    />
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-1">
                                            <span className="text-xs text-gray-600">{algo.algorithm}</span>
                                            {algo.isFastest && (
                                                <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">fastest</span>
                                            )}
                                        </div>
                                        <span className="text-[10px] text-gray-400">{algo.timeMs.toFixed(2)}ms · {algo.nodesExplored.toLocaleString()} nodes</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </>
    );
}
