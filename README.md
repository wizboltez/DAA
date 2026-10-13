# 🌍 Smart Travel Planner — Maximum Places in Limited Time

A Design and Analysis of Algorithms (DAA) project that picks the most valuable set of tourist places you can visit between a start and a final location, within your available time, using real road distances, and shows the trip on a live **OpenStreetMap** map with a car driving along the route.

The same problem is solved with three algorithms, and the results are compared side by side:

1. **Backtracking**
2. **Branch and Bound**
3. **Dynamic Programming**

---

## 🎯 Problem Statement

You are given:

* a **starting location** and a **final location**
* a list of **tourist places**, each with an **exploration time** (hours) and an **importance value**
* the **available time** for the whole trip

Find the places to visit, and the order to visit them in, so that:

* **total value is maximum**, and
* travel time + exploration time (including the trip to the final location) **≤ available time**.

If two plans have the same value, the one with less total time wins.

This is the **Orienteering Problem**: a mix of the 0/1 Knapsack problem (which places to pick) and the Travelling Salesman Problem (in what order). It is NP-hard, so every exact algorithm is exponential in the worst case.

---

## 🧠 Algorithms Used

`n` = number of tourist places.

### 1. Backtracking — [`cpp/backtracking.cpp`](cpp/backtracking.cpp)

Builds the route one place at a time with depth-first search. After each step it records the plan if the final location can still be reached in time. A branch is abandoned only when adding a place breaks the time limit.

* Time: **O(n!)** in the worst case (every order of every subset)
* Space: **O(n)** recursion depth

### 2. Branch and Bound — [`cpp/branchAndBound.cpp`](cpp/branchAndBound.cpp)

Same search as Backtracking, plus an **upper bound** at every node:

> bound = current value + **fractional knapsack** over the unvisited places with the time left, ignoring travel time

Ignoring travel time and allowing fractions can only overestimate, so the bound is never lower than the real best. A node whose bound is below the best value found so far is **pruned**. The places are sorted by value per hour once, so each bound costs O(n).

* Time: **O(n!)** worst case, usually far fewer nodes than Backtracking
* Space: **O(n)**

### 3. Dynamic Programming — [`cpp/dynamicProgramming.cpp`](cpp/dynamicProgramming.cpp)

Bitmask DP (Held-Karp style):

> `dp[mask][i]` = least time to leave the start, visit exactly the places in `mask`, and finish exploring place `i`
>
> `dp[mask | j][j] = min(dp[mask][i] + travel(i, j) + explore(j))`

For a fixed set of places the value is fixed, so the answer is the set with the highest value whose `dp[mask][i] + travel(i, final)` fits in the available time. The route is rebuilt from parent links.

* Time: **O(2ⁿ · n²)**
* Space: **O(2ⁿ · n)**

### Comparison (random 10-place trip)

| Algorithm | Best Value | States Explored | Pruned | Time |
| --- | --- | --- | --- | --- |
| Backtracking | 49 | 579,819 | – | 74.5 ms |
| Branch and Bound | 49 | 266,839 | 176,854 | 32.8 ms |
| Dynamic Programming | 49 | 4,918 | – | 1.8 ms |

All three always return the same optimal value. They differ only in how much work they do.

---

## ⚙️ How It Works

```text
Browser (React app)
   │  start, places, final, available time
   ▼
Node.js backend (backend/server.js)
   │  1. Photon geocoder → coordinates of every location
   │  2. OSRM table API  → driving time (h) and distance (km) between every pair
   ▼
C++ planner (cpp/planner)
   │  runs Backtracking, Branch and Bound, Dynamic Programming
   ▼
JSON → best route + algorithm comparison
   ▼
Node.js  3. OSRM route API → road geometry of the chosen route
   ▼
Browser  Leaflet map: numbered stops, skipped places, animated car,
         timed itinerary and algorithm comparison bars
```

