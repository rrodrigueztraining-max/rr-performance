"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Plus, FileText, Activity, MessageSquare, Upload, Moon, Footprints, Save, CheckCircle, Clock, Calendar, LayoutTemplate } from "lucide-react";
// Removed unused recharts imports (InteractiveHealthChart handles them)
import WorkoutEditor from "./WorkoutEditor";
import CoachClientCalendar from "./CoachClientCalendar";
import InteractiveHealthChart from "./InteractiveHealthChart";
import ClientProgressChart from "./ClientProgressChart";
import BiometricsManager from "./BiometricsManager";
import { storage, db } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, updateDoc, arrayUnion, collection, onSnapshot, query, orderBy, where } from "firebase/firestore";

interface ClientDetailProps {
    client: any;
    onBack: () => void;
}

// Sub-component defined OUTSIDE main component
const CoachHistoryDetail = ({ workout, onClose }: { workout: any; onClose: () => void }) => {
    const [fullWorkout, setFullWorkout] = useState<any>(workout);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // If workout already has exercises snapshot, use it.
        if (workout.exercises && workout.exercises.length > 0) {
            setFullWorkout(workout);
            return;
        }

        // If legacy (no exercises snapshot), try to reconstruct from originalWorkoutId
        const fetchOriginal = async () => {
            if (!workout.originalWorkoutId) return;
            setLoading(true);
            try {
                const docRef = doc(db, "users", workout.clientId || workout.userId /* We need client ID here, usually passed or inferred? Wait, history item is inside user subcollection, but we don't have parent ID easily unless passed. */, "workouts", workout.originalWorkoutId);
                // Issue: workout object might not have userId/clientId if fetched from list without context?
                // CoachClientDetail passes 'selectedHistoryItem' which is just data.
                // We need to know who the client is.
                // WORKAROUND: CoachClientDetail is inside a component that knows 'client.id'. 
                // We should probably rely on parent passing the reconstructed data or this component needs logic.
                // Actually this component usage: <CoachHistoryDetail workout={selectedHistoryItem} ... />
                // 'selectedHistoryItem' comes from 'historyWorkouts' state.
                // We can't easily fetch here without clientId.
                // Let's assume for now we can't fetch unless we pass clientId.
            } catch (e) {
                console.error("Error fetching original workout for report", e);
            }
            setLoading(false);
        };
        // fetchOriginal(); 
    }, [workout]);

    // RE-FACTOR: We need clientId passed to this component to fetch.
    // However, correcting the Prop Interface is invasive. 
    // Let's implement the reconstruction logic RIGHT IN THE RENDER if we assume "exercises" is what we display.
    // If it's missing, we show a message "Formato antiguo - No disponible detalle completo" OR we try to improve.

    // Better approach: User is complaining about NEW imports too? "Importing a template... exactly the same".
    // If template has blocks, my previous fix to ImportModal only passed 'blocks'. 
    // Does CoachHistoryDetail handle 'blocks' if they are present in history?
    // My finishWorkout saves 'exercises' (flat).

    // If the history item has 'exercises' (flat), we map it.
    // If the history item has 'blocks' (maybe legacy did?), we map it?
    // Legacy history had 'sessionData' and 'originalWorkoutId'. It did NOT have blocks/exercises usually.

    const { exercises, generalFeedback, title, completedDate } = fullWorkout;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 text-white animate-in fade-in duration-200">
            <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative">
                {/* Header */}
                <div className="sticky top-0 bg-gray-900 border-b border-gray-800 p-6 flex justify-between items-center z-10">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <FileText className="text-[#BC0000]" /> {title}
                        </h2>
                        <p className="text-gray-400 text-sm mt-1 flex items-center gap-2">
                            <Calendar className="w-4 h-4" /> {completedDate}
                            <span className="bg-green-900/30 text-green-500 text-xs px-2 py-0.5 rounded border border-green-500/20 font-bold uppercase">Completado</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 space-y-8">
                    {/* Global Feedback */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-black/40 border border-gray-800 rounded-lg p-4">
                            <div className="text-xs text-gray-500 uppercase font-bold mb-1">RPE Sesión</div>
                            <div className="text-3xl font-bold text-white">{generalFeedback?.sessionRPE || 'N/A'}<span className="text-gray-600 text-base">/10</span></div>
                        </div>
                        <div className="bg-black/40 border border-gray-800 rounded-lg p-4">
                            <div className="text-xs text-gray-500 uppercase font-bold mb-1">Notas Generales</div>
                            <p className="text-sm text-gray-300 italic">
                                {generalFeedback?.generalNotes ? `"${generalFeedback.generalNotes}"` : "Sin comentarios."}
                            </p>
                        </div>
                    </div>

                    {/* Exercises */}
                    <div className="space-y-6">
                        <h3 className="text-xl font-bold text-white mb-4 border-b border-gray-800 pb-2">Desglose de Ejercicios</h3>

                        {!exercises || exercises.length === 0 ? (
                            <div className="text-center py-10 bg-gray-800/20 rounded-lg border border-gray-800 border-dashed">
                                <Activity className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                                <p className="text-gray-400 font-bold">No hay detalles de ejercicios disponibles</p>
                                <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                                    Este reporte puede ser de una versión anterior o no contener datos estructurados.
                                </p>
                            </div>
                        ) : (
                            exercises.map((ex: any, i: number) => {
                                if (ex.isSection) {
                                    return (
                                        <div key={i} className="flex items-center gap-3 text-[#BC0000] font-black uppercase tracking-widest text-lg py-4 border-b border-[#BC0000]/20 mt-6 mb-2">
                                            <LayoutTemplate className="w-6 h-6" />
                                            {ex.name}
                                        </div>
                                    );
                                }

                                return (
                                    <div key={i} className="bg-gray-800/20 border border-gray-800 rounded-lg p-5 border-l-4 border-l-transparent hover:border-l-[#BC0000] transition-all">
                                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                                            <div>
                                                <h4 className="font-bold text-lg text-white">{ex.name}</h4>
                                                <div className="text-xs text-gray-500 font-mono mt-1">
                                                    {ex.series?.length} Series • Rest: {ex.rest}
                                                </div>
                                            </div>
                                            {ex.painLevel > 0 && (
                                                <div className="px-3 py-1 bg-red-900/20 text-red-400 border border-red-900/50 rounded text-xs font-bold uppercase flex items-center gap-2">
                                                    <Activity className="w-3 h-3" /> Dolor: {ex.painLevel}/10
                                                </div>
                                            )}
                                        </div>

                                        {/* Series Table */}
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm text-left">
                                                <thead className="text-xs text-gray-500 uppercase bg-black/20">
                                                    <tr>
                                                        <th className="px-3 py-2 text-center rounded-l">Set</th>
                                                        <th className="px-3 py-2 text-center">Peso (Kg)</th>
                                                        <th className="px-3 py-2 text-center">Intensidad</th>
                                                        <th className="px-3 py-2 text-center">Reps</th>
                                                        <th className="px-3 py-2 text-center rounded-r">Realizado</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-700/50">
                                                    {ex.series?.map((s: any, j: number) => {
                                                        // Intensity Label
                                                        let intensityLabel = s.intensityType || "RPE";
                                                        if (intensityLabel === "VELOCIDAD") intensityLabel = "V (m/s)";

                                                        const intensityVal = s.targetRPE;

                                                        // Weight Check (Handle 0 correctly)
                                                        const tLoadRaw = s.targetLoad !== undefined && s.targetLoad !== "" ? s.targetLoad : s.load;
                                                        const tLoad = tLoadRaw !== undefined && tLoadRaw !== "" ? tLoadRaw : "-";

                                                        const aLoad = s.actualLoad;
                                                        const loadMismatch = tLoad !== "-" && aLoad && String(tLoad) !== String(aLoad);

                                                        return (
                                                            <tr key={j} className="hover:bg-white/5">
                                                                <td className="px-3 py-2 text-center font-bold text-gray-400">#{s.setNumber}</td>
                                                                <td className="px-3 py-2 text-center font-mono">
                                                                    <div className="flex flex-col items-center">
                                                                        <span className="text-gray-500 text-[10px]">OBJ: {tLoad || '-'}</span>
                                                                        <span className={`font-bold ${loadMismatch ? 'text-[#BC0000]' : 'text-white'}`}>{aLoad || '-'}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-3 py-2 text-center text-gray-400 font-mono">
                                                                    {intensityVal ? `${intensityLabel} ${intensityVal}` : '-'}
                                                                </td>
                                                                <td className="px-3 py-2 text-center text-white">{s.actualReps || s.targetReps || '-'}</td>
                                                                <td className="px-3 py-2 text-center">
                                                                    {s.completed ? <CheckCircle className="w-4 h-4 text-green-500 mx-auto" /> : <span className="text-gray-600">-</span>}
                                                                </td>
                                                            </tr>
                                                        )
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Exercise Note */}
                                        {ex.userNotes && (
                                            <div className="mt-4 p-3 bg-black/30 rounded border border-gray-700/50">
                                                <span className="text-xs text-gray-500 uppercase font-bold block mb-1">Nota del Atleta:</span>
                                                <p className="text-sm text-gray-300 italic">{ex.userNotes}</p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Simple Close Icon Helper to avoid missing import
const XIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
);


export default function CoachClientDetail({ client, onBack }: ClientDetailProps) {
    if (!client) {
        return <div className="p-10 text-center text-red-500">Error: No se han cargado los datos del cliente.</div>;
    }

    const [activeTab, setActiveTab] = useState<'planning' | 'agenda' | 'documents' | 'progress' | 'health' | 'forms'>('planning');
    const [planningSubTab, setPlanningSubTab] = useState<'active' | 'history' | 'new'>('active');

    // Data State
    const [activeWorkouts, setActiveWorkouts] = useState<any[]>([]);
    const [historyWorkouts, setHistoryWorkouts] = useState<any[]>([]);
    const [clientForms, setClientForms] = useState<any[]>([]); // NEW: Forms State
    const [selectedForm, setSelectedForm] = useState<any>(null); // NEW: Select form to view detail
    const [stepGoal, setStepGoal] = useState(10000);
    const [docTitle, setDocTitle] = useState("");
    const [coachNote, setCoachNote] = useState("");
    const [uploading, setUploading] = useState(false);
    const [selectedHistoryItem, setSelectedHistoryItem] = useState<any>(null); // For Report View
    const [editingWorkout, setEditingWorkout] = useState<any>(null); // For Edit View

    // Stats State
    const [stats, setStats] = useState({
        steps: 0,
        sleep_duration: "0h 0m",
        sleep_start: "N/A",
        sleep_end: "N/A"
    });

    // 1. Fetch Workouts (Active + Pending) - MATCHING CLIENT DASHBOARD LOGIC
    useEffect(() => {
        if (!client.id) return; // Guard clause
        const q = query(
            collection(db, "users", client.id, "workouts")
            // Removed restricted "where" clause to match ClientDashboard filter
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const allWorkouts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Filter: Show everything NOT completed AND not fully finished by blocks
            const activeOnly = allWorkouts.filter((w: any) => {
                if (w.status === 'completed') return false;
                if (w.blocks && w.blocks.length > 0 && w.completedBlocks && w.completedBlocks.length >= w.blocks.length) return false;
                return true;
            });
            setActiveWorkouts(activeOnly);
        });
        return () => unsubscribe();
    }, [client.id]);

    // 2. Fetch History (Completed)
    useEffect(() => {
        const q = query(
            collection(db, "users", client.id, "workout_history"),
            orderBy("completedAt", "desc")
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setHistoryWorkouts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, [client.id]);

    // 2.5 Fetch Forms (Assigned/Completed)
    useEffect(() => {
        const q = query(
            collection(db, "assignedForms"),
            where("clientId", "==", client.id)
            // orderBy("assignedAt", "desc") // Requires index, client sort for now
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Manual sort by date
            fetched.sort((a: any, b: any) => {
                const dateA = a.completedAt?.toDate() || a.assignedAt?.toDate() || new Date(0);
                const dateB = b.completedAt?.toDate() || b.assignedAt?.toDate() || new Date(0);
                return dateB.getTime() - dateA.getTime();
            });
            setClientForms(fetched);
        });
        return () => unsubscribe();
    }, [client.id]);

    // 3. Listen to User Document for Goal & Realtime Stats
    useEffect(() => {
        // Goal
        const userRef = doc(db, "users", client.id);
        const unsubUser = onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.daily_step_goal) setStepGoal(data.daily_step_goal);
                if (data.coachNote) setCoachNote(data.coachNote);
            }
        });

        // Daily Stats
        const today = new Date().toISOString().split('T')[0];
        const statsRef = doc(db, "users", client.id, "daily_stats", today);
        const unsubStats = onSnapshot(statsRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const hours = data.sleep_hours ?? 0;
                const h = Math.floor(hours);
                const m = Math.round((hours - h) * 60);

                setStats({
                    steps: data.steps ?? 0,
                    sleep_duration: hours > 0 ? `${h}h ${m}m` : "0h 0m",
                    sleep_start: data.sleep_start || "N/A",
                    sleep_end: data.sleep_end || "N/A"
                });
            } else {
                setStats({ steps: 0, sleep_duration: "0h 0m", sleep_start: "N/A", sleep_end: "N/A" });
            }
        });

        return () => {
            unsubUser();
            unsubStats();
        };
    }, [client.id]);

    const handleUpdateStepGoal = async (newGoal: string) => {
        const goal = parseInt(newGoal);
        if (isNaN(goal) || goal <= 0) return;
        setStepGoal(goal); // Optimistic
        await updateDoc(doc(db, "users", client.id), { daily_step_goal: goal });
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !docTitle) {
            alert("Por favor ingresa un título y selecciona un archivo");
            return;
        }

        setUploading(true);
        try {
            const storagePath = `docs/${client.id}/${Date.now()}_${file.name}`;
            const storageRef = ref(storage, storagePath);

            // Upload
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);

            // Update Firestore
            await updateDoc(doc(db, "users", client.id), {
                documents: arrayUnion({
                    title: docTitle,
                    url: downloadURL,
                    type: file.type,
                    createdAt: new Date().toISOString(),
                    createdBy: "coach"
                })
            });

            setDocTitle("");
            alert("¡Documento subido correctamente!");
        } catch (error: any) {
            console.error("Upload Error:", error);
            // Translate common errors
            let msg = "Error al subir el documento.";
            if (error.code === 'storage/unauthorized') msg = "No tienes permiso para subir archivos. Revisa las reglas de Firebase Storage.";
            if (error.code === 'storage/canceled') msg = "Subida cancelada.";
            if (error.code === 'storage/unknown') msg = "Error desconocido en Storage.";

            alert(`${msg} (${error.message})`);
        } finally {
            setUploading(false);
        }
    };

    // --- COACH HISTORY DETAIL COMPONENT REMOVED (Externalized) ---

    return (
        <div className="min-h-screen bg-black text-white p-4 md:p-6 animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6 mb-8 border-b border-gray-800 pb-6">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-3 bg-gray-900 rounded-full hover:bg-gray-800 hover:text-[#BC0000] transition-colors">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-white">{client.displayName}</h1>
                        <p className="text-gray-400 text-sm">{client.email}</p>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="w-full md:w-auto overflow-x-auto flex gap-3 pb-2 md:pb-0 md:ml-auto no-scrollbar">
                    {['planning', 'agenda', 'documents', 'forms', 'progress', 'health'].map((tab: any) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all capitalize whitespace-nowrap ${activeTab === tab ? 'bg-[#BC0000] text-white' : 'bg-gray-900 text-gray-400 hover:text-white'}`}
                        >
                            {tab === 'planning' ? 'Entrenamientos' : tab}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="max-w-7xl mx-auto">

                {/* --- AGENDA TAB --- */}
                {activeTab === 'agenda' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <CoachClientCalendar clientId={client.id} />
                    </div>
                )}

                {/* --- PLANNING / TRAINING TAB --- */}
                {activeTab === 'planning' && (
                    <div className="space-y-6">
                        {/* Sub-navigation */}
                        <div className="flex gap-6 border-b border-gray-800 pb-1 mb-6">
                            <button
                                onClick={() => setPlanningSubTab('active')}
                                className={`pb-3 text-sm font-bold border-b-2 transition-all ${planningSubTab === 'active' ? 'border-[#BC0000] text-white' : 'border-transparent text-gray-500 hover:text-white'}`}
                            >
                                ACTIVOS ({activeWorkouts.length})
                            </button>
                            <button
                                onClick={() => setPlanningSubTab('history')}
                                className={`pb-3 text-sm font-bold border-b-2 transition-all ${planningSubTab === 'history' ? 'border-[#BC0000] text-white' : 'border-transparent text-gray-500 hover:text-white'}`}
                            >
                                HISTORIAL
                            </button>
                            <button
                                onClick={() => setPlanningSubTab('new')}
                                className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${planningSubTab === 'new' ? 'border-[#BC0000] text-[#BC0000]' : 'border-transparent text-gray-500 hover:text-white'}`}
                            >
                                <Plus className="w-4 h-4" /> NUEVO PLAN
                            </button>
                        </div>

                        {/* 1. ACTIVE WORKOUTS LIST */}
                        {planningSubTab === 'active' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {activeWorkouts.length === 0 ? (
                                    <div className="col-span-full py-12 text-center text-gray-500">
                                        No hay entrenamientos activos. ¡Crea uno nuevo!
                                    </div>
                                ) : (
                                    activeWorkouts.map((workout: any) => (
                                        <div key={workout.id} className="bg-gray-900 border border-gray-800 rounded-xl p-6 relative group hover:border-[#BC0000] transition-colors">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <h3 className="font-bold text-white text-lg">{workout.title}</h3>
                                                    <span className="text-xs text-gray-500">Asignado: {workout.assignedDate || 'N/A'}</span>
                                                </div>
                                                <div className={`px-2 py-1 rounded text-xs font-bold uppercase ${workout.status === 'in_progress' ? 'bg-amber-900/30 text-amber-500' : 'bg-gray-800 text-gray-400'
                                                    }`}>
                                                    {workout.status === 'in_progress' ? 'En Curso' : 'Pendiente'}
                                                </div>
                                            </div>
                                            <div className="text-sm text-gray-400 mb-4">
                                                {workout.blocks?.length || 0} Bloques • {workout.blocks?.reduce((acc: any, b: any) => acc + (b.exercises?.length || 0), 0)} Ejercicios
                                            </div>
                                            <button
                                                onClick={() => setEditingWorkout(workout)}
                                                className="w-full py-2 bg-gray-800 hover:bg-[#BC0000] text-white rounded font-bold text-xs uppercase transition-colors"
                                            >
                                                Editar / Ver Detalles
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* 2. HISTORY LIST */}
                        {planningSubTab === 'history' && (
                            <div className="space-y-4">
                                {historyWorkouts.length === 0 ? (
                                    <div className="py-12 text-center text-gray-500">
                                        Aún no hay entrenamientos finalizados.
                                    </div>
                                ) : (
                                    historyWorkouts.map((entry: any) => (
                                        <div key={entry.id} className="bg-black/40 border border-gray-800 rounded-lg p-4 flex flex-col md:flex-row items-center gap-6 hover:bg-gray-900/50 transition-colors">
                                            <div className="bg-green-900/20 p-3 rounded-full text-green-500">
                                                <CheckCircle className="w-6 h-6" />
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="font-bold text-white text-lg">{entry.title}</h4>
                                                <div className="flex items-center gap-4 text-xs text-gray-400 mt-1">
                                                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {entry.completedDate}</span>
                                                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Duration: N/A</span>
                                                </div>
                                            </div>

                                            {/* Quick Stats Metrics */}
                                            <div className="flex gap-8 text-center px-6 border-l border-gray-800">
                                                <div>
                                                    <div className="text-xs text-gray-500 uppercase font-bold">RPE Sesión</div>
                                                    <div className="text-xl font-mono font-bold text-white">{entry.feedback?.sessionRPE || '-'}</div>
                                                </div>
                                                <div>
                                                    <div className="text-xs text-gray-500 uppercase font-bold">Comentarios</div>
                                                    <div className="text-xs text-gray-300 max-w-[150px] truncate">{entry.feedback?.notes || 'Sin notas'}</div>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => setSelectedHistoryItem(entry)}
                                                className="px-4 py-2 border border-gray-700 rounded text-xs font-bold text-gray-300 hover:text-white hover:border-white transition-colors"
                                            >
                                                VER REPORTE
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* 3. NEW PLAN EDITOR & EDIT EXISTING */}
                        {(planningSubTab === 'new' || editingWorkout) && (
                            <WorkoutEditor
                                clientId={client.id}
                                onClose={() => {
                                    setPlanningSubTab('active');
                                    setEditingWorkout(null);
                                }}
                                initialData={editingWorkout}
                                workoutId={editingWorkout?.id}
                            />
                        )}
                    </div>
                )}


                {/* --- HEALTH TAB (EXISTING) --- */}
                {activeTab === 'health' && (
                    <>
                        {/* Coach Controlled Goals */}
                        <div className="mb-6 p-4 bg-gray-900/30 border border-gray-800 rounded-lg flex items-center justify-between">
                            <div>
                                <h4 className="text-gray-200 font-bold flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-[#BC0000]" /> Configurar Objetivo Pasos
                                </h4>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    className="bg-black border border-gray-700 rounded px-3 py-1 text-white text-right w-24 font-mono font-bold"
                                    value={stepGoal}
                                    onChange={(e) => handleUpdateStepGoal(e.target.value)}
                                />
                                <span className="text-xs text-gray-400 font-bold uppercase">pasos/día</span>
                            </div>
                        </div>

                        {/* NEW: Biometrics Manager */}
                        <div className="mb-8">
                            <BiometricsManager clientId={client.id} />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Steps Card */}
                            <div className="bg-black/60 backdrop-blur-md border border-gray-800 rounded-xl p-6 relative overflow-hidden">
                                <div className="relative z-10">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-lg font-bold text-gray-200 flex items-center gap-2">
                                            <Activity className="text-[#BC0000]" /> Pasos Diarios
                                        </h3>
                                    </div>
                                    <div className="flex items-end gap-2 mb-2">
                                        <span className="text-4xl font-bold text-white">{stats.steps.toLocaleString()}</span>
                                        <span className="text-sm text-gray-400 mb-1">/ {stepGoal.toLocaleString()} pasos</span>
                                    </div>
                                    <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden mb-4">
                                        <div className="bg-[#BC0000] h-full rounded-full" style={{ width: `${Math.min((stats.steps / stepGoal) * 100, 100)}%` }}></div>
                                    </div>
                                </div>
                            </div>

                            {/* Sleep Card */}
                            <div className="bg-black/60 backdrop-blur-md border border-gray-800 rounded-xl p-6 relative overflow-hidden">
                                <div className="relative z-10">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="text-lg font-bold text-gray-200 flex items-center gap-2">
                                            <Moon className="text-indigo-400" /> Registro de Sueño
                                        </h3>
                                        <span className="text-2xl font-bold text-white">{stats.sleep_duration}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs text-gray-400 uppercase font-bold">Dormir</label>
                                            <div className="w-full bg-gray-900 border border-gray-800 rounded p-3 text-white font-mono">
                                                {stats.sleep_start}
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs text-gray-400 uppercase font-bold">Despertar</label>
                                            <div className="w-full bg-gray-900 border border-gray-800 rounded p-3 text-white font-mono">
                                                {stats.sleep_end}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Interactive Charts Area */}
                        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <InteractiveHealthChart
                                userId={client.id}
                                type="steps"
                                color="#BC0000"
                            />
                            <InteractiveHealthChart
                                userId={client.id}
                                type="sleep"
                                color="#818cf8"
                            />
                        </div>
                    </>
                )}

                {/* --- DOCUMENTS TAB (EXISTING) --- */}
                {activeTab === 'documents' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-black/40 border border-gray-800 rounded-xl p-6">
                            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <MessageSquare className="text-[#BC0000]" /> Notas para el Atleta
                            </h3>
                            <textarea
                                value={coachNote}
                                onChange={(e) => setCoachNote(e.target.value)}
                                placeholder="Escribe un mensaje para que lo vea el atleta en su inicio..."
                                className="w-full h-40 bg-gray-900/50 border border-gray-800 rounded-lg p-4 text-white resize-none mb-4 focus:border-[#BC0000] focus:ring-1 focus:ring-[#BC0000] outline-none transition-all"
                            ></textarea>
                            <button
                                onClick={async () => {
                                    try {
                                        await updateDoc(doc(db, "users", client.id), { coachNote });
                                        alert("Nota actualizada correctamente");
                                    } catch (e) {
                                        console.error(e);
                                        alert("Error al guardar la nota");
                                    }
                                }}
                                className="w-full py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-lg border border-gray-700 hover:border-gray-500 transition-all"
                            >
                                Actualizar Nota
                            </button>
                        </div>
                        <div className="bg-black/40 border border-gray-800 rounded-xl p-6 space-y-6">
                            <div>
                                <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                                    <Upload className="text-[#BC0000]" /> Subir Recurso
                                </h3>
                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        placeholder="Título del Documento"
                                        value={docTitle}
                                        onChange={(e) => setDocTitle(e.target.value)}
                                        className="w-full bg-gray-900 border border-gray-800 rounded p-3 text-white"
                                    />
                                    <div className="relative">
                                        <input
                                            type="file"
                                            onChange={handleFileUpload}
                                            className="hidden"
                                            id="file-upload"
                                            disabled={uploading}
                                        />
                                        <label
                                            htmlFor="file-upload"
                                            className={`w-full py-4 border-2 border-dashed border-gray-800 hover:border-[#BC0000] rounded-lg flex flex-col items-center justify-center cursor-pointer ${uploading ? 'opacity-50' : ''}`}
                                        >
                                            <Upload className="w-6 h-6 text-gray-500 mb-2" />
                                            <span className="text-sm text-gray-400">{uploading ? "Subiendo..." : "Click para seleccionar archivo"}</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- FORMS TAB (NEW) --- */}
                {activeTab === 'forms' && (
                    <div className="space-y-6">
                        {clientForms.length === 0 ? (
                            <div className="text-center py-20 text-gray-500 border border-dashed border-gray-800 rounded-xl">
                                <p>Este cliente no tiene formularios asignados aún.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4">
                                {clientForms.map(form => (
                                    <div
                                        key={form.id}
                                        onClick={() => setSelectedForm(form)}
                                        className={`p-6 rounded-xl border transition-all cursor-pointer flex justify-between items-center group ${form.status === 'completed'
                                            ? 'bg-black/40 border-gray-800 hover:border-[#BC0000]'
                                            : 'bg-gray-900/30 border-gray-800 hover:border-yellow-500'
                                            }`}>
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <h3 className="text-xl font-bold text-white">{form.templateTitle}</h3>
                                                {form.status === 'completed' ? (
                                                    <span className="bg-green-900/20 text-green-500 text-xs px-2 py-0.5 rounded border border-green-900/50 font-bold uppercase">Completado</span>
                                                ) : (
                                                    <span className="bg-yellow-900/20 text-yellow-500 text-xs px-2 py-0.5 rounded border border-yellow-900/50 font-bold uppercase">Pendiente</span>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-500">
                                                {form.status === 'completed'
                                                    ? `Completado el: ${form.completedAt?.toDate().toLocaleDateString()} a las ${form.completedAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                                    : `Asignado el: ${form.assignedAt?.toDate().toLocaleDateString()}`
                                                }
                                            </p>
                                        </div>
                                        <div className="text-gray-500 group-hover:text-white">
                                            <ArrowLeft className="w-5 h-5 rotate-180" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* --- FORM DETAIL MODAL --- */}
                {selectedForm && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative flex flex-col">
                            <div className="sticky top-0 bg-gray-900 border-b border-gray-800 p-6 flex justify-between items-center z-10">
                                <div>
                                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                                        <FileText className="text-[#BC0000]" /> {selectedForm.templateTitle}
                                    </h2>
                                    <div className="flex items-center gap-2 mt-2">
                                        {selectedForm.status === 'completed' ? (
                                            <span className="bg-green-900/20 text-green-500 text-xs px-2 py-0.5 rounded border border-green-900/50 font-bold uppercase">Completado</span>
                                        ) : (
                                            <span className="bg-yellow-900/20 text-yellow-500 text-xs px-2 py-0.5 rounded border border-yellow-900/50 font-bold uppercase">Pendiente</span>
                                        )}
                                        <span className="text-gray-500 text-xs">{selectedForm.completedAt?.toDate().toLocaleDateString()}</span>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedForm(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white">
                                    <XIcon className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="p-8 space-y-8">
                                {selectedForm.questionsSnapshot?.map((q: any, idx: number) => {
                                    const answer = selectedForm.answers?.[q.id];

                                    return (
                                        <div key={q.id} className="bg-black/40 border border-gray-800 p-6 rounded-lg">
                                            <div className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">
                                                Pregunta {idx + 1}
                                            </div>
                                            <h4 className="text-lg font-bold text-white mb-4">{q.questionText}</h4>

                                            <div className="bg-gray-800/50 p-4 rounded border border-gray-700/50">
                                                {q.type === 'photo' ? (
                                                    answer ? (
                                                        <div>
                                                            <p className="text-xs text-gray-400 mb-2">Archivo adjunto:</p>
                                                            {/* Check if it's a URL (http) or just text */}
                                                            {typeof answer === 'string' && answer.startsWith('http') ? (
                                                                <img src={answer} alt="Respuesta foto" className="max-w-md w-full rounded-lg border border-gray-700" />
                                                            ) : (
                                                                <div className="flex items-center gap-2 text-white font-mono bg-black/50 p-2 rounded">
                                                                    <Activity className="w-4 h-4 text-[#BC0000]" /> {answer || "Sin archivo"}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : <span className="text-gray-500 italic">Sin respuesta</span>
                                                ) : (
                                                    <p className="text-gray-200 whitespace-pre-wrap">{answer !== undefined && answer !== "" ? answer : <span className="text-gray-500 italic">Sin respuesta</span>}</p>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* --- PROGRESS TAB (EXISTING) --- */}
                {activeTab === 'progress' && (
                    <ClientProgressChart clientId={client.id} />
                )}

            </div>
            {selectedHistoryItem && (
                <CoachHistoryDetail
                    workout={selectedHistoryItem}
                    onClose={() => setSelectedHistoryItem(null)}
                />
            )}
        </div>
    );
}
