"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc } from "firebase/firestore";
import CoachClientDetail from "./CoachClientDetail";
import MiniSleepSparkline from "./MiniSleepSparkline";
import CoachResourceManager from "./CoachResourceManager";
import TemplatesList from "./TemplatesList";
import FormBuilder from "./forms/FormBuilder";
import CoachMobileNav from "./CoachMobileNav";

interface ClientData {
    id: string;
    displayName: string;
    email: string;
    stepsGoal: number;
    workoutStatus: "completed" | "pending" | "rest";
    lastActive: any;
}

interface ClientDailyStats {
    steps: number;
    sleep_hours: number;
    sleep_duration: string; // Formatted "7h 30m"
}

export default function CoachDashboard() {
    const [selectedClient, setSelectedClient] = useState<ClientData | null>(null);
    const [activeTab, setActiveTab] = useState<'clients' | 'resources' | 'templates' | 'forms'>('clients');

    // State for basic client profiles
    const [clientsBase, setClientsBase] = useState<ClientData[]>([]);

    // State for real-time daily stats: { [clientId]: Stats }
    const [clientStats, setClientStats] = useState<Record<string, ClientDailyStats>>({});

    const [loading, setLoading] = useState(true);

    // 1. Listen to Client Profiles (Users Collection)
    useEffect(() => {
        const q = query(
            collection(db, "users")
            // Temporarily removing filter to debug: where("role", "==", "client")
        );

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            console.log("CoachDashboard: Fetched users snapshot size:", querySnapshot.size);
            const clients: ClientData[] = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                console.log("CoachDashboard: User found:", doc.id, data);
                // Check if it's a client or just show everyone for now to debug
                if (data.role === 'client' || !data.role) {
                    clients.push({
                        id: doc.id,
                        displayName: data.displayName || "Usuario Sin Nombre",
                        email: data.email || "Sin email",
                        stepsGoal: data.stepsGoal || 10000,
                        workoutStatus: data.workoutStatus || "pending",
                        lastActive: data.lastActive ? new Date(data.lastActive.seconds * 1000).toLocaleDateString() : "N/A"
                    });
                }
            });
            setClientsBase(clients);
            setLoading(false);
        }, (err) => {
            console.error("Error creating clients listener:", err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // 2. Listen to Daily Stats for EACH client
    useEffect(() => {
        if (clientsBase.length === 0) return;

        const today = new Date().toISOString().split('T')[0];
        const unsubscribers: (() => void)[] = [];

        clientsBase.forEach(client => {
            const statsRef = doc(db, "users", client.id, "daily_stats", today);

            const unsub = onSnapshot(statsRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const hours = data.sleep_hours ?? 0;
                    const h = Math.floor(hours);
                    const m = Math.round((hours - h) * 60);

                    setClientStats(prev => ({
                        ...prev,
                        [client.id]: {
                            steps: data.steps ?? 0,
                            sleep_hours: hours,
                            sleep_duration: hours > 0 ? `${h}h ${m}m` : "0h 0m"
                        }
                    }));
                } else {
                    // Initialize empty if no doc yet
                    setClientStats(prev => ({
                        ...prev,
                        [client.id]: { steps: 0, sleep_hours: 0, sleep_duration: "0h 0m" }
                    }));
                }
            });
            unsubscribers.push(unsub);
        });

        // Cleanup all listeners on unmount or when clients list changes
        return () => {
            unsubscribers.forEach(unsub => unsub());
        };
    }, [clientsBase]); // Re-run if client list changes (e.g. new signup)

    // Derived State: Combined Client Data
    const clients = clientsBase.map(c => ({
        ...c,
        currentSteps: clientStats[c.id]?.steps ?? 0,
        sleep: clientStats[c.id]?.sleep_duration ?? "0h 0m"
    }));

    // Derived Stats
    const totalStepsGoal = clients.reduce((acc, c) => acc + c.stepsGoal, 0);
    const totalCurrentSteps = clients.reduce((acc, c) => acc + c.currentSteps, 0);
    const stepCompliance = totalStepsGoal > 0 ? Math.round((totalCurrentSteps / totalStepsGoal) * 100) : 0;

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "completed":
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-500/20 text-green-400 border border-green-500/30">Completado</span>;
            case "pending":
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">Pendiente</span>;
            case "rest":
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-700/50 text-gray-400 border border-gray-600">Descanso</span>;
            default:
                return null;
        }
    };

    // Prepare rich client data regardless of render state (so it's available)
    const richClientData = selectedClient ? {
        ...selectedClient,
        currentSteps: clientStats[selectedClient.id]?.steps ?? 0,
        sleep: clientStats[selectedClient.id]?.sleep_duration ?? "0h 0m"
    } : null;

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-24 md:pb-0">
            {/* Header & Main Content - Hide if viewing Detail in Clients tab */}
            {(!selectedClient || activeTab !== 'clients') && (
                <>
                    <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 border-b border-gray-800 pb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-white tracking-tight">Panel de Control</h2>
                            <p className="text-gray-400 text-sm">Gestiona tus atletas y recursos.</p>
                        </div>

                        {/* Desktop Tabs - Hidden on Mobile */}
                        <div className="hidden md:flex bg-gray-900 p-1 rounded-lg">
                            <button
                                onClick={() => setActiveTab('clients')}
                                className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'clients' ? 'bg-[#BC0000] text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                            >
                                Clientes
                            </button>
                            <button
                                onClick={() => setActiveTab('templates')}
                                className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'templates' ? 'bg-[#BC0000] text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                            >
                                Plantillas
                            </button>
                            <button
                                onClick={() => setActiveTab('resources')}
                                className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'resources' ? 'bg-[#BC0000] text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                            >
                                Biblioteca Global
                            </button>
                            <button
                                onClick={() => setActiveTab('forms')}
                                className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'forms' ? 'bg-[#BC0000] text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                            >
                                Formularios
                            </button>
                        </div>
                    </div>

                    {activeTab === 'resources' ? (
                        <CoachResourceManager />
                    ) : activeTab === 'templates' ? (
                        <TemplatesList />
                    ) : activeTab === 'forms' ? (
                        <FormBuilder />
                    ) : (
                        <>
                            <div className="flex justify-end">
                                <button className="px-4 py-2 bg-[#BC0000] text-white rounded-lg font-bold text-sm shadow-[0_0_10px_rgba(188,0,0,0.3)] hover:bg-red-700 transition-all">
                                    + Nuevo Cliente
                                </button>
                            </div>

                            {/* Stats Overview */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div className="bg-black/40 backdrop-blur-sm border border-gray-800 rounded-xl p-6 hover:border-[#BC0000]/50 transition-colors">
                                    <h3 className="text-gray-400 text-sm font-medium">Clientes Activos</h3>
                                    <p className="text-3xl font-bold text-white mt-2">{clients.length}</p>
                                </div>
                                <div className="bg-black/40 backdrop-blur-sm border border-gray-800 rounded-xl p-6 hover:border-[#BC0000]/50 transition-colors">
                                    <h3 className="text-gray-400 text-sm font-medium">Entrenos Completados Hoy</h3>
                                    <p className="text-3xl font-bold text-white mt-2">
                                        {clients.filter(c => c.workoutStatus === "completed").length} / {clients.filter(c => c.workoutStatus !== "rest").length}
                                    </p>
                                </div>
                                <div className="bg-black/40 backdrop-blur-sm border border-gray-800 rounded-xl p-6 hover:border-[#BC0000]/50 transition-colors">
                                    <h3 className="text-gray-400 text-sm font-medium">Cumplimiento de Pasos</h3>
                                    <p className="text-3xl font-bold text-white mt-2">
                                        {stepCompliance}%
                                    </p>
                                </div>
                                <div
                                    onClick={() => setActiveTab('templates')}
                                    className="bg-gradient-to-br from-[#BC0000]/20 to-black backdrop-blur-sm border border-[#BC0000]/30 rounded-xl p-6 hover:border-[#BC0000] transition-colors cursor-pointer group"
                                >
                                    <h3 className="text-[#BC0000] text-sm font-bold group-hover:text-white transition-colors">MIS PLANTILLAS</h3>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="text-white text-xs">Gestionar Biblioteca</span>
                                    </div>
                                </div>
                            </div>

                            {/* Clients Table */}
                            <div className="bg-black/40 backdrop-blur-sm rounded-xl border border-gray-800 overflow-hidden overflow-x-auto">
                                <div className="px-6 py-4 border-b border-gray-800">
                                    <h3 className="text-lg font-bold text-white">Estado de los Clientes</h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-800">
                                        <thead className="bg-gray-900/50">
                                            <tr>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Cliente</th>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Pasos (Hoy)</th>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Sueño</th>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Entreno</th>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Última Actividad</th>
                                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-800">
                                            {loading ? (
                                                <tr>
                                                    <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-400 animate-pulse">Cargando atletas...</td>
                                                </tr>
                                            ) : clients.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="px-6 py-12 text-center">
                                                        <div className="flex flex-col items-center justify-center">
                                                            <div className="h-12 w-12 rounded-full bg-gray-800 flex items-center justify-center mb-4">
                                                                <span className="text-2xl">👥</span>
                                                            </div>
                                                            <h3 className="text-lg font-bold text-white mb-2">Aún no tienes atletas registrados</h3>
                                                            <p className="text-gray-400 text-sm max-w-sm">
                                                                Los nuevos registros con rol "client" aparecerán aquí automáticamente.
                                                            </p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : (
                                                clients.map((client) => (
                                                    <tr key={client.id} className="hover:bg-white/5 transition-colors group">
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className="flex items-center">
                                                                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#BC0000] to-gray-800 flex items-center justify-center text-white font-bold text-sm shadow-lg border border-[#BC0000]/20">
                                                                    {client.displayName.charAt(0).toUpperCase()}
                                                                </div>
                                                                <div className="ml-4">
                                                                    <div className="text-sm font-bold text-white group-hover:text-[#BC0000] transition-colors">{client.displayName}</div>
                                                                    <div className="text-xs text-gray-500">{client.email}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className="flex items-center">
                                                                <div className="flex-1 w-24 bg-gray-800 rounded-full h-1.5 mr-3 overflow-hidden">
                                                                    <div
                                                                        className="bg-[#BC0000] h-full rounded-full shadow-[0_0_10px_rgba(188,0,0,0.5)]"
                                                                        style={{ width: `${Math.min((client.currentSteps / client.stepsGoal) * 100, 100)}%` }}
                                                                    ></div>
                                                                </div>
                                                                <span className="text-xs font-bold text-white">{client.currentSteps.toLocaleString()}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-sm font-mono text-gray-300 w-16">{client.sleep}</span>
                                                                <MiniSleepSparkline userId={client.id} />
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            {getStatusBadge(client.workoutStatus)}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 font-mono">
                                                            {client.lastActive}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                            <button
                                                                onClick={() => setSelectedClient(client)}
                                                                className="inline-flex items-center px-4 py-1.5 bg-[#BC0000]/10 text-[#BC0000] rounded-lg font-bold text-xs hover:bg-[#BC0000] hover:text-white transition-all border border-[#BC0000]/20 hover:border-[#BC0000]"
                                                            >
                                                                EDITAR PLAN
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </>
            )}

            {/* Client Detail View */}
            {selectedClient && activeTab === 'clients' && richClientData && (
                <CoachClientDetail client={richClientData} onBack={() => setSelectedClient(null)} />
            )}

            {/* Mobile Bottom Navigation */}
            <CoachMobileNav activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>
    );
}
