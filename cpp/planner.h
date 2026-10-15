#ifndef PLANNER_H
#define PLANNER_H

#include <string>
#include <vector>

using namespace std;

// Location indexing:
//   0          = starting location
//   1 .. n-2   = tourist places
//   n-1        = final location

struct Place
{
    double exploreTime;   // hours
    int value;
};

struct Trip
{
    vector<Place> places;
    vector<vector<double>> travelTime;   // hours
    vector<vector<double>> distance;     // km
    double maxTime;                      // hours

    int last() const { return (int)places.size() - 1; }
};

struct Result
{
    string algorithm;
    bool found = false;
    vector<int> route;                   // tourist places in visiting order
    int value = 0;
    double travelTime = 0, exploreTime = 0, distance = 0;
    long long nodesExplored = 0, nodesPruned = 0;
    double timeMs = 0;
    long long spaceBytes = 0;
    string timeComplexity;
    string spaceComplexity;
    int maxDepthOrStates = 0;
};

Result backtracking(const Trip& trip);
Result branchAndBound(const Trip& trip);
Result dynamicProgramming(const Trip& trip);


// Fills value, times and distance for start -> route -> final
inline void evaluate(const Trip& t, Result& r)
{
    int prev = 0;

    r.value = 0;
    r.travelTime = r.exploreTime = r.distance = 0;

    for (int p : r.route)
    {
        r.travelTime += t.travelTime[prev][p];
        r.distance += t.distance[prev][p];
        r.exploreTime += t.places[p].exploreTime;
        r.value += t.places[p].value;
        prev = p;
    }

    r.travelTime += t.travelTime[prev][t.last()];
    r.distance += t.distance[prev][t.last()];
}

// Higher value wins; equal value -> less total time wins
inline bool better(int value, double time, int bestValue, double bestTime)
{
    return value > bestValue ||
           (value == bestValue && time < bestTime - 1e-9);
}

#endif
