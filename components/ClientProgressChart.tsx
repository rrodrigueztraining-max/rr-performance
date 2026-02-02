"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Trophy, TrendingUp, Dumbbell, History } from "lucide-react";

interface ClientProgressChartProps {
    clientId: string;
}

interface ChartDataPoint {
    date: string;
    value: number; // 1RM
    actualWeight: number;
    reps: number;
    fullDate: string; // For sorting/key
}

const normalize = (str: string) => str?.trim().toLowerCase() || "";

export default function ClientProgressChart({ clientId }: ClientProgressChartProps) {
    const [historyData, setHistoryData] = useState<any[]>([]);
    const [availableExercises, setAvailableExercises] = useState<string[]>([]);
    const [selectedExercise, setSelectedExercise] = useState<string>("");

    // Processed Data for Visualization
    const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
    const [stats, setStats] = useState({
        pr: 0,
        improvement: 0,
        totalVolume: 0
    });
    const [recentHistory, setRecentHistory] = useState<any[]>([]);

    // 1. Fetch History Data
    useEffect(() => {
        const fetchHistory = async () => {
            if (!clientId) return;

            try {
                // Fetch completed history items
                // Removed orderBy("completedAt", "asc") to avoid index requirement error
                const q = query(
                    collection(db, "users", clientId, "workout_history"),
                    where("status", "==", "completed")
                );

                const snapshot = await getDocs(q);
                // Manual Sort Client Side (Oldest first)
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
                data.sort((a, b) => {
                    const tA = a.completedAt?.toDate?.()?.getTime() || a.completedAt?.seconds * 1000 || 0;
                    const tB = b.completedAt?.toDate?.()?.getTime() || b.completedAt?.seconds * 1000 || 0;
                    return tA - tB;
                });

                setHistoryData(data);

                // Extract unique exercise names
                const exercisesSet = new Set<string>();
                data.forEach((workout: any) => {
                    workout.exercises?.forEach((ex: any) => {
                        if (ex.name) exercisesSet.add(ex.name);
                    });
                });

                const exercisesList = Array.from(exercisesSet).sort();
                setAvailableExercises(exercisesList);
                if (exercisesList.length > 0) {
                    setSelectedExercise(exercisesList[0]);
                }
            } catch (error) {
                console.error("Error fetching progress history:", error);
            }
        };

        fetchHistory();
    }, [clientId]);

    // 2. Process Data when Selected Exercise Changes
    useEffect(() => {
        if (!selectedExercise || historyData.length === 0) return;

        console.log("Processing Chart Data for:", selectedExercise);
        console.log("Total Workouts Found:", historyData.length);

        const points: ChartDataPoint[] = [];
        let maxWeight = 0;
        let cumulativeVolume = 0;
        let first1RM = 0;

        const targetExercise = normalize(selectedExercise);

        // Iterate through all historical workouts
        historyData.forEach(workout => {
            // Deep extraction & Normalization
            const exData = workout.exercises?.find((e: any) => normalize(e.name) === targetExercise);

            if (!exData) return;

            // Find the "best" set in this session (highest estimated 1RM)
            let best1RM = 0;
            let bestWeight = 0;
            let bestReps = 0;

            // Iterate ALL Series
            exData.series?.forEach((s: any) => {
                // EXPLICIT TYPE CONVERSION
                // Handle different possible key names if data schema usage varied
                const rawWeight = s.actualLoad !== undefined ? s.actualLoad : (s.load !== undefined ? s.load : 0);
                const rawReps = s.actualReps !== undefined ? s.actualReps : (s.reps !== undefined ? s.reps : 0);

                const weight = Number(rawWeight);
                const reps = Number(rawReps);

                if (!isNaN(weight) && !isNaN(reps) && weight > 0 && reps > 0) {
                    const params1RM = weight * (1 + reps / 30);
                    if (params1RM > best1RM) {
                        best1RM = params1RM;
                        bestWeight = weight;
                        bestReps = reps;
                    }
                    cumulativeVolume += (weight * reps);
                }
            });

            if (best1RM > 0) {
                const dateRaw = workout.completedAt?.toDate ? workout.completedAt.toDate() : new Date();
                const dateStr = dateRaw.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });

                points.push({
                    date: dateStr,
                    value: Math.round(best1RM),
                    actualWeight: bestWeight,
                    reps: bestReps,
                    fullDate: dateRaw.toISOString()
                });

                if (bestWeight > maxWeight) maxWeight = bestWeight;
                if (first1RM === 0) first1RM = best1RM;
            }
        });

        console.log("Processed Points:", points);

        setChartData(points);

        // Stats Calculation
        const current1RM = points.length > 0 ? points[points.length - 1].value : 0;
        const improvement = first1RM > 0 ? ((current1RM - first1RM) / first1RM) * 100 : 0;

        setStats({
            pr: maxWeight,
            improvement: Math.round(improvement),
            totalVolume: Math.round(cumulativeVolume)
        });

        // Recent History Table (Reverse order of points, taken from raw chart data for simplicity or raw match)
        const recent = [...points].reverse().slice(0, 5);
        setRecentHistory(recent);

    }, [selectedExercise, historyData]);

    if (availableExercises.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-gray-900/30 rounded-xl border border-dashed border-gray-800">
                <Dumbbell className="w-12 h-12 text-gray-600 mb-4" />
                <h3 className="text-gray-400 font-bold text-lg">Sin datos suficientes</h3>
                <p className="text-gray-600 text-sm">Completa entrenamientos para ver tu progreso.</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header / Selector */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 flex-grow max-w-md">
                    <span className="text-xs text-gray-500 uppercase font-bold block mb-1">Seleccionar Ejercicio</span>
                    <select
                        value={selectedExercise}
                        onChange={(e) => setSelectedExercise(e.target.value)}
                        className="w-full bg-transparent text-white font-bold outline-none cursor-pointer"
                    >
                        {availableExercises.map(ex => (
                            <option key={ex} value={ex}>{ex}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Chart */}
            <div className="bg-black/60 backdrop-blur-md border border-gray-800 rounded-xl p-6 relative overflow-hidden h-[400px]">
                <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest absolute top-6 left-6 z-10 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#BC0000]" /> Evolución 1RM Estimado (kg)
                </h3>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 50, right: 20, bottom: 20, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                        <XAxis
                            dataKey="date"
                            stroke="#666"
                            tick={{ fill: '#666', fontSize: 12 }}
                            tickLine={false}
                            axisLine={false}
                            dy={10}
                        />
                        <YAxis
                            stroke="#666"
                            tick={{ fill: '#666', fontSize: 12 }}
                            tickLine={false}
                            axisLine={false}
                            dx={-10}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#111', borderColor: '#333', borderRadius: '8px', color: '#fff' }}
                            itemStyle={{ color: '#BC0000', fontWeight: 'bold' }}
                            formatter={(value: any) => [`${value} kg`, '1RM Est.']}
                            labelStyle={{ color: '#888', marginBottom: '0.5rem' }}
                        />
                        <Line
                            type="monotone"
                            dataKey="value"
                            stroke="#BC0000"
                            strokeWidth={3}
                            dot={{ fill: '#BC0000', stroke: '#000', strokeWidth: 2, r: 4 }}
                            activeDot={{ r: 6, fill: '#fff' }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* Stats Cards */}
            {chartData.length === 0 ? (
                <div className="text-center p-10 border border-gray-800 rounded-xl bg-gray-900/20">
                    <p className="text-gray-500 font-bold">No hay suficientes datos registrados para "{selectedExercise}" aún.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 flex items-center gap-4 hover:border-[#BC0000]/50 transition-colors">
                        <div className="p-3 bg-[#BC0000]/10 rounded-full text-[#BC0000]">
                            <Trophy className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 uppercase font-bold">Récord Personal (Peso)</div>
                            <div className="text-2xl font-black text-white">{stats.pr} <span className="text-sm font-normal text-gray-500">kg</span></div>
                        </div>
                    </div>

                    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 flex items-center gap-4 hover:border-green-500/50 transition-colors">
                        <div className="p-3 bg-green-900/10 rounded-full text-green-500">
                            <TrendingUp className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 uppercase font-bold">Mejora Total</div>
                            <div className={`text-2xl font-black ${stats.improvement >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {stats.improvement > 0 ? '+' : ''}{stats.improvement}%
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 flex items-center gap-4 hover:border-blue-500/50 transition-colors">
                        <div className="p-3 bg-blue-900/10 rounded-full text-blue-500">
                            <Dumbbell className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 uppercase font-bold">Volumen Histórico</div>
                            <div className="text-2xl font-black text-white">{(stats.totalVolume / 1000).toFixed(1)} <span className="text-sm font-normal text-gray-500">ton</span></div>
                        </div>
                    </div>
                </div>
            )}

            {/* Recent History Table */}
            <div className="bg-black/40 border border-gray-800 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-gray-800 flex items-center gap-2">
                    <History className="w-4 h-4 text-gray-400" />
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">Historial Reciente</h4>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-900/50 text-xs text-gray-500 uppercase">
                            <tr>
                                <th className="px-6 py-3">Fecha</th>
                                <th className="px-6 py-3">Mejor Set Real (Peso x Reps)</th>
                                <th className="px-6 py-3">1RM Estimado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {recentHistory.map((item, idx) => (
                                <tr key={idx} className="hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4 font-medium text-white">{item.date}</td>
                                    <td className="px-6 py-4 text-gray-300 font-mono">
                                        <span className="text-white font-bold">{item.actualWeight}kg</span> x {item.reps}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 bg-[#BC0000]/10 text-[#BC0000] rounded font-bold text-xs border border-[#BC0000]/20">
                                            {item.value} kg
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
