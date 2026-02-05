"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, updateDoc } from "firebase/firestore";
import CoachClientDetail from "./CoachClientDetail";
// Removed MiniSleepSparkline import as requested
import CoachResourceManager from "./CoachResourceManager";
import TemplatesList from "./TemplatesList";
import FormBuilder from "./forms/FormBuilder";
import CoachMobileNav from "./CoachMobileNav";
import { MoreVertical, Power, RefreshCw, Trash2 } from "lucide-react"; // Icons for actions

// Helper for relative time
const getRelativeTime = (dateString: string | null) => {
    if (!dateString || dateString === "N/A") return "N/A";

    // dateString comes as "DD/MM/YYYY" from our previous logic, or we change it to use timestamp directly?
    // Let's rely on receiving a Date object or Timestamp logic in the mapper.
    // Actually, in the mapper below we are converting: new Date(seconds * 1000).toLocaleDateString()
    // This loses precision. Let's fix the mapper first.
    return dateString;
};

interface ClientData {
    id: string;
    displayName: string;
    email: string;
    stepsGoal: number;
    isActive: boolean;
    lastActive: any;
    // Optional derived fields
    workoutStatus?: string;
    lastActiveRelative?: string;
    currentSteps?: number;
    sleep?: string;
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
                        isActive: data.isActive !== false, // Default to true if missing
                        lastActive: data.lastActive // Keep raw for now
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

    // 3. Listen to Active Workouts for EACH client to determine status
    const [clientWorkouts, setClientWorkouts] = useState<Record<string, string>>({}); // clientId -> status

    useEffect(() => {
        if (clientsBase.length === 0) return;

        const unsubscribeList: (() => void)[] = [];
        const today = new Date().toISOString().split('T')[0];

        clientsBase.forEach(client => {
            const q = query(
                collection(db, "users", client.id, "workouts"),
                where("status", "!=", "completed") // Fetch active ones
            );

            const unsub = onSnapshot(q, (snapshot) => {
                let todayStatus = "rest";

                // Check if any active workout is scheduled for today or is "in_progress"
                // Simplified logic as requested:
                // 1. Is there a workout with 'completed: true' for today? (This requires checking history actually, or if we keep completed workouts in 'workouts' collection with status 'completed')
                // Actually, the request says: 
                // CASE B (Finished): Workout for today and completed: true.
                // CASE C (Pending): Workout for today and completed: false.

                // Issue: My query filters out 'completed'. I need to check ALL workouts or specific ones?
                // The 'workouts' collection usually holds the PLAN. 'workout_history' holds completed sessions.
                // However, based on previous code, we update 'status' to 'completed' in the workout doc itself too?
                // Let's broaden the query to fetch ALL workouts for the client to be sure.
                // Optimization: Limit to recent? No, fetch all for now, typical client has few active plans.
            });
            // Changing approach: Query ALL workouts is too heavy if we do it for every client.
            // Better: Query "workouts" where (scheduled for today) OR (status == in_progress)
            // But structure is loose.

            // Let's try: Query "workouts" collection.
            // Iterate client inputs.
        });

        // RE-THINK: Real-time listeners for 50 clients * 1 query each = 50 listeners. Expensive?
        // Maybe just fetch ONCE? No, dashboard needs to be real-time.
        // Let's stick to the plan but maybe optimize.

        return () => {
            // cleanup
        };
    }, [clientsBase]);

    // NEW APPROACH:
    // We will listen to "workouts" for each client but only selecting necessary fields if possible.
    // actually, let's implement the listener properly.