The map data comes from free OpenStreetMap services ([Photon](https://photon.komoot.io) and the [OSRM](https://project-osrm.org) demo server), and the map uses OpenStreetMap tiles through [Leaflet](https://leafletjs.com), so **no API key is needed**. You need an internet connection.

### Frontend features

* Add or remove places directly in the sidebar (an example Mumbai → Goa trip is preloaded)
* Map with start (A), numbered stops, final (B) and greyed-out skipped places
* A car drives the real road route, pausing at each stop while the itinerary highlights it. Use **Replay** to watch again
* Itinerary with the time since departure at each stop, plus driving time and distance for every leg
* **Why was it skipped?** Every skipped place gets a reason (also shown on its grey map pin):
  * **Too far.** Start → place → final alone takes longer than the available time
  * **No time left.** The cheapest way to fit it into the route (visit + detour) needs more time than is left. The planner is re-run with that place forced in (by giving it a huge bonus value), showing the best value possible *with* it and which places it would push out
* Bar charts comparing states explored and running time of the three algorithms

---

## 🛠️ Technology Used

* **Algorithms:** C++11
* **Backend:** Node.js + Express
* **Frontend:** React, Vite, Tailwind CSS, [shadcn/ui](https://ui.shadcn.com), lucide icons, Leaflet
* **Map data:** OpenStreetMap (tiles, Photon, OSRM)
* **Version Control:** GitHub

---

## 📁 Project Structure

```text
DAA/
├── frontend/                  React app (Vite + Tailwind + shadcn/ui)
│   ├── index.html
│   └── src/
│       ├── App.jsx            Layout, state, calls the backend
│       ├── components/
│       │   ├── TripForm.jsx   From / to / time and the list of places
│       │   ├── TripMap.jsx    Leaflet map, route and car animation
│       │   ├── Results.jsx    Summary, itinerary, skipped places, algorithm table
│       │   └── ui/            shadcn components (button, card, input, table, …)
│       ├── lib/format.js      Time formatting and skip-reason text
│       └── index.css          Tailwind + shadcn theme + map styles
├── backend/server.js          Express server: geocoding, route matrix, road geometry, runs C++
├── cpp/
│   ├── planner.h              Shared data types and helpers
│   ├── backtracking.cpp
│   ├── branchAndBound.cpp
│   ├── dynamicProgramming.cpp
│   └── main.cpp               Reads trip from stdin, prints JSON for all 3 algorithms
├── data/sample.txt            Sample input for the C++ program
├── vite.config.js             Builds frontend/ into dist/
├── components.json            shadcn config
└── package.json               npm scripts: build, start, dev
```

---

## 🚀 How to Run

Requirements: **g++** (C++11 or newer) and **Node.js 20+**.

```bash
npm install        # install dependencies
npm run build      # compile the C++ planner and build the React app into dist/
npm start          # start the server
```

Open **http://localhost:3000**, edit the trip (or keep the example) and click **Plan trip**.

While working on the frontend, run `npm start` in one terminal and `npm run dev` in another. Vite serves the app with hot reload and forwards `/api` to the backend.

### Run the C++ program on its own

```bash
cpp/planner < data/sample.txt
```

Input format:

```text
n availableTime          n = start + tourist places + final
exploreTime value        n lines (start and final use 0 0)
travel time matrix       n × n, hours
distance matrix          n × n, km
```

`data/sample.txt` is the trip Mumbai → Lonavala, Pune, Mahabaleshwar → Goa in 16 hours.

---

## 📡 API

`POST /api/plan-trip`

```json
{
  "startLocation": "Mumbai",
  "places": [
    { "name": "Lonavala", "exploreTime": 2, "value": 40 },
    { "name": "Pune", "exploreTime": 3, "value": 60 }
  ],
  "finalLocation": "Goa",
  "availableTime": 16
}
```

Response: `stops` (in visiting order, with coordinates, arrival time and the leg before each), `skipped` (each with a `why` object explaining the reason), `geometry` (road points for the map), `totalValue`, `totalDistance` (km), `travelTime`, `explorationTime`, `totalTime`, `remainingTime` (hours) and `comparison` (value, states explored, pruned and time for each algorithm).

---

## 📚 Academic Purpose

This project is developed as part of a **Design and Analysis of Algorithms (DAA)** course to demonstrate how Backtracking, Branch and Bound and Dynamic Programming solve the same optimization problem, and how their efficiency differs.

## TEAM MEMBERS
- SAKSHI KAURWAR 
- POOJA YADAV
- EKTA BANDAL
- ANUSHKA PARKHI
