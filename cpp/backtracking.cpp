#include "planner.h"


static const Trip* trip;
static vector<bool> used;
static vector<int> route, bestRoute;
static int bestValue;
static double bestTime;
static long long nodes;
static int maxDepth;

static void explore(int current, double time, int value, int depth)
{
    nodes++;
    if (depth > maxDepth) maxDepth = depth;

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

        explore(next, newTime, value + trip->places[next].value, depth + 1);

        // Backtrack
        route.pop_back();
        used[next] = false;
    }
}

Result backtracking(const Trip& t)
{
    trip = &t;
    int n = (int)t.places.size();
    used.assign(n, false);
    route.clear();
    bestRoute.clear();
    bestValue = -1;
    bestTime = 1e18;
    nodes = 0;
    maxDepth = 0;

    explore(0, 0.0, 0, 0);

    Result r;
    r.algorithm = "Backtracking";
    r.found = bestValue >= 0;
    r.route = bestRoute;
    r.nodesExplored = nodes;
    r.nodesPruned = 0;

    // Auxiliary space: stack frames (~64B per depth) + vectors
    int k = t.last() - 1;
    long long stackBytes = (maxDepth + 1) * 64;
    long long dataBytes = sizeof(used) + n + 2 * (sizeof(route) + k * sizeof(int));
    r.spaceBytes = stackBytes + dataBytes + 128;
    r.timeComplexity = "O(n!)";
    r.spaceComplexity = "O(n)";
    r.maxDepthOrStates = maxDepth;

    evaluate(t, r);
    return r;
}
