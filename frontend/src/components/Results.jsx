import { Car } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { clock, formatMs, formatTime, skipReason } from "@/lib/format";


export function Summary({ result }) {
    const stats = [
        ["Total value", result.totalValue],
        ["Distance", `${Math.round(result.totalDistance)} km`],
        ["Trip time", formatTime(result.totalTime)],
        ["Time left", formatTime(result.remainingTime)]
    ];

    return (
        <Card size="sm">
            <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3">
                {stats.map(([label, value]) => (
                    <div key={label}>
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="text-xl font-semibold tabular-nums">{value}</p>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}


export function Itinerary({ result, activeStop }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Itinerary</CardTitle>
                <CardDescription>
                    {formatTime(result.travelTime)} driving · {formatTime(result.explorationTime)} exploring
                </CardDescription>
            </CardHeader>

            <CardContent>
                <ol>
                    {result.stops.map((s, k) => (
                        <li key={k}>
                            {s.leg && (
                                <div className="flex items-center gap-2 py-1.5 pl-12 text-xs text-muted-foreground">
                                    <Car className="size-3.5" />
                                    {formatTime(s.leg.time)} · {Math.round(s.leg.distance)} km
                                </div>
                            )}

                            <div className={cn(
                                "grid grid-cols-[40px_1fr] gap-2 rounded-md px-1 py-1.5 transition-colors",
                                activeStop === k && "bg-muted"
                            )}>
                                <span className="pt-0.5 text-xs text-muted-foreground tabular-nums">{clock(s.arrive)}</span>
                                <div>
                                    <p className="font-medium">
                                        {s.type === "start" ? "A" : s.type === "final" ? "B" : k}. {s.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {s.type === "start" ? "Departure"
                                            : s.type === "final" ? "Arrival"
                                            : `${formatTime(s.explore)} visit · value ${s.value}`}
                                    </p>
                                </div>
                            </div>
                        </li>
                    ))}
                </ol>
            </CardContent>
        </Card>
    );
}


export function SkippedPlaces({ result }) {
    if (result.skipped.length === 0) return null;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Skipped places</CardTitle>
                <CardDescription>Why the planner left these out.</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
                {result.skipped.map((p) => {
                    const reason = skipReason(p, result);

                    return (
                        <div key={p.name} className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="font-medium">{p.name}</span>
                                <Badge variant="outline">{reason.label}</Badge>
                                <span className="ml-auto text-xs text-muted-foreground">value {p.value}</span>
                            </div>
                            <p className="text-xs leading-relaxed text-muted-foreground">{reason.text}</p>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}


export function AlgorithmComparison({ comparison }) {
    const maxStates = Math.max(...comparison.map(r => r.nodesExplored), 1);
    const fastest = comparison.reduce((a, b) => (b.timeMs < a.timeMs ? b : a));

    return (
        <Card>
            <CardHeader>
                <CardTitle>Algorithm comparison</CardTitle>
                <CardDescription>All three find the same best value; they differ in how much they search.</CardDescription>
            </CardHeader>

            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Algorithm</TableHead>
                            <TableHead className="text-right">States</TableHead>
                            <TableHead className="text-right">Pruned</TableHead>
                            <TableHead className="text-right">Time</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {comparison.map((r) => (
                            <TableRow key={r.algorithm}>
                                <TableCell>
                                    <div className="flex items-center gap-1.5">
                                        {r.algorithm}
                                        {r === fastest && <Badge variant="secondary">fastest</Badge>}
                                    </div>
                                    <div className="mt-1.5 h-1 rounded-full bg-muted">
                                        <div className="h-1 rounded-full bg-foreground/70"
                                            style={{ width: `${(r.nodesExplored / maxStates) * 100}%` }} />
                                    </div>
                                </TableCell>
                                <TableCell className="text-right tabular-nums">{r.nodesExplored.toLocaleString()}</TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {r.algorithm === "Branch and Bound" ? r.nodesPruned.toLocaleString() : "–"}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">{formatMs(r.timeMs)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
