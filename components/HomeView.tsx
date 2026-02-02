"use client";

import { useState, useEffect } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area } from "recharts";
import { Activity, Moon, Scale, LogOut } from "lucide-react";
import { db, auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { doc, onSnapshot, collection, query, orderBy, limit } from "firebase/firestore";
import PendingFormsAlert from "./forms/PendingFormsAlert";

interface HomeViewProps {
    userName: string;
    onStartWorkout: () => void;
    onNavigate: (tab: string, subTab?: string) => void;
    nextSession?: {
        workoutId: string;
        workoutTitle: string;
        blockTitle: string;
        description: string;
    } | null;
}

export default function HomeView({ userName, onStartWorkout, onNavigate, nextSession }: HomeViewProps) {
    const { logout } = useAuth();
    const [greeting, setGreeting] = useState("Bienvenido");
    const [stepGoal, setStepGoal] = useState(10000);
    const [coachNote, setCoachNote] = useState("");
    const [weeklySteps, setWeeklySteps] = useState<{ day: string; value: number }[]>([]);
    const [weeklySleep, setWeeklySleep] = useState<{ day: string; value: number }[]>([]);
    const [stats, setStats] = useState({
        steps: 0,
        sleep: "0h 0m",
        weight: "0",
        lastActive: "Hoy"
    });
    const [latestBio, setLatestBio] = useState<any>(null);

    useEffect(() => {
        const hour = new Date().getHours();
        if (hour < 12) setGreeting("Buenos días");
        else if (hour < 20) setGreeting("Buenas tardes");
        else setGreeting("Buenas noches");
    }, []);

    // 0. Fetch Latest Biometrics
    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;

        const q = query(
            collection(db, "users", user.uid, "biometrics"),
            orderBy("date", "desc"),
            limit(1)
        );

        const unsub = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const data = snapshot.docs[0].data();
                setLatestBio(data);
            }
        });

        return () => unsub();
    }, []);

    useEffect(() => {
        const user = auth.currentUser;
        if (!user || !db) return;

        // 1. Fetch User Goal
        const userUnsub = onSnapshot(doc(db, "users", user.uid), (docVal) => {
            if (docVal && docVal.exists()) {
                const d = docVal.data();
                if (d.daily_step_goal) setStepGoal(d.daily_step_goal);
                if (d.coachNote) setCoachNote(d.coachNote);
            }
        });

        // 2. Single Source of Truth: daily_stats (Today)
        const today = new Date().toISOString().split('T')[0];
        const statsUnsub = onSnapshot(doc(db, "users", user.uid, "daily_stats", today), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const hours = data.sleep_hours ?? 0; // Assuming this is stored as e.g. 7.5
                const h = Math.floor(hours);
                const m = Math.round((hours - h) * 60);

                setStats({
                    steps: data.steps ?? 0,
                    sleep: hours > 0 ? `${h}h ${m}m` : "0h 0m",
                    weight: data.weight ?? "0",
                    lastActive: "Hoy"
                });
            } else {
                setStats({ steps: 0, sleep: "0h 0m", weight: "0", lastActive: "Hoy" });
            }
        });

        // 3. Fetch Last 7 Days for Charts
        const q = query(collection(db, "users", user.uid, "daily_stats"), orderBy("date", "desc"), limit(7));

        const chartUnsub = onSnapshot(q, (snapshot) => {
            const rawSteps = snapshot.docs.map((doc) => {
                const d = doc.data();
                return {
                    day: new Date(d.date).toLocaleDateString("es-ES", { weekday: "narrow" }).toUpperCase(),
                    value: d.steps || 0
                };
            }).reverse();

            const rawSleep = snapshot.docs.map((doc) => {
                const d = doc.data();
                return {
                    day: new Date(d.date).toLocaleDateString("es-ES", { weekday: "narrow" }).toUpperCase(),
                    value: d.sleep_hours || 0
                };
            }).reverse();

            if (rawSteps.length > 0) setWeeklySteps(rawSteps);
            if (rawSleep.length > 0) setWeeklySleep(rawSleep);
        });

        return () => { userUnsub(); statsUnsub(); chartUnsub(); };
    }, []);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <style>
                {`
                    .recharts-cartesian-grid-horizontal line, .recharts-cartesian-grid-vertical line {
                        stroke: #333;
                    }
                `}
            </style>
            {/* 1. Header & Greeting */}
            <div className="flex justify-between items-start md:items-end">
                <div>
                    <h2 className="text-gray-400 text-sm font-medium uppercase tracking-widest mb-1">Centro de Mando</h2>
                    <h1 className="text-3xl md:text-4xl font-bold text-white">
                        {greeting}, <span className="text-[#BC0000]">{userName.split(" ")[0]}</span>
                    </h1>
                </div>
                <div className="flex items-center gap-4">
                    <div className="hidden sm:block text-right">
                        <p className="text-2xl font-bold text-white">{new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' })}</p>
                    </div>
                    <button
                        onClick={() => logout()}
                        className="flex items-center gap-2 px-3 py-2 bg-gray-900/80 hover:bg-[#BC0000] rounded-xl text-gray-400 hover:text-white transition-all border border-gray-800 hover:border-[#BC0000] shadow-lg group"
                        aria-label="Cerrar Sesión"
                    >
                        <span className="text-xs font-bold uppercase tracking-wider">Salir</span>
                        <LogOut className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    </button>
                </div>
            </div>

            {/* Coach Note Alert */}
            {coachNote && (
                <div className="bg-gradient-to-r from-gray-900 to-black border-l-4 border-[#BC0000] rounded-r-xl p-6 shadow-lg animate-in slide-in-from-top-4 duration-500 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-[#BC0000]/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-[#BC0000]/10 transition-all"></div>
                    <div className="flex items-start gap-4 relative z-10">
                        <div className="p-3 bg-[#BC0000]/10 rounded-full text-[#BC0000]">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-message-square-quote"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><path d="M8 12a2 2 0 0 0 2-2V8" /><path d="M14 12a2 2 0 0 0 2-2V8" /></svg>
                        </div>
                        <div>
                            <h3 className="text-white font-bold text-lg mb-1 flex items-center gap-2">
                                Nota del Coach
                                <span className="text-[10px] bg-[#BC0000] text-white px-2 py-0.5 rounded-full uppercase tracking-wider">Nuevo</span>
                            </h3>
                            <p className="text-gray-300 italic text-sm leading-relaxed">
                                "{coachNote}"
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Pending Forms Alert */}
            <PendingFormsAlert clientId={auth.currentUser?.uid || ""} />

            {/* 2. Hero Widget: Today's Goal */}
            <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 to-black border border-gray-800 shadow-2xl group ${!nextSession ? 'opacity-80' : ''}`}>
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#BC0000]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-[#BC0000]/20 transition-all duration-700"></div>

                <div className="relative p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="space-y-4 text-center md:text-left">
                        <div className="inline-block px-3 py-1 bg-[#BC0000]/20 border border-[#BC0000]/50 rounded-full text-[#BC0000] text-xs font-bold uppercase tracking-wide">
                            {nextSession ? "Siguiente Sesión" : "Estado Actual"}
                        </div>
                        <h3 className="text-3xl font-black text-white italic uppercase transform -skew-x-6">
                            {nextSession ? nextSession.blockTitle : "TODO COMPLETADO"}
                        </h3>
                        {nextSession && (
                            <div className="text-sm text-[#BC0000] font-bold uppercase tracking-widest -mt-2 mb-2">
                                {nextSession.workoutTitle}
                            </div>
                        )}
                        <p className="text-gray-400 max-w-md">
                            {nextSession ? nextSession.description : "No tienes entrenamientos pendientes por ahora. ¡Disfruta del descanso!"}
                        </p>
                    </div>

                    <button
                        onClick={onStartWorkout}
                        className={`px-8 py-4 ${nextSession ? 'bg-[#BC0000] hover:shadow-[0_0_40px_rgba(188,0,0,0.6)] hover:scale-105' : 'bg-gray-800 hover:bg-gray-700'} text-white font-bold rounded-xl shadow-[0_0_20px_rgba(188,0,0,0.4)] transition-all duration-300 uppercase tracking-wider flex items-center gap-2`}
                    >
                        <Activity className="w-5 h-5" />
                        {nextSession ? "Empezar Entreno" : "Ver Plan"}
                    </button>
                </div>
            </div>

            {/* 3. Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Steps Widget */}
                <div
                    onClick={() => onNavigate("health")}
                    className="bg-black/40 backdrop-blur-md border border-gray-800 rounded-xl p-5 hover:border-[#BC0000] transition-all cursor-pointer group flex flex-col justify-between"
                >
                    <div>
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-gray-900 rounded-lg text-[#BC0000] group-hover:bg-[#BC0000] group-hover:text-white transition-colors">
                                <Activity className="w-5 h-5" />
                            </div>
                            {/* Placeholder for diff */}
                            <span className="text-xs font-bold text-gray-500 bg-gray-800 px-2 py-1 rounded">Hoy</span>
                        </div>
                        <div className="mb-4">
                            <h4 className="text-gray-400 text-xs uppercase font-bold">Pasos Diarios</h4>
                            <p className="text-2xl font-bold text-white">{stats.steps.toLocaleString()} <span className="text-sm text-gray-500 font-normal">/ {(stepGoal / 1000).toFixed(1)}k</span></p>
                        </div>
                    </div>

                    {/* Live Chart: Steps */}
                    <div className="h-24 w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={weeklySteps.length ? weeklySteps : [{ day: '', value: 0 }]}>
                                <defs>
                                    <linearGradient id="colorSteps" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#BC0000" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#BC0000" stopOpacity={0.3} />
                                    </linearGradient>
                                </defs>
                                <Bar dataKey="value" fill="url(#colorSteps)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Sleep Widget */}
                <div
                    onClick={() => onNavigate("health")}
                    className="bg-black/40 backdrop-blur-md border border-gray-800 rounded-xl p-5 hover:border-[#BC0000] transition-all cursor-pointer group flex flex-col justify-between"
                >
                    <div>
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-gray-900 rounded-lg text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                <Moon className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-bold text-gray-500 bg-gray-800 px-2 py-1 rounded">Hoy</span>
                        </div>
                        <div className="mb-4">
                            <h4 className="text-gray-400 text-xs uppercase font-bold">Sueño</h4>
                            <p className="text-2xl font-bold text-white">{stats.sleep} <span className="text-sm text-gray-500 font-normal">/ 8h</span></p>
                        </div>
                    </div>

                    {/* Live Chart: Sleep */}
                    <div className="h-24 w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={weeklySleep.length ? weeklySleep : [{ day: '', value: 0 }]}>
                                <defs>
                                    <linearGradient id="colorSleep" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.1} />
                                    </linearGradient>
                                </defs>
                                <Area type="monotone" dataKey="value" stroke="#6366f1" fillOpacity={1} fill="url(#colorSleep)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Visual Progress Widget */}
                <div
                    onClick={() => onNavigate("health", "composition")}
                    className="bg-black/40 backdrop-blur-md border border-gray-800 rounded-xl p-5 hover:border-[#BC0000] transition-all cursor-pointer group flex flex-col justify-between"
                >
                    <div>
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-gray-900 rounded-lg text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                <Scale className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-bold text-gray-400 bg-gray-800 px-2 py-1 rounded">
                                {latestBio ? `Act. ${new Date(latestBio.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}` : 'Sin datos'}
                            </span>
                        </div>
                        <div className="mb-4">
                            <h4 className="text-gray-400 text-xs uppercase font-bold">Mis Valoraciones</h4>
                            {latestBio ? (
                                <div>
                                    <div className="text-2xl font-bold text-white flex items-end gap-2">
                                        {latestBio.fatPercentage ? `${latestBio.fatPercentage}%` : `${latestBio.weight}kg`}
                                        <span className="text-sm text-gray-400 font-normal mb-1">
                                            {latestBio.fatPercentage ? 'Grasa' : 'Peso'}
                                        </span>
                                    </div>
                                    {latestBio.muscleMass && (
                                        <div className="text-xs text-emerald-500 font-mono mt-1">
                                            Músculo: {latestBio.muscleMass}kg
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="text-2xl font-bold text-white">Revisar</p>
                            )}
                        </div>
                    </div>

                    <div className="h-16 flex items-center gap-2 opacity-50 mt-auto">
                        {latestBio ? (
                            <div className="w-full grid grid-cols-3 gap-1">
                                <div className="h-10 rounded bg-gray-800 border border-gray-700 flex items-center justify-center text-[10px] text-gray-400">
                                    {latestBio.weight}kg
                                </div>
                                <div className="h-10 rounded bg-gray-800 border border-gray-700 flex items-center justify-center text-[10px] text-gray-400">
                                    {latestBio.fatPercentage || '-'}%
                                </div>
                                <div className="h-10 rounded bg-gray-800 border border-gray-700 flex items-center justify-center text-[10px] text-gray-400">
                                    {latestBio.waist || '-'}cm
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="w-10 h-10 rounded bg-gray-700 animate-pulse"></div>
                                <div className="w-10 h-10 rounded bg-gray-700 animate-pulse delay-75"></div>
                                <div className="w-10 h-10 rounded bg-gray-700 animate-pulse delay-150"></div>
                                <span className="text-xs text-gray-500 ml-2">Ver fotos</span>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
