const express = require("express");
const path = require("path");
const { execFile } = require("child_process");

const app = express();

const PORT = process.env.PORT || 3000;   // Render sets PORT
const ROOT = path.join(__dirname, "..");
const PLANNER = path.join(ROOT, "cpp", process.platform === "win32" ? "planner.exe" : "planner");
const USER_AGENT = "SmartTravelPlanner/1.0 (DAA student project)";


// ==========================================
// MIDDLEWARE + FRONTEND
// ==========================================

app.use(express.json());

// React frontend, built into dist/ by "npm run build"
app.use(express.static(path.join(ROOT, "dist")));
app.get("/", (req, res) => res.status(503).send("Frontend not built yet. Run: npm run build"));


// ==========================================
// MAP DATA (OpenStreetMap, no API key needed)
// ==========================================

async function getJson(url) {
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    return response.json();
}

// Photon geocoder: place name -> [lon, lat]
// "near" biases the search towards the start, so "Station" finds the local one
async function geocode(name, near) {
    let url = "https://photon.komoot.io/api/?limit=1&q=" + encodeURIComponent(name);

    if (near) {
        url += `&lon=${near[0]}&lat=${near[1]}`;
    }

    const data = await getJson(url);

    if (!data.features || data.features.length === 0) {
        throw new Error(`Location not found: ${name}`);
    }

    return data.features[0].geometry.coordinates;
}

// OSRM: road geometry through the chosen stops, as [lat, lon] points for the map
async function roadGeometry(coordinates) {
    const url = "https://router.project-osrm.org/route/v1/driving/" +
        coordinates.join(";") + "?overview=full&geometries=geojson";

    const data = await getJson(url);

    if (data.code !== "Ok") {
        return coordinates.map(([lon, lat]) => [lat, lon]);   // straight lines as fallback
    }

    // Keep at most ~1500 points so the map animation stays smooth
    const points = data.routes[0].geometry.coordinates;
    const step = Math.ceil(points.length / 1500);

    return points
        .filter((_, i) => i % step === 0 || i === points.length - 1)
        .map(([lon, lat]) => [lat, lon]);
}

// OSRM: driving time (hours) and distance (km) between every pair
async function routeMatrix(coordinates) {
    const url = "https://router.project-osrm.org/table/v1/driving/" +
        coordinates.join(";") + "?annotations=duration,distance";

    const data = await getJson(url);

    if (data.code !== "Ok") {
        throw new Error("Could not calculate routes between these locations.");
    }

    // Unreachable pairs come back as null
    const convert = (matrix, divisor) =>
        matrix.map(row => row.map(x => (x === null ? 1e9 : x / divisor)));

    return {
        time: convert(data.durations, 3600),
        distance: convert(data.distances, 1000)
    };
}


// ==========================================
// C++ PLANNER
// ==========================================

function runPlanner(input) {
    return new Promise((resolve, reject) => {
        const child = execFile(PLANNER, (error, stdout, stderr) => {
            if (error) {
                return reject(new Error(stderr.trim() || "C++ planner failed. Did you run npm run build?"));
            }
            resolve(JSON.parse(stdout));
        });

        child.stdin.end(input);
    });
}


// ==========================================
// PLAN TRIP
// ==========================================

