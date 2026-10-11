import { useEffect, useRef } from "react";
import { Car } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { skipReason } from "@/lib/format";

const DRIVE_MS = 9000;    // the whole drive takes ~9 seconds
const STOP_MS = 800;      // pause at every stop

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

export default function TripMap({ result, replayKey, onStop }) {
    const containerRef = useRef(null);
    const mapRef = useRef(null);
    const carIconRef = useRef(null);   // hidden lucide icon, copied into the map marker
    const onStopRef = useRef(onStop);
    onStopRef.current = onStop;


    // Create the map once
    useEffect(() => {
        const map = L.map(containerRef.current, { zoomControl: false }).setView([20.6, 78.9], 5);

        L.control.zoom({ position: "topright" }).addTo(map);

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


    return (
        <>
            <div ref={containerRef} className="absolute inset-0 z-0" />
            <span className="hidden"><Car ref={carIconRef} size={18} strokeWidth={2.25} /></span>
        </>
    );
}