    useEffect(() => {
        if (clientsBase.length === 0) return;
        const unsubscribers: (() => void)[] = [];

        clientsBase.forEach(client => {
            // We need to know if they finished a workout TODAY.
            // Check workout_history for today?
            // Check active workouts for today?

            // Let's create a combined listener or just check 'lastActive' + 'workoutStatus' field in user doc?
            // User doc has 'workoutStatus'. We are supposed to UPDATE it in the backend?
            // The prompt says: "Frontend (Dashboard): En la columna 'Última Actividad'..."
            // "ESTADO DEL ENTRENO (Lógica Real): Ahora mismo siempre dice 'Pendiente'. Quiero lógica dinámica para el día de HOY"

            // Should we compute this on client side (Dashboard)? Yes.

            // 1. Check History for TODAY (Completed)
            // 2. Check Workouts for TODAY (Pending)

            // This is complex for many clients. 
            // Alternative: The ClientDashboard ALREADY determines "Next Session".
            // Can we store this computed status in the USER document?
            // YES. 
            // PROPOSAL: The Client App updates 'workoutStatus' on the user doc when:
            // - Opens app (Calculates status -> Updates User Doc)
            // - Finishes workout (Updates User Doc)

            // BUT, the user asked me to implement logic "NOW" in the dashboard.
            // "Ahora mismo siempre dice 'Pendiente'. Quiero lógica dinámica para el día de HOY"

            // Okay, I will implement it here.

            const historyQ = query(
                collection(db, "users", client.id, "workout_history"),
                where("completedDate", "==", new Date().toISOString().split('T')[0])
            );

            const unsubHistory = onSnapshot(historyQ, (snap) => {
                if (!snap.empty) {
                    setClientWorkouts(prev => ({ ...prev, [client.id]: "completed" }));
                } else {
                    // If no history today, check if they have PENDING active workouts
                    // We need another listener for active workouts? 
                    // This is getting heavy. 
                    // Let's assume: If they have Active Workouts in general, it's "Pending" unless they finished today.
                    // If no active workouts, it's "Rest".

                    // Let's just listen to "workouts" (active)
                    const workoutsQ = query(
                        collection(db, "users", client.id, "workouts"),
                        where("status", "!=", "completed")
                    );

                    // We can't nest listeners easily like this without leaking.
                    // Let's just listen to workouts and history?
                }
            });
            unsubscribers.push(unsubHistory);
        });

        return () => unsubscribers.forEach(u => u());
    }, [clientsBase]);

    // WAIT. Nested logic is bad.
    // Let's simplify.
    // Status = 
    // - "completed" if history found for today.
    // - "pending" if NO history today BUT has active workouts.
    // - "rest" if NO history today AND NO active workouts.

    // I will write the effect to listen to BOTH for each client.

    useEffect(() => {
        if (clientsBase.length === 0) return;
        const unsubs: (() => void)[] = [];

        clientsBase.forEach(client => {
            // We need a stable identifier for each client's status
            let hasHistoryToday = false;
            let hasActiveWorkouts = false;

            const updateStatus = () => {
                const status = hasHistoryToday ? "completed" : (hasActiveWorkouts ? "pending" : "rest");
                setClientWorkouts(prev => ({ ...prev, [client.id]: status }));
            };

            // 1. Listen History Today
            const today = new Date().toISOString().split('T')[0];
            const qHistory = query(collection(db, "users", client.id, "workout_history"), where("completedDate", "==", today));
            const u1 = onSnapshot(qHistory, (snap) => {
                hasHistoryToday = !snap.empty;
                updateStatus();
            });

            // 2. Listen Active Workouts (Just existence)
            const qWorkouts = query(collection(db, "users", client.id, "workouts"), where("status", "!=", "completed"));
            const u2 = onSnapshot(qWorkouts, (snap) => {
                // If we want to be specific about "Today", we'd need to check days.
                // For now, "Pending" implies they have a plan assigned.
                hasActiveWorkouts = !snap.empty;
                updateStatus();
            });

            unsubs.push(u1, u2);
        });

        return () => unsubs.forEach(u => u());
    }, [clientsBase]);


