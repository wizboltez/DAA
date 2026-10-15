#include "planner.h"

#include <algorithm>

// ============================================================
// BRANCH AND BOUND
// Same search as backtracking, but each node gets an
// optimistic upper bound. Nodes whose bound cannot beat the
// best value found so far are pruned.
// ============================================================

static const Trip* trip;
static vector<bool> used;
static vector<int> route, bestRoute;
static int bestValue;
static double bestTime;
static long long nodes, pruned;
static int maxDepth;
static vector<int> byRatio;   // places sorted by value per hour, best first

// Fractional knapsack over unvisited places, ignoring travel time.
// Travel time is ignored, so the real value can never be higher.
static double upperBound(double time, int value)
{
    double remaining = trip->maxTime - time;
    double bound = value;

    for (int i : byRatio)
    {
        if (used[i])
            continue;

        const Place& p = trip->places[i];

        if (p.exploreTime <= remaining)
        {
            remaining -= p.exploreTime;
            bound += p.value;
        }
        else
        {
            bound += p.value * remaining / p.exploreTime;
            break;
        }
    }

    return bound;
}

static void explore(int current, double time, int value, int depth)
{
    nodes++;
    if (depth > maxDepth) maxDepth = depth;

    // Pruning
    if (upperBound(time, value) < bestValue)
    {
        pruned++;
        return;
    }

    double total = time + trip->travelTime[current][trip->last()];

    if (total <= trip->maxTime && better(value, total, bestValue, bestTime))
    {
        bestValue = value;
        bestTime = total;
        bestRoute = route;
    }

    // Branching
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

        route.pop_back();
        used[next] = false;
    }
}

Result branchAndBound(const Trip& t)
{
    trip = &t;
    int n = (int)t.places.size();
    used.assign(n, false);
    route.clear();
    bestRoute.clear();
    bestValue = -1;
    bestTime = 1e18;
    nodes = pruned = 0;
    maxDepth = 0;

    byRatio.clear();
    for (int i = 1; i < t.last(); i++)
        byRatio.push_back(i);

    sort(byRatio.begin(), byRatio.end(), [&](int a, int b) {
        return t.places[a].value * t.places[b].exploreTime >
               t.places[b].value * t.places[a].exploreTime;
    });

    explore(0, 0.0, 0, 0);

    Result r;
    r.algorithm = "Branch and Bound";
    r.found = bestValue >= 0;
    r.route = bestRoute;
    r.nodesExplored = nodes;
    r.nodesPruned = pruned;

    // Auxiliary space: stack frames (~80B per depth) + vectors including byRatio
    int k = t.last() - 1;
    long long stackBytes = (maxDepth + 1) * 80;
    long long dataBytes = sizeof(used) + n + 2 * (sizeof(route) + k * sizeof(int))
                        + sizeof(byRatio) + k * sizeof(int);
    r.spaceBytes = stackBytes + dataBytes + 160;
    r.timeComplexity = "O(n!)";
    r.spaceComplexity = "O(n)";
    r.maxDepthOrStates = maxDepth;

    evaluate(t, r);
    return r;
}
