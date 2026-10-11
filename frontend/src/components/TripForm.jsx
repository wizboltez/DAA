import { Loader2, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export const MAX_PLACES = 10;

const ROW = "grid grid-cols-[1fr_64px_64px_32px] items-center gap-2";

export default function TripForm({ trip, setTrip, loading, onSubmit }) {

    const update = (field, value) => setTrip({ ...trip, [field]: value });

    const updatePlace = (id, field, value) =>
        update("places", trip.places.map(p => (p.id === id ? { ...p, [field]: value } : p)));

    const addPlace = () =>
        update("places", [...trip.places, { id: crypto.randomUUID(), name: "", hours: "", value: "" }]);

    const removePlace = (id) =>
        update("places", trip.places.filter(p => p.id !== id));

    return (
        <Card>
            <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="contents">

                <CardHeader>
                    <CardTitle>Plan a trip</CardTitle>
                    <CardDescription>
                        Pick places, how long you'd spend at each and how much you want to see it.
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="start">From</Label>
                            <Input id="start" required value={trip.start}
                                onChange={(e) => update("start", e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="final">To</Label>
                            <Input id="final" required value={trip.final}
                                onChange={(e) => update("final", e.target.value)} />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="hours">Available time (hours)</Label>
                        <Input id="hours" inputMode="decimal" pattern="[0-9]*[.]?[0-9]+" title="Hours, e.g. 8 or 7.5" required value={trip.hours}
                            onChange={(e) => update("hours", e.target.value)} />
                    </div>

                    <Separator />

                    <div className="space-y-2">
                        <div className={`${ROW} text-xs text-muted-foreground`}>
                            <span>Place</span>
                            <span>Hours</span>
                            <span>Value</span>
                        </div>

                        {trip.places.map((p) => (
                            <div key={p.id} className={ROW}>
                                <Input aria-label="Place name" required value={p.name}
                                    onChange={(e) => updatePlace(p.id, "name", e.target.value)} />
                                <Input aria-label="Hours to explore" inputMode="decimal" pattern="[0-9]*[.]?[0-9]+" title="Hours, e.g. 2 or 1.5" required value={p.hours}
                                    onChange={(e) => updatePlace(p.id, "hours", e.target.value)} />
                                <Input aria-label="Value" inputMode="numeric" pattern="[0-9]+" title="A whole number, e.g. 50" required value={p.value}
                                    onChange={(e) => updatePlace(p.id, "value", e.target.value)} />
                                <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove place"
                                    disabled={trip.places.length === 1} onClick={() => removePlace(p.id)}>
                                    <X />
                                </Button>
                            </div>
                        ))}

                        {trip.places.length < MAX_PLACES && (
                            <Button type="button" variant="outline" size="sm" onClick={addPlace}>
                                <Plus /> Add place
                            </Button>
                        )}
                    </div>

                </CardContent>

                <CardFooter>
                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading && <Loader2 className="animate-spin" />}
                        {loading ? "Planning…" : "Plan trip"}
                    </Button>
                </CardFooter>

            </form>
        </Card>
    );
}
