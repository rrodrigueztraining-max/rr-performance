"use client";

import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { collection, query, orderBy, onSnapshot, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Moon, Footprints, ChevronLeft, ChevronRight } from "lucide-react";

interface InteractiveHealthChartProps {
    userId: string;
    type: "steps" | "sleep";
    color?: string;
}

export default function InteractiveHealthChart({ userId, type, color = "#BC0000" }: InteractiveHealthChartProps) {
    const [view, setView] = useState<"week" | "month">("week");
    const [referenceDate, setReferenceDate] = useState(new Date());
    const [data, setData] = useState<any[]>([]);
    const [average, setAverage] = useState(0);

    // Helpers for Date Ranges
    const getRange = () => {
        const start = new Date(referenceDate);
        const end = new Date(referenceDate);

        if (view === "week") {
            // Adjust to Monday of the current week
            const day = start.getDay();
            const diff = start.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
            start.setDate(diff);
            end.setDate(diff + 6);
        } else {
            // First and Last day of Month
            start.setDate(1);
            end.setMonth(end.getMonth() + 1);
            end.setDate(0);
        }

        // Reset hours to avoid timezone issues affecting the string
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        // Format YYYY-MM-DD
        const toStr = (d: Date) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        return { startStr: toStr(start), endStr: toStr(end), startDate: start, endDate: end };
    };

    const handleNavigate = (direction: -1 | 1) => {
        const newDate = new Date(referenceDate);
        if (view === "week") {
            newDate.setDate(newDate.getDate() + (direction * 7));
        } else {
            newDate.setMonth(newDate.getMonth() + direction);
        }
        setReferenceDate(newDate);
    };

    useEffect(() => {
        if (!userId) return;

        const { startStr, endStr, startDate, endDate } = getRange();

        // 1. Generate empty days foundation to ensure continuous graph even with missing data
        const rangeData: any[] = [];
        const current = new Date(startDate);
        while (current <= endDate) {
            // Local date string construction
            const year = current.getFullYear();
            const month = String(current.getMonth() + 1).padStart(2, '0');
            const day = String(current.getDate()).padStart(2, '0');
            const localIso = `${year}-${month}-${day}`;

            rangeData.push({
                date: localIso,
                shortDate: current.toLocaleDateString("es-ES", { day: '2-digit', month: '2-digit' }),
                dayName: current.toLocaleDateString("es-ES", { weekday: 'narrow' }).toUpperCase(),
                value: 0,
                formattedValue: type === "steps" ? "0" : "0h"
            });
            current.setDate(current.getDate() + 1);
        }

        const q = query(
            collection(db, "users", userId, "daily_stats"),
            where("date", ">=", startStr),
            where("date", "<=", endStr),
            orderBy("date", "asc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedDocs = snapshot.docs.reduce((acc: any, doc) => {
                acc[doc.data().date] = doc.data();
                return acc;
            }, {});

            // Merge fetched data into range foundation
            const mergedData = rangeData.map(item => {
                const found = fetchedDocs[item.date];
                let val = 0;
                if (found) {
                    val = type === "steps" ? (found.steps || 0) : (found.sleep_hours || 0);
                }
                return {
                    ...item,
                    value: val,
                    formattedValue: type === "steps" ? val.toLocaleString() : `${val.toFixed(1)}h`
                };
            });

            setData(mergedData);

            // Calculate Average (Exclude zeros for more realistic 'active' average? Or include for strict mean?)
            // User request: "promedio que te de sea real en función de lo que estes viendo"
            // Usually, excluding unreported days (zeros) is preferred for "average sleep ON NIGHTS SLEPT",
            // but for "Steps", average per day normally includes lazy days (0 steps).
            // However, 0 usually means "no data" rather than "didn't move".
            // Let's exclude 0s to avoid dropping average due to missing data.

            const validEntries = mergedData.filter(d => d.value > 0);
            if (validEntries.length > 0) {
                const total = validEntries.reduce((acc, curr) => acc + curr.value, 0);
                const avg = total / validEntries.length;
                setAverage(type === 'steps' ? Math.round(avg) : avg);
            } else {
                setAverage(0);
            }
        });

        return () => unsubscribe();
    }, [userId, referenceDate, view, type]);

    const title = type === "steps" ? "Pasos" : "Sueño";
    const icon = type === "steps" ? <Footprints className="w-5 h-5" /> : <Moon className="w-5 h-5" />;

    // Gradient definitions
    const gradientId = `gradient-${type}-${view}`; // Unique ID

    // Header Label logic
    const { startStr } = getRange();
    const getLabel = () => {
        if (view === "month") {
            const d = new Date(startStr);
            // Capitalize first letter
            const s = d.toLocaleDateString("es-ES", { month: 'long', year: 'numeric' });
            return s.charAt(0).toUpperCase() + s.slice(1);
        }
        // Week: "12 Ene - 18 Ene"
        // re-calc end of week for label
        const start = new Date(startStr);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        return `${start.getDate()} ${start.toLocaleDateString("es-ES", { month: 'short' })} - ${end.getDate()} ${end.toLocaleDateString("es-ES", { month: 'short' })}`.toUpperCase();
    };

    return (
        <div className="bg-black/60 backdrop-blur-md border border-gray-800 rounded-xl p-6 transition-all hover:border-gray-700">
            {/* Header Controls */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
                    <div>
                        <h3 className="text-lg font-bold text-gray-200 flex items-center gap-2">
                            <span style={{ color }}>{icon}</span> {title}
                        </h3>
                        <p className="text-gray-400 text-xs mt-1">
                            Media Periodo: <span className="font-bold text-white inline-block ml-1">
                                {type === "steps" ? average.toLocaleString() : `${(average).toFixed(1)}h`}
                            </span>
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => handleNavigate(-1)}
                        className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>

                    <span className="text-sm font-bold text-white min-w-[140px] text-center">
                        {getLabel()}
                    </span>

                    <button
                        onClick={() => handleNavigate(1)}
                        className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                    >
                        <ChevronRight className="w-6 h-6" />
                    </button>

                    <div className="h-6 w-[1px] bg-gray-700 mx-2 hidden md:block"></div>

                    <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-800">
                        {(["week", "month"] as const).map((r) => (
                            <button
                                key={r}
                                onClick={() => { setView(r); setReferenceDate(new Date()); }}
                                className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all ${view === r
                                        ? "bg-white text-black"
                                        : "text-gray-400 hover:text-white"
                                    }`}
                            >
                                {r === "week" ? "Semana" : "Mes"}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                                <stop offset="95%" stopColor={color} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis
                            dataKey={view === 'week' ? "dayName" : "shortDate"}
                            stroke="#666"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            dy={10}
                            interval={view === 'week' ? 0 : 4}
                        />
                        <YAxis
                            stroke="#666"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(val) => type === 'steps' ? `${(val / 1000).toFixed(0)}k` : `${val}h`}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#000', border: '1px solid #333', borderRadius: '8px' }}
                            itemStyle={{ color: '#fff' }}
                            formatter={(value: any) => [type === "steps" ? value.toLocaleString() : `${value}h`, title]}
                            labelStyle={{ color: '#9ca3af', marginBottom: '0.25rem' }}
                        />
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke={color}
                            strokeWidth={3}
                            fillOpacity={1}
                            fill={`url(#${gradientId})`}
                            activeDot={{ r: 6, strokeWidth: 0, fill: '#fff' }}
                            animationDuration={500}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {data.every(d => d.value === 0) && (
                <div className="text-center text-gray-500 text-xs mt-4 italic">
                    Sin datos en este periodo.
                </div>
            )}
        </div>
    );
}
