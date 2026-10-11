import { useState } from "react";
import { AlertCircle, Loader2, RotateCcw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import TripForm from "@/components/TripForm";
import TripMap from "@/components/TripMap";
import { AlgorithmComparison, Itinerary, SkippedPlaces, Summary } from "@/components/Results";

// Example trip so the planner works straight away
const EXAMPLE = {
    start: "Mumbai",
    final: "Goa",
    hours: "20",
    places: [
        ["Lonavala", 2, 40],
        ["Pune", 3, 60],
        ["Mahabaleshwar", 4, 80],
        ["Kolhapur", 2, 50],
        ["Ratnagiri", 3, 45]
    ].map(([name, hours, value]) => ({ id: crypto.randomUUID(), name, hours, value }))
};

export default function App() {
    const [trip, setTrip] = useState(EXAMPLE);
    const [result, setResult] = useState(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [activeStop, setActiveStop] = useState(-1);
    const [replayKey, setReplayKey] = useState(0);

    async function planTrip() {
        setLoading(true);
        setError("");

        try {
            const response = await fetch("/api/plan-trip", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    startLocation: trip.start.trim(),
                    finalLocation: trip.final.trim(),
                    availableTime: parseFloat(trip.hours),
                    places: trip.places.map(p => ({
                        name: p.name.trim(),
                        exploreTime: parseFloat(p.hours),
                        value: parseInt(p.value)
                    }))
                })
            });

            const data = await response.json();

            if (!data.success) {
                setError(data.error);
                return;
            }

            setActiveStop(-1);
            setResult(data);

        } catch {
            setError("Could not reach the backend. Start it with npm start.");

        } finally {
            setLoading(false);
        }
    }

    function replay() {
        setActiveStop(-1);
        setReplayKey(k => k + 1);
    }

    return (
        <div className="grid min-h-screen md:h-screen md:grid-cols-[420px_1fr]">

            <aside className="flex flex-col border-r bg-muted/30 md:overflow-y-auto">

                <header className="border-b bg-background px-5 py-4">
                    <h1 className="font-semibold">Smart Travel Planner</h1>
                    <p className="text-xs text-muted-foreground">
                        Backtracking · Branch and Bound · Dynamic Programming
                    </p>
                </header>

                <div className="space-y-4 p-4">
                    <TripForm trip={trip} setTrip={setTrip} loading={loading} onSubmit={planTrip} />

                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle />
                            <AlertTitle>Couldn't plan this trip</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {result && (
                        <>
                            <Summary result={result} />
                            <Itinerary result={result} activeStop={activeStop} />
                            <SkippedPlaces result={result} />
                            <AlgorithmComparison comparison={result.comparison} />
                        </>
                    )}
                </div>

                <footer className="mt-auto px-5 py-4 text-xs text-muted-foreground">
                    Map data © OpenStreetMap contributors
                </footer>
            </aside>

            <main className="relative order-first h-[55vh] md:order-none md:h-auto">
                <TripMap result={result} replayKey={replayKey} onStop={setActiveStop} />

                {loading && (
                    <div className="absolute inset-0 z-[1000] grid place-items-center bg-background/60 backdrop-blur-[1px]">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="size-4 animate-spin" /> Finding the best route…
                        </div>
                    </div>
                )}

                {result && (
                    <Button variant="outline" onClick={replay}
                        className="absolute bottom-6 left-1/2 z-[1000] -translate-x-1/2 shadow-sm">
                        <RotateCcw /> Replay
                    </Button>
                )}
            </main>

        </div>
    );
}
