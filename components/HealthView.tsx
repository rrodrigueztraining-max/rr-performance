"use client";

import { useState, useEffect } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid, LineChart, Line, AreaChart, Area } from "recharts";
import { Activity, Moon, Scale, Ruler, Plus } from "lucide-react";
import { db, auth } from "@/lib/firebase";
import { collection, query, orderBy, limit, onSnapshot, doc, setDoc, serverTimestamp } from "firebase/firestore";


// Mock Data removed in favor of Firestore Sync

import SleepChart from "./SleepChart";
import InteractiveHealthChart from "./InteractiveHealthChart";

export default function HealthView({ initialTab = 'activity' }: { initialTab?: 'activity' | 'composition' }) {
    const [subTab, setSubTab] = useState<"activity" | "composition">(initialTab);
    const [weightData, setWeightData] = useState<any[]>([]);
    const [metricsHistory, setMetricsHistory] = useState<any[]>([]);
    const [activityData, setActivityData] = useState<any[]>([]);

    // Sleep State
    const [sleepStart, setSleepStart] = useState("");
    const [sleepEnd, setSleepEnd] = useState("");
    const [sleepDuration, setSleepDuration] = useState("0h 0m");

    // Listen to Today's Daily Stats (Single Source of Truth)
    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;

        const today = new Date().toISOString().split('T')[0];
        const unsubscribe = onSnapshot(doc(db, "users", user.uid, "daily_stats", today), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.sleep_start) setSleepStart(data.sleep_start);
                if (data.sleep_end) setSleepEnd(data.sleep_end);
                if (data.sleep_hours !== undefined) {
                    const h = Math.floor(data.sleep_hours);
                    const m = Math.round((data.sleep_hours - h) * 60);
                    setSleepDuration(`${h}h ${m}m`);
                }
            }
        });

        return () => unsubscribe();
    }, []);



    // Effect to respect initialTab changes if component stays mounted but prop changes (though usually it unmounts if tab switches, but let's be safe)
    useEffect(() => {
        setSubTab(initialTab);
    }, [initialTab]);

    // Fetch Health Metrics (Bioimpedance)
    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;

        const q = query(
            collection(db, "users", user.uid, "biometrics"),
            orderBy("date", "asc") // Ascending for Charts
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => {
                const d = doc.data();
                // Handle new date string format (YYYY-MM-DD) or fallback to Timestamp
                let dateDisplay = "N/A";
                let fullDateDisplay = "N/A";

                if (d.date) {
                    const [y, m, da] = d.date.split('-');
                    dateDisplay = `${da}/${m}`;
                    fullDateDisplay = d.date; // already ISOish
                } else if (d.recordedAt?.toDate) {
                    dateDisplay = d.recordedAt.toDate().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
                    fullDateDisplay = d.recordedAt.toDate().toLocaleDateString('es-ES');
                }

                return {
                    id: doc.id,
                    date: dateDisplay, // Short date for chart
                    fullDate: fullDateDisplay, // Long date for table
                    weight: d.weight ?? 0,
                    muscle: d.muscleMass ?? 0,
                    fat: d.fatPercentage ?? 0,
                    waist: d.waist ?? 0,
                    hip: d.hip ?? 0
                };
            });
            setWeightData(data);
            setMetricsHistory([...data].reverse()); // Descending for Table
        });

        return () => unsubscribe();
    }, []);

    // Fetch Daily Logs (Activity) - Last 7 days
    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;

        // Ideally query by date range, for now just limit 7 latest
        const q = query(
            collection(db, "users", user.uid, "daily_logs"),
            orderBy("date", "asc"),
            limit(7)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                name: new Date(doc.id).toLocaleDateString('es-ES', { weekday: 'narrow' }).toUpperCase(),
                steps: doc.data().steps ?? 0,
                sleep: doc.data().sleepHours ?? 0,
                fullDate: doc.id
            }));

            // If data < 7 days, fill with mock/empty or just show what we have. 
            // Recharts handles missing keys fine, but let's just use what we get.
            setActivityData(data);
        });

        return () => unsubscribe();
    }, []);

    // Sleep Calculation & Save
    const handleSleepChange = async (type: 'start' | 'end', value: string) => {
        const newStart = type === 'start' ? value : sleepStart;
        const newEnd = type === 'end' ? value : sleepEnd;

        if (type === 'start') setSleepStart(value);
        if (type === 'end') setSleepEnd(value);

        if (newStart && newEnd) {
            // Calculate duration
            const [startH, startM] = newStart.split(':').map(Number);
            const [endH, endM] = newEnd.split(':').map(Number);

            let start = new Date();
            start.setHours(startH, startM, 0);

            let end = new Date();
            end.setHours(endH, endM, 0);

            // Handle overnight
            if (end < start) {
                end.setDate(end.getDate() + 1);
            }

            const diffMs = end.getTime() - start.getTime();
            const hours = diffMs / (1000 * 60 * 60); // Decimal hours for chart
            const h = Math.floor(hours);
            const m = Math.round((hours - h) * 60);

            setSleepDuration(`${h}h ${m}m`);

            // Persist to Firestore (Today's Daily Stats - UNIFIED SOURCE)
            const user = auth.currentUser;
            if (user && !isNaN(hours)) {
                const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
                const statsRef = doc(db, "users", user.uid, "daily_stats", today);
                await setDoc(statsRef, {
                    date: today,
                    sleep_hours: parseFloat(hours.toFixed(2)),
                    sleep_start: newStart,
                    sleep_end: newEnd,
                    updated_at: serverTimestamp()
                }, { merge: true });
                console.log("Sleep saved to daily_stats:", hours);
            }
        }
    };

    // Steps State
    const [steps, setSteps] = useState(0);
    const [isGoogleLinked, setIsGoogleLinked] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    // ... (Bioimpedance & Daily Logs effects remain)

    // Listen to today's steps from Firestore (if already synced/manual)
    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;
        const today = new Date().toISOString().split('T')[0];
        const unsub = onSnapshot(doc(db, "users", user.uid, "daily_stats", today), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                if (data.steps) setSteps(data.steps);
            }
        });
        return () => unsub();
    }, []);

    const handleGoogleFitConnect = async () => {
        const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

        // Si no hay Client ID, usamos modo manual silenciosamente (sin alertas de error)
        if (!clientId) {
            // Modo Manual: Permitir al usuario ingresar datos directamente
            const realSteps = prompt("Registrar pasos manualmente:", "0");
            if (realSteps && !isNaN(Number(realSteps))) {
                saveSteps(Number(realSteps));
                setIsGoogleLinked(false); // No estamos linkeados realmente
            }
            return;
        }

        /* 
        // Lógica Real (Deshabilitada hasta tener credenciales)
        const tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: 'https://www.googleapis.com/auth/fitness.activity.read',
            callback: async (response) => {
                setIsSyncing(true);
                const steps = await fetchTodaySteps(response.access_token);
                saveSteps(steps);
                setIsGoogleLinked(true);
                setIsSyncing(false);
            },
        });
        tokenClient.requestAccessToken();
        */
    };

    const saveSteps = async (newSteps: number) => {
        const user = auth.currentUser;
        if (!user) return;
        setSteps(newSteps);
        const today = new Date().toISOString().split('T')[0];
        await setDoc(doc(db, "users", user.uid, "daily_stats", today), {
            steps: newSteps,
            updated_at: serverTimestamp()
        }, { merge: true });
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* ... Header ... */}
            {/* Headers are fine, skipping to render ... */}
            <header className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-white">Salud & Progreso</h2>
                    <p className="text-gray-400">Monitorización de biomarcadores y estética.</p>
                </div>

                {/* Custom Sub-tabs */}
                <div className="bg-black/40 p-1 rounded-lg border border-gray-800 flex gap-1">
                    <button
                        onClick={() => setSubTab("activity")}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${subTab === "activity"
                            ? "bg-[#BC0000] text-white shadow-[0_0_10px_rgba(188,0,0,0.3)]"
                            : "text-gray-400 hover:text-white"
                            }`}
                    >
                        <span className="flex items-center gap-2"><Activity className="w-4 h-4" /> Actividad</span>
                    </button>
                    <button
                        onClick={() => setSubTab("composition")}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${subTab === "composition"
                            ? "bg-[#BC0000] text-white shadow-[0_0_10px_rgba(188,0,0,0.3)]"
                            : "text-gray-400 hover:text-white"
                            }`}
                    >
                        <span className="flex items-center gap-2"><Scale className="w-4 h-4" /> Composición</span>
                    </button>
                </div>
            </header>

            {subTab === "activity" && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Steps Card (Today) */}
                        <div className="bg-black/60 backdrop-blur-md border border-gray-800 rounded-xl p-6 hover:border-[#BC0000]/30 transition-all">
                            {/* ... existing Today Steps content ... */}
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-lg font-bold text-gray-200 flex items-center gap-2">
                                    <Activity className="text-[#BC0000]" /> Pasos Hoy
                                </h3>
                                {isGoogleLinked ? (
                                    <span className="text-xs text-green-500 font-bold uppercase animate-pulse flex items-center gap-1">
                                        ● Live (Google Fit)
                                    </span>
                                ) : (
                                    <button
                                        onClick={handleGoogleFitConnect}
                                        className="text-[10px] bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded border border-white/10 transition-colors"
                                    >
                                        Conectar Fuente
                                    </button>
                                )}
                            </div>

                            {!isGoogleLinked && (
                                <div className="mb-4">
                                    <div className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-lg p-1.5 focus-within:border-[#BC0000] transition-colors">
                                        <input
                                            type="number"
                                            placeholder="Añadir pasos..."
                                            className="bg-transparent border-none text-white text-sm w-full outline-none px-2"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    const val = parseInt((e.target as HTMLInputElement).value);
                                                    if (!isNaN(val) && val > 0) {
                                                        const newTotal = steps + val;
                                                        saveSteps(newTotal);
                                                        (e.target as HTMLInputElement).value = '';
                                                    }
                                                }
                                            }}
                                            id="manualStepsInput"
                                        />
                                        <button
                                            onClick={() => {
                                                const input = document.getElementById('manualStepsInput') as HTMLInputElement;
                                                const val = parseInt(input.value);
                                                if (!isNaN(val) && val > 0) {
                                                    const newTotal = steps + val;
                                                    saveSteps(newTotal);
                                                    input.value = '';
                                                }
                                            }}
                                            className="bg-[#BC0000] hover:bg-red-700 text-white p-1.5 rounded-md transition-colors"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-gray-500 mt-1 pl-1">Ingresa pasos manualmente si no usas Google Fit.</p>
                                </div>
                            )}

                            {isGoogleLinked && (
                                <p className="text-sm text-gray-500 mb-6">Sincronizado desde tu dispositivo</p>
                            )}

                            <div className="flex items-end gap-2 mb-2">
                                <span className="text-4xl font-bold text-white">{steps.toLocaleString()}</span>
                                <span className="text-sm text-gray-400 mb-1">/ 10,000 pasos</span>
                            </div>

                            {/* Progress Bar */}
                            <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
                                <div className="bg-[#BC0000] h-full rounded-full transition-all duration-1000" style={{ width: `${Math.min((steps / 10000) * 100, 100)}%` }}></div>
                            </div>
                            <div className="mt-4 flex justify-between text-xs text-gray-500 font-mono">
                                <span>0</span>
                                <span>5k</span>
                                <span>10k</span>
                            </div>
                        </div>

                        {/* Sleep Card (Today) */}
                        <div className="bg-black/60 backdrop-blur-md border border-gray-800 rounded-xl p-6 hover:border-[#BC0000]/30 transition-all">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-bold text-gray-200 flex items-center gap-2">
                                    <Moon className="text-indigo-400" /> Registro Sueño Hoy
                                </h3>
                                <span className="text-2xl font-bold text-white">{sleepDuration}</span>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs text-gray-400 uppercase font-bold">Hora de Dormir</label>
                                    <input
                                        type="time"
                                        value={sleepStart}
                                        onChange={(e) => handleSleepChange('start', e.target.value)}
                                        className="w-full bg-gray-900 border border-gray-800 rounded p-3 text-white focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs text-gray-400 uppercase font-bold">Hora de Despertar</label>
                                    <input
                                        type="time"
                                        value={sleepEnd}
                                        onChange={(e) => handleSleepChange('end', e.target.value)}
                                        className="w-full bg-gray-900 border border-gray-800 rounded p-3 text-white focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* Interactive Charts Area */}
                    <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <InteractiveHealthChart
                            userId={auth.currentUser?.uid || ""}
                            type="steps"
                            color="#BC0000"
                        />
                        <InteractiveHealthChart
                            userId={auth.currentUser?.uid || ""}
                            type="sleep"
                            color="#818cf8"
                        />
                    </div>
                </>
            )}

            {subTab === "composition" && (
                <div className="space-y-6 w-full">
                    {/* Weight & Muscle Chart */}
                    <div className="w-full bg-black/60 backdrop-blur-md border border-gray-800 rounded-xl p-3 md:p-6 overflow-hidden">
                        <h3 className="text-lg font-bold text-gray-200 mb-4 md:mb-6 flex items-center gap-2">
                            <Scale className="text-[#BC0000]" /> Composición Corporal (Peso vs Músculo)
                        </h3>
                        <div className="w-full h-48 md:h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={weightData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                                    <XAxis dataKey="date" stroke="#666" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                                    <YAxis yAxisId="left" domain={['dataMin - 1', 'dataMax + 1']} stroke="#BC0000" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={30} />
                                    <YAxis yAxisId="right" orientation="right" domain={['dataMin - 0.5', 'dataMax + 0.5']} stroke="#FFF" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={30} />
                                    <RechartsTooltip
                                        contentStyle={{ backgroundColor: '#000', border: '1px solid #333', borderRadius: '8px', fontSize: '12px' }}
                                        itemStyle={{ color: '#fff' }}
                                    />
                                    {/* Weight Line (Red) */}
                                    <Line yAxisId="left" type="monotone" dataKey="weight" name="Peso (kg)" stroke="#BC0000" strokeWidth={3} dot={{ r: 3, fill: '#BC0000', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                                    {/* Muscle Line (White) */}
                                    <Line yAxisId="right" type="monotone" dataKey="muscle" name="Masa Musc. (kg)" stroke="#FFFFFF" strokeWidth={2} dot={{ r: 2, fill: '#FFFFFF', strokeWidth: 0 }} activeDot={{ r: 4 }} strokeDasharray="5 5" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Body Fat Chart (Gradient Area) */}
                    <div className="w-full bg-black/60 backdrop-blur-md border border-gray-800 rounded-xl p-3 md:p-6 overflow-hidden">
                        <h3 className="text-lg font-bold text-gray-200 mb-4 md:mb-6 flex items-center gap-2">
                            <Activity className="text-orange-500" /> Porcentaje de Grasa
                        </h3>
                        <div className="w-full h-48 md:h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={weightData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorFat" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#BC0000" stopOpacity={0.6} />
                                            <stop offset="95%" stopColor="#BC0000" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                                    <XAxis dataKey="date" stroke="#666" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                                    <YAxis domain={['dataMin - 1', 'dataMax + 1']} stroke="#666" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={30} />
                                    <RechartsTooltip
                                        contentStyle={{ backgroundColor: '#000', border: '1px solid #333', borderRadius: '8px', fontSize: '12px' }}
                                        itemStyle={{ color: '#fff' }}
                                    />
                                    <Area type="monotone" dataKey="fat" name="% Grasa" stroke="#BC0000" fillOpacity={1} fill="url(#colorFat)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Measurements Table */}
                    <div className="bg-black/60 backdrop-blur-md border border-gray-800 rounded-xl overflow-hidden">
                        <div className="p-4 border-b border-gray-800 flex items-center gap-2">
                            <Ruler className="text-gray-400 w-5 h-5" />
                            <h3 className="font-bold text-white">Histórico de Valoraciones</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left min-w-[500px]">
                                <thead className="bg-white/5 text-gray-400 text-xs uppercase font-bold">
                                    <tr>
                                        <th className="px-2 md:px-6 py-3">Fecha</th>
                                        <th className="px-2 md:px-6 py-3">Peso</th>
                                        <th className="px-2 md:px-6 py-3">% Grasa</th>
                                        <th className="px-2 md:px-6 py-3 hidden md:table-cell">Cintura</th>
                                        <th className="px-2 md:px-6 py-3">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800">
                                    {metricsHistory.length > 0 ? metricsHistory.map((entry, idx) => (
                                        <tr key={idx} className="hover:bg-white/5 transition-colors">
                                            <td className="px-2 md:px-6 py-2 md:py-4 text-white font-mono text-xs md:text-sm">{entry.date}</td>
                                            <td className="px-2 md:px-6 py-2 md:py-4 text-gray-300 text-xs md:text-base">{entry.weight} kg</td>
                                            <td className="px-2 md:px-6 py-2 md:py-4 text-gray-300 text-xs md:text-base">{entry.fat}%</td>
                                            <td className="px-2 md:px-6 py-2 md:py-4 text-gray-300 hidden md:table-cell">{entry.waist} cm</td>
                                            <td className="px-2 md:px-6 py-2 md:py-4">
                                                <button className="text-[#BC0000] hover:text-white text-xs font-bold uppercase transition-colors">Ver Detalles</button>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                                No hay valoraciones registradas aún.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
