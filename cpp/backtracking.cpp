#include "planner.h"

// ============================================================
// BACKTRACKING
// Tries every visiting order of every subset of places.
// A branch is abandoned only when it breaks the time limit.
// ============================================================

static const Trip* trip;
static vector<bool> used;
static vector<int> route, bestRoute;
static int bestValue;
static double bestTime;
static long long nodes;

static void explore(int current, double time, int value)
{
    nodes++;

    // Can we stop here and still reach the final location?
    double total = time + trip->travelTime[current][trip->last()];

    if (total <= trip->maxTime && better(value, total, bestValue, bestTime))
    {
        bestValue = value;
        bestTime = total;
        bestRoute = route;
    }

    for (int next = 1; next < trip->last(); next++)
    {
        if (used[next])
            continue;

        double newTime = time
                       + trip->travelTime[current][next]
                       + trip->places[next].exploreTime;

        if (newTime > trip->maxTime)
            continue;

        used[next] = true;
        route.push_back(next);

        explore(next, newTime, value + trip->places[next].value);

        // Backtrack
        route.pop_back();
        used[next] = false;
    }
}

Result backtracking(const Trip& t)
{
    trip = &t;
    used.assign(t.places.size(), false);
    route.clear();
    bestRoute.clear();
    bestValue = -1;
    bestTime = 1e18;
    nodes = 0;

    explore(0, 0.0, 0);

    Result r;
    r.algorithm = "Backtracking";
    r.found = bestValue >= 0;
    r.route = bestRoute;
    r.nodesExplored = nodes;
    evaluate(t, r);
    return r;
}