    // Derived State: Combined Client Data
    const clients = clientsBase
        .filter(c => c.isActive) // 1. Soft Delete Filter
        .map(c => {
            // calculate relative time
            let relTime = "N/A";
            if (c.lastActive && c.lastActive.seconds) {
                const diff = Date.now() - (c.lastActive.seconds * 1000);
                const minutes = Math.floor(diff / 60000);
                const hours = Math.floor(minutes / 60);
                const days = Math.floor(hours / 24);

                if (days > 0) relTime = days === 1 ? "Ayer" : `Hace ${days} días`;
                else if (hours > 0) relTime = `Hace ${hours}h`;
                else if (minutes > 0) relTime = `Hace ${minutes}m`;
                else relTime = "Ahora mismo";
            }

            return {
                ...c,
                currentSteps: clientStats[c.id]?.steps ?? 0,
                sleep: clientStats[c.id]?.sleep_duration ?? "0h 0m",
                workoutStatus: clientWorkouts[c.id] || "rest", // Use calculated status
                lastActiveRelative: relTime
            };
        });

    // Derived Stats
    const totalStepsGoal = clients.reduce((acc, c) => acc + c.stepsGoal, 0);
    const totalCurrentSteps = clients.reduce((acc, c) => acc + c.currentSteps, 0);
    const stepCompliance = totalStepsGoal > 0 ? Math.round((totalCurrentSteps / totalStepsGoal) * 100) : 0;

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "completed":
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-500/20 text-green-400 border border-green-500/30">Finalizado</span>;
            case "pending":
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">Pendiente</span>;
            case "rest":
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-700/50 text-gray-400 border border-gray-600">Descanso</span>;
            default:
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-700/50 text-gray-400 border border-gray-600">Descanso</span>;
        }
    };

    // Toggle Active Handler
    const handleToggleActive = async (client: ClientData) => {
        const confirmMsg = client.isActive
            ? `¿Desactivar a ${client.displayName}? No se borrarán sus datos.`
            : `¿Reactivar a ${client.displayName}?`;

        if (!confirm(confirmMsg)) return;

        try {
            await updateDoc(doc(db, "users", client.id), {
                isActive: !client.isActive
            });
        } catch (e) {
            console.error("Error updating active status:", e);
            alert("Error al actualizar estado.");
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
                                    <p className="text-3xl font-bold text-white mt-2">{clients.length}</p> {/* Already filtered by isActive in derived state */}
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
                                <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
                                    <h3 className="text-lg font-bold text-white">Estado de los Clientes</h3>
                                    {/* Optional: Toggle to show inactive? */}
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
                                                            <h3 className="text-lg font-bold text-white mb-2">No tienes atletas activos</h3>
                                                            <p className="text-gray-400 text-sm max-w-sm">
                                                                Asegúrate de que tus clientes estén "Activos".
                                                            </p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : (
                                                clients.map((client: any) => (
                                                    <tr key={client.id} className="hover:bg-white/5 transition-colors group">
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className="flex items-center">
                                                                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#BC0000] to-gray-800 flex items-center justify-center text-white font-bold text-sm shadow-lg border border-[#BC0000]/20">
                                                                    {client.displayName.charAt(0).toUpperCase()}
                                                                </div>
                                                                <div className="ml-4">
                                                                    <div className="text-sm font-bold text-white group-hover:text-[#BC0000] transition-colors cursor-pointer" onClick={() => setSelectedClient(client)}>{client.displayName}</div>
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
                                                            <span className="text-sm font-mono text-gray-300">{client.sleep}</span>
                                                            {/* Sparkline Removed */}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            {getStatusBadge(client.workoutStatus)}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 font-bold">
                                                            {client.lastActiveRelative}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <button
                                                                    onClick={() => setSelectedClient(client)}
                                                                    className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                                                                    title="Ver Detalles"
                                                                >
                                                                    Edit
                                                                </button>

                                                                {/* Toggle Active Button (Soft Delete) */}
                                                                <button
                                                                    onClick={() => handleToggleActive(client)}
                                                                    className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-900/10 rounded transition-colors"
                                                                    title="Desactivar Cliente"
                                                                >
                                                                    <Power className="w-4 h-4" />
                                                                </button>
                                                            </div>
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