app.post("/api/plan-trip", async (req, res) => {

    const { startLocation, places, finalLocation, availableTime } = req.body;

    // Validation
    if (!startLocation || !finalLocation) {
        return res.status(400).json({ success: false, error: "Starting and final locations are required." });
    }

    if (!(availableTime > 0)) {
        return res.status(400).json({ success: false, error: "Available time must be greater than 0." });
    }

    if (!Array.isArray(places) || places.length < 1 || places.length > 10) {
        return res.status(400).json({ success: false, error: "Enter between 1 and 10 places." });
    }

    for (const [i, place] of places.entries()) {
        if (!place.name || !(place.exploreTime > 0) || !(place.value > 0)) {
            return res.status(400).json({ success: false, error: `Place ${i + 1} has invalid data.` });
        }
    }

    try {
        // 0 = start, 1..n = places, n+1 = final
        const names = [startLocation, ...places.map(p => p.name), finalLocation];
        const start = await geocode(startLocation);
        const others = await Promise.all(names.slice(1).map(name => geocode(name, start)));
        const coordinates = [start, ...others];
        const matrix = await routeMatrix(coordinates);

        // bonus[i] is added to place i's value (used to force a place into the plan)
        const makeInput = (bonus = {}) => [
            `${names.length} ${availableTime}`,
            "0 0",
            ...places.map((p, i) => `${p.exploreTime} ${Math.round(p.value) + (bonus[i + 1] || 0)}`),
            "0 0",
            ...matrix.time.map(row => row.join(" ")),
            ...matrix.distance.map(row => row.join(" "))
        ].join("\n");

        const results = await runPlanner(makeInput());

        // All three algorithms are exact, so Branch and Bound's plan is used as the answer
        const best = results.find(r => r.algorithm === "Branch and Bound");

        if (!best.found) {
            return res.json({
                success: false,
                error: "Not enough time to even travel from the start to the final location."
            });
        }

        const totalTime = best.travelTime + best.exploreTime;
        const order = [0, ...best.route, names.length - 1];

        // Clock for each stop, counted from departure
        let clock = 0;
        const stops = order.map((index, k) => {
            const prev = order[k - 1];
            const leg = k === 0 ? null : {
                time: matrix.time[prev][index],
                distance: matrix.distance[prev][index]
            };

            if (leg) clock += leg.time;
            const arrive = clock;
            const place = places[index - 1];   // undefined for start and final
            const explore = place ? place.exploreTime : 0;
            clock += explore;

            return {
                name: names[index],
                type: k === 0 ? "start" : k === order.length - 1 ? "final" : "place",
                lat: coordinates[index][1],
                lon: coordinates[index][0],
                value: place ? place.value : 0,
                arrive, explore, leg
            };
        });

        // ======================================
        // WHY WAS A PLACE SKIPPED?
        // ======================================

        const t = matrix.time;
        const final = names.length - 1;

        async function explainSkipped(s) {
            const explore = places[s - 1].exploreTime;

            // 1. Start -> s -> final with nothing else
            const aloneTime = t[0][s] + explore + t[s][final];

            if (aloneTime > availableTime) {
                return { reason: "tooFar", aloneTime };
            }

            // 2. Cheapest place to slot it into the chosen route
            let detour = Infinity;
            for (let k = 0; k + 1 < order.length; k++) {
                const a = order[k], b = order[k + 1];
                detour = Math.min(detour, t[a][s] + t[s][b] - t[a][b]);
            }

            // 3. Best plan that must include s: a huge bonus forces it in,
            //    then the bonus is subtracted again
            const BONUS = 1000000;
            const forced = (await runPlanner(makeInput({ [s]: BONUS })))
                .find(r => r.algorithm === "Branch and Bound");

            return {
                reason: "noTime",
                explore,
                detour,
                remaining: availableTime - totalTime,
                bestWith: {
                    value: forced.value - BONUS,
                    time: forced.travelTime + forced.exploreTime,
                    replaces: best.route.filter(i => !forced.route.includes(i)).map(i => names[i])
                }
            };
        }

        const skippedIndexes = places.map((_, i) => i + 1).filter(i => !best.route.includes(i));

        // Cache road geometries for each unique route found by any algorithm
        const geometryCache = {};
        for (const r of results) {
            const key = r.route.join(",");
            if (!geometryCache[key]) {
                const rOrder = [0, ...r.route, names.length - 1];
                geometryCache[key] = await roadGeometry(rOrder.map(i => coordinates[i]));
            }
        }

        function formatBytes(bytes) {
            if (!bytes || bytes === 0) return "0 B";
            if (bytes < 1024) return `${bytes} B`;
            if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
            return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
        }

        const comparison = results.map(r => {
            const algoOrder = [0, ...r.route, names.length - 1];
            let algoClock = 0;
            const algoStops = algoOrder.map((index, k) => {
                const prev = algoOrder[k - 1];
                const leg = k === 0 ? null : {
                    time: matrix.time[prev][index],
                    distance: matrix.distance[prev][index]
                };
                if (leg) algoClock += leg.time;
                const arrive = algoClock;
                const place = places[index - 1];
                const explore = place ? place.exploreTime : 0;
                algoClock += explore;
                return {
                    name: names[index],
                    type: k === 0 ? "start" : k === algoOrder.length - 1 ? "final" : "place",
                    lat: coordinates[index][1],
                    lon: coordinates[index][0],
                    value: place ? place.value : 0,
                    arrive, explore, leg
                };
            });

            return {
                algorithm: r.algorithm,
                found: r.found,
                route: r.route,
                order: algoOrder,
                stops: algoStops,
                value: r.value,
                nodesExplored: r.nodesExplored,
                nodesPruned: r.nodesPruned,
                timeMs: r.timeMs,
                spaceBytes: r.spaceBytes || 0,
                spaceFormatted: formatBytes(r.spaceBytes || 0),
                timeComplexity: r.timeComplexity || (r.algorithm === "Dynamic Programming" ? "O(2ⁿ · n²)" : "O(n!)"),
                spaceComplexity: r.spaceComplexity || (r.algorithm === "Dynamic Programming" ? "O(2ⁿ · n)" : "O(n)"),
                maxDepthOrStates: r.maxDepthOrStates || 0,
                travelTime: r.travelTime,
                explorationTime: r.exploreTime,
                totalTime: r.travelTime + r.exploreTime,
                distance: Number(r.distance.toFixed(1)),
                geometry: geometryCache[r.route.join(",")]
            };
        });

        const skipped = await Promise.all(skippedIndexes.map(async s => ({
            name: names[s],
            value: places[s - 1].value,
            lat: coordinates[s][1],
            lon: coordinates[s][0],
            why: await explainSkipped(s)
        })));

        res.json({
            success: true,
            stops: stops,
            skipped: skipped,
            geometry: geometryCache[best.route.join(",")],
            totalValue: best.value,
            totalDistance: Number(best.distance.toFixed(1)),
            travelTime: best.travelTime,
            explorationTime: best.exploreTime,
            totalTime: totalTime,
            remainingTime: availableTime - totalTime,
            comparison: comparison
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});


// ==========================================
// START SERVER
// ==========================================

app.listen(PORT, () => {
    console.log(`Smart Travel Planner running at http://localhost:${PORT}`);
});
