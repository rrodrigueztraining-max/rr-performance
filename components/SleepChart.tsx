"use client";

import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Moon, TrendingUp, TrendingDown, Award } from "lucide-react";

interface SleepChartProps {
    userId: string;
}

export default function SleepChart({ userId }: SleepChartProps) {
    const [data, setData] = useState<any[]>([]);
    const [stats, setStats] = useState({
        average: 0,
        bestDay: "N/A",
        trend: "neutral" as "up" | "down" | "neutral"
    });

    useEffect(() => {
        if (!userId) return;

        const q = query(
            collection(db, "users", userId, "daily_stats"),
            orderBy("date", "desc"),
            limit(7)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const rawData = snapshot.docs.map(doc => {
                const d = doc.data();
                return {
                    date: d.date,
                    day: new Date(d.date).toLocaleDateString("es-ES", { weekday: "short" }).toUpperCase(),
                    hours: d.sleep_hours || 0,
                    fullDate: d.date
                };
            }).reverse();

            // Fill missing days if we want a perfect week (optional, sticking to available data for robustness first)
            // Ideally we'd map to last 7 calendar days, but let's just show available last 7 entries.

            setData(rawData);

            // Calculate Stats
            if (rawData.length > 0) {
                const total = rawData.reduce((acc, curr) => acc + curr.hours, 0);
                const avg = total / rawData.length;

                // Best Day
                const best = rawData.reduce((prev, current) => (prev.hours > current.hours) ? prev : current);

                // Trend (Simple: Compare last 3 days avg vs first 3 days avg of the set)
                let trend: "up" | "down" | "neutral" = "neutral";
                if (rawData.length >= 2) {
                    const recent = rawData.slice(-3); // Last 3 (newest)
                    const old = rawData.slice(0, 3);
                    const avgRecent = recent.reduce((a, b) => a + b.hours, 0) / recent.length;
                    const avgOld = old.reduce((a, b) => a + b.hours, 0) / old.length;
                    if (avgRecent > avgOld + 0.5) trend = "up";
                    else if (avgRecent < avgOld - 0.5) trend = "down";
                }

                setStats({
                    average: parseFloat(avg.toFixed(1)),
                    bestDay: best.day,
                    trend
                });
            }
        });

        return () => unsubscribe();
    }, [userId]);

    return (
        <div className="bg-black/40 backdrop-blur-md border border-gray-800 rounded-xl p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h3 className="text-lg font-bold text-gray-200 flex items-center gap-2">
                        <Moon className="text-indigo-400" /> Análisis de Sueño (7 Días)
                    </h3>
                    {stats.average < 7 && stats.average > 0 && (
                        <p className="text-xs text-red-500 font-bold mt-1 animate-pulse">
                            ⚠️ Atención: Tu recuperación está por debajo del objetivo (8h).
                        </p>
                    )}
                </div>

                {/* Mini Stats Grid */}
                <div className="flex gap-4">
                    <div className="bg-gray-900/50 p-2 rounded-lg border border-gray-800 text-center min-w-[80px]">
                        <p className="text-[10px] text-gray-400 uppercase font-bold">Media</p>
                        <p className={`text-xl font-bold ${stats.average >= 7 ? 'text-green-400' : 'text-orange-400'}`}>
                            {stats.average}h
                        </p>
                    </div>
                    <div className="bg-gray-900/50 p-2 rounded-lg border border-gray-800 text-center min-w-[80px]">
                        <p className="text-[10px] text-gray-400 uppercase font-bold">Mejor Día</p>
                        <p className="text-xl font-bold text-indigo-400 flex items-center justify-center gap-1">
                            <Award className="w-3 h-3" /> {stats.bestDay}
                        </p>
                    </div>
                </div>
            </div>

            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="sleepGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis
                            dataKey="day"
                            stroke="#666"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            dy={10}
                        />
                        <YAxis
                            domain={[0, 12]}
                            ticks={[0, 4, 8, 12]}
                            stroke="#666"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#000', border: '1px solid #333', borderRadius: '8px' }}
                            itemStyle={{ color: '#fff' }}
                            formatter={(value: any) => [`${value}h`, 'Horas'] as [string, string]}
                            labelStyle={{ color: '#9ca3af', marginBottom: '0.25rem' }}
                        />
                        <ReferenceLine y={8} stroke="#10b981" strokeDasharray="3 3" label={{ position: 'right', value: 'Objetivo', fill: '#10b981', fontSize: 10 }} />
                        <Area
                            type="monotone"
                            dataKey="hours"
                            stroke="#818cf8"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#sleepGradient)"
                            activeDot={{ r: 6, strokeWidth: 0, fill: '#fff' }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {data.length === 0 && (
                <div className="text-center text-gray-500 text-sm mt-4 italic">
                    No hay suficientes datos registrados esta semana.
                </div>
            )}
        </div>
    );
}
