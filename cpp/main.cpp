#include "planner.h"

#include <chrono>
#include <cstdio>
#include <iostream>

// ============================================================
// INPUT (stdin)
//
//   n availableTime            n = total locations (start + places + final)
//   exploreTime value          n lines, one per location
//   travel time matrix         n x n, hours
//   distance matrix            n x n, km
//
// OUTPUT (stdout): JSON with the result of all three algorithms
// ============================================================

// Small inputs finish faster than the clock can measure,
// so repeat for at least 20 ms and report the average.
static Result timed(Result (*algorithm)(const Trip&), const Trip& trip)
{
    auto start = chrono::steady_clock::now();
    chrono::duration<double, milli> elapsed(0);
    Result r;
    int runs = 0;

    do
    {
        r = algorithm(trip);
        runs++;
        elapsed = chrono::steady_clock::now() - start;
    } while (elapsed.count() < 20);

    r.timeMs = elapsed.count() / runs;
    return r;
}

static void printJson(const Result& r, bool comma)
{
    printf("  {\"algorithm\": \"%s\", \"found\": %s, \"route\": [",
           r.algorithm.c_str(), r.found ? "true" : "false");

    for (size_t i = 0; i < r.route.size(); i++)
        printf("%s%d", i ? ", " : "", r.route[i]);

    printf("], \"value\": %d, \"travelTime\": %.4f, \"exploreTime\": %.4f, "
           "\"distance\": %.2f, \"nodesExplored\": %.0f, \"nodesPruned\": %.0f, "
           "\"timeMs\": %.4f}%s\n",
           r.value, r.travelTime, r.exploreTime, r.distance,
           (double)r.nodesExplored, (double)r.nodesPruned, r.timeMs, comma ? "," : "");
}

int main()
{
    int n;
    Trip trip;

    if (!(cin >> n >> trip.maxTime) || n < 2 || n > 17)
    {
        cerr << "Expected 2 to 17 locations (at most 15 tourist places).\n";
        return 1;
    }

    trip.places.resize(n);
    trip.travelTime.assign(n, vector<double>(n));
    trip.distance.assign(n, vector<double>(n));

    for (auto& p : trip.places)
        cin >> p.exploreTime >> p.value;

    for (auto& row : trip.travelTime)
        for (double& x : row)
            cin >> x;

    for (auto& row : trip.distance)
        for (double& x : row)
            cin >> x;

    if (!cin)
    {
        cerr << "Incomplete input.\n";
        return 1;
    }

    for (int i = 1; i < trip.last(); i++)
    {
        if (trip.places[i].exploreTime <= 0 || trip.places[i].value <= 0)
        {
            cerr << "Exploration time and value must be positive.\n";
            return 1;
        }
    }

    printf("[\n");
    printJson(timed(backtracking, trip), true);
    printJson(timed(branchAndBound, trip), true);
    printJson(timed(dynamicProgramming, trip), false);
    printf("]\n");

    return 0;
}
