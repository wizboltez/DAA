#include "planner.h"

#include <algorithm>

// ============================================================
// DYNAMIC PROGRAMMING (bitmask, Held-Karp style)
//
// dp[mask][i] = least time to leave the start, visit exactly the
//               places in mask, and finish exploring place i.
//
// For a fixed set of places the value is fixed, so the best plan
// is the set with the highest value that can still reach the
// final location in time.
// ============================================================

Result dynamicProgramming(const Trip& t)
{
    const double INF = 1e18;

    int k = t.last() - 1;   // tourist places are 1..k, bit i = place i+1
    int full = 1 << k;

    vector<vector<double>> dp(full, vector<double>(k, INF));
    vector<vector<int>> parent(full, vector<int>(k, -1));

    Result r;
    r.algorithm = "Dynamic Programming";

    for (int i = 0; i < k; i++)
    {
        double time = t.travelTime[0][i + 1] + t.places[i + 1].exploreTime;

        if (time <= t.maxTime)
            dp[1 << i][i] = time;
    }

    for (int mask = 1; mask < full; mask++)
    {
        for (int i = 0; i < k; i++)
        {
            if (dp[mask][i] >= INF)
                continue;

            r.nodesExplored++;

            for (int j = 0; j < k; j++)
            {
                if (mask & (1 << j))
                    continue;

                double time = dp[mask][i]
                            + t.travelTime[i + 1][j + 1]
                            + t.places[j + 1].exploreTime;

                int next = mask | (1 << j);

                if (time <= t.maxTime && time < dp[next][j])
                {
                    dp[next][j] = time;
                    parent[next][j] = i;
                }
            }
        }
    }

    // Best end state. Visiting no place at all is also allowed.
    int bestValue = -1, bestMask = 0, bestLast = -1;
    double bestTime = INF;

    if (t.travelTime[0][t.last()] <= t.maxTime)
    {
        bestValue = 0;
        bestTime = t.travelTime[0][t.last()];
    }

    for (int mask = 1; mask < full; mask++)
    {
        int value = 0;

        for (int i = 0; i < k; i++)
            if (mask & (1 << i))
                value += t.places[i + 1].value;

        for (int i = 0; i < k; i++)
        {
            if (dp[mask][i] >= INF)
                continue;

            double total = dp[mask][i] + t.travelTime[i + 1][t.last()];

            if (total <= t.maxTime && better(value, total, bestValue, bestTime))
            {
                bestValue = value;
                bestTime = total;
                bestMask = mask;
                bestLast = i;
            }
        }
    }

    // Rebuild the route from parent links
    for (int mask = bestMask, i = bestLast; i != -1; )
    {
        r.route.push_back(i + 1);
        int prev = parent[mask][i];
        mask ^= 1 << i;
        i = prev;
    }

    reverse(r.route.begin(), r.route.end());

    r.found = bestValue >= 0;
    r.nodesPruned = 0;

    // Space calculation:
    // dp table has (1 << k) rows of k doubles: (1 << k) * k * sizeof(double)
    // parent table has (1 << k) rows of k ints: (1 << k) * k * sizeof(int)
    // vector overhead for (1 << k) rows: 2 * (1 << k) * sizeof(vector)
    long long tableEntries = (long long)full * k;
    long long tableMemory = tableEntries * (sizeof(double) + sizeof(int));
    long long vectorOverhead = (long long)full * (sizeof(vector<double>) + sizeof(vector<int>));
    r.spaceBytes = tableMemory + vectorOverhead + sizeof(dp) + sizeof(parent);
    r.timeComplexity = "O(2ⁿ · n²)";
    r.spaceComplexity = "O(2ⁿ · n)";
    r.maxDepthOrStates = (int)tableEntries;

    evaluate(t, r);
    return r;
}
