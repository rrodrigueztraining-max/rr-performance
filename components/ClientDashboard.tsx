"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, collection, onSnapshot, query, where } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import HomeView from "./HomeView";
import HealthView from "./HealthView";
import CalendarView from "./CalendarView";
import ResourcesView from "./ResourcesView";
import TrainingCard from "./TrainingCard";
import { finishWorkout, finishBlock, getLastWorkoutHistory } from "@/lib/workoutLogic";
import { CheckCircle, Clock, Calendar as CalendarIcon, ChevronRight, LayoutTemplate, Trophy, Play, ChevronDown } from "lucide-react";
import DebouncedInput from "./DebouncedInput";
import { Timestamp } from "firebase/firestore";
import RestTimer from "./RestTimer";
import confetti from "canvas-confetti";

interface SeriesData {
    load: string;
    reps: string;
    rpe: string;
    completed: boolean;
}

export default function ClientDashboard() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState("home");

    // Workout State
    const [workouts, setWorkouts] = useState<any[]>([]);
    const [workoutData, setWorkoutData] = useState<Record<string, Record<number, SeriesData>>>({});
    const [painLevels, setPainLevels] = useState<Record<string, number>>({});
    const [notes, setNotes] = useState<Record<string, string>>({});
    const [sessionRPE, setSessionRPE] = useState<number>(5);
    const [activeVideo, setActiveVideo] = useState<string | null>(null);
    const [selectedWorkout, setSelectedWorkout] = useState<any>(null); // The workout currently being viewed/performed
    const [loadingWorkouts, setLoadingWorkouts] = useState(true);
    const [collapsedExercises, setCollapsedExercises] = useState<Set<string>>(new Set());

    const [generalFeedback, setGeneralFeedback] = useState<any>({ notes: '', sessionRPE: 0 }); // Initialize default

    const toggleCollapse = (exerciseId: string) => {
        setCollapsedExercises(prev => {
            const next = new Set(prev);
            if (next.has(exerciseId)) next.delete(exerciseId);
            else next.add(exerciseId);
            return next;
        });
    };

    // History State
    const [workoutViewMode, setWorkoutViewMode] = useState<'active' | 'history'>('active');
    const [historyItems, setHistoryItems] = useState<any[]>([]);
    const [selectedHistoryItem, setSelectedHistoryItem] = useState<any>(null);

    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [lastHistoryData, setLastHistoryData] = useState<Record<string, Record<number, SeriesData>>>({});
    const [healthInitialTab, setHealthInitialTab] = useState<'activity' | 'composition'>('activity');

    // Derived State: Active Workouts
    const activeWorkouts = workouts.filter(w => {
        if (w.status === 'completed') return false;
        // Auto-hide if all blocks are completed (even if status isn't updated yet)
        if (w.blocks && w.blocks.length > 0 && w.completedBlocks && w.completedBlocks.length >= w.blocks.length) {
            return false;
        }
        return true;
    });

    // Derived State: Next Workout Session for Home View
    const nextWorkout = activeWorkouts[0];
    let nextSession = null;

    if (nextWorkout && nextWorkout.blocks) {
        const completedBlocks = nextWorkout.completedBlocks || [];
        const nextBlock = nextWorkout.blocks.find((b: any, idx: number) => !completedBlocks.includes(b.id || `block_${idx}`));

        if (nextBlock) {
            const exerciseNames = nextBlock.exercises?.slice(0, 3).map((e: any) => e.name).join(", ");
            nextSession = {
                workoutId: nextWorkout.id,
                workoutTitle: nextWorkout.title,
                blockTitle: nextBlock.title,
                description: `${nextBlock.exercises?.length || 0} Ejercicios: ${exerciseNames}${nextBlock.exercises?.length > 3 ? '...' : '.'}`
            };
        }
    }

    // Listen to Workouts Collection

    useEffect(() => {
        if (!user) return;

        // Query for all workouts (you might want to filter by date or status later)
        const q = query(collection(db, "users", user.uid, "workouts"));

        const unsub = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setWorkouts(data);
            setLoadingWorkouts(false);

            // If we have a selected workout, update it in real-time
            if (selectedWorkout) {
                const updated = data.find(w => w.id === selectedWorkout.id);
                if (updated) setSelectedWorkout(updated);
            }
        });

        return () => unsub();
    }, [user, selectedWorkout?.id]); // Depend on selectedWorkout.id to ensure updates but avoid loops

    // Fetch Last History for Ghost Data
    useEffect(() => {
        const fetchHistory = async () => {
            if (!user || !selectedWorkout) return;
            const history = await getLastWorkoutHistory(user.uid, selectedWorkout.id);
            if (history && history.exercises) {
                // Map history exercises to a usable structure: exerciseId -> seriesIndex -> data
                const historyMap: Record<string, Record<number, SeriesData>> = {};
                history.exercises.forEach((ex: any) => {
                    // Since we don't have stable IDs in history sometimes (snapshots), we try to match by Name if ID fails, 
                    // but for now let's assume exercise IDs are consistent or we use the array index method if structure matches.
                    // The original logic constructs snapshot with ID keys if possible? No, it uses array structure.

                    // We need to map BACK to the current workout exercise IDs.
                    // IMPORTANT: This relies on the workout structure not changing drastically. 
                    // Ideally we match by Exercise Name if IDs aren't preserved in history snapshot correctly.
                    // Let's iterate current selectedWorkout exercises to find matches in history by Name.

                    if (!selectedWorkout.blocks) return;

                    // Flatten current workout exercises to find ID by Name
                    const currentExercises: any[] = [];
                    selectedWorkout.blocks.forEach((b: any) => {
                        if (b.exercises) currentExercises.push(...b.exercises);
                    });

                    const match = currentExercises.find(ce => ce.name === ex.name);
                    if (match) {
                        // Found matching exercise in current workout
                        historyMap[match.id] = {};
                        ex.series?.forEach((s: any, idx: number) => {
                            historyMap[match.id][idx] = {
                                load: s.actualLoad || s.targetLoad || "",
                                reps: s.actualReps || s.targetReps || "",
                                rpe: s.actualRPE || "",
                                completed: true
                            };
                        });
                    }
                });
                setLastHistoryData(historyMap);
            } else {
                setLastHistoryData({});
            }
        };
        fetchHistory();
    }, [user, selectedWorkout]);


    // Listen to History Collection
    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, "users", user.uid, "workout_history"), where("status", "==", "completed")); // Add orderBy desc if index exists
        // simplified query for now to avoid index issues, client sort
        const unsub = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Sort client side to avoid missing index
            data.sort((a: any, b: any) => {
                const dateA = a.completedAt?.toMillis() || 0;
                const dateB = b.completedAt?.toMillis() || 0;
                return dateB - dateA;
            });
            setHistoryItems(data);
        });
        return () => unsub();
    }, [user]);


    const updateSeries = (exerciseId: string, setIndex: number, field: keyof SeriesData, value: string) => {
        setWorkoutData(prev => ({
            ...prev,
            [exerciseId]: {
                ...prev[exerciseId],
                [setIndex]: {
                    ...prev[exerciseId]?.[setIndex],
                    [field]: value,
                    completed: field === 'completed' ? (value === 'true') : prev[exerciseId]?.[setIndex]?.completed || false
                }
            }
        }));
    };

    const toggleComplete = (exerciseId: string, setIndex: number) => {
        const current = workoutData[exerciseId]?.[setIndex]?.completed;
        updateSeries(exerciseId, setIndex, 'completed', (!current).toString());
    };

    const handleFinishBlock = async (block: any, blockIdx: number) => {
        if (!selectedWorkout || !user) return;

        const feedback = {
            sessionRPE,
            notes: Object.values(notes).join('\n'),
            painLevels
        };

        // Filter sessionData to only include exercises in this block
        const blockExerciseIds = block.exercises.map((e: any) => e.id);
        const blockSessionData = Object.keys(workoutData)
            .filter(key => blockExerciseIds.includes(key))
            .reduce((obj: any, key) => {
                obj[key] = workoutData[key];
                return obj;
            }, {});

        try {
            const result = await finishBlock(
                user.uid,
                selectedWorkout.id,
                block.id || `block_${blockIdx}`, // Fallback ID if missing
                block.title,
                blockSessionData,
                block.exercises, // PASS FULL SCHEME FOR SNAPSHOT
                feedback
            );

            if (result && result.workoutCompleted) {
                confetti({
                    particleCount: 150,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#BC0000', '#ffffff', '#000000']
                });
                setShowSuccessModal(true);
            } else {
                alert(`¡${block.title} finalizado!`);
            }
            // UI update happens automatically due to realtime listener on 'selectedWorkout'
        } catch (error) {
            console.error("Error finishing block:", error);
            alert("Error al finalizar el bloque.");
        }
    };

    const handleFinishWorkout = async () => {
        if (!selectedWorkout || !user) return;

        const feedback = {
            sessionRPE: generalFeedback.sessionRPE || 0,
            notes: generalFeedback.notes || "",
            painLevels: painLevels
        };

        // Trigger completion logic
        await finishWorkout(
            user.uid,
            selectedWorkout.id,
            selectedWorkout.title,
            workoutData,
            feedback
        );

        // Show success modal
        setShowSuccessModal(true);
        confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#BC0000', '#ffffff', '#000000']
        });
    };

    const WorkoutListView = () => {
        if (loadingWorkouts) return <div className="p-10 text-center text-white animate-pulse">Cargando entrenamientos...</div>;

        // Filter for Active Tab
        // Logic: Status != completed OR (Scheduled for today or future)

        // Simplified based on user request: "pendiente" or "programado" (which usually means status pending)
        // Note: activeWorkouts is now calculated at top level


        return (
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                        <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">
                            Plan Semanal
                        </h2>
                        <span className="text-gray-400 text-sm">Tu hoja de ruta</span>
                    </div>

                    {/* Sub-Tabs */}
                    <div className="flex bg-gray-900/50 p-1 rounded-lg self-start md:self-auto border border-gray-800">
                        <button
                            onClick={() => setWorkoutViewMode('active')}
                            className={`px-4 py-2 rounded-md text-sm font-bold uppercase transition-all ${workoutViewMode === 'active' ? 'bg-[#BC0000] text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                        >
                            Activos
                        </button>
                        <button
                            onClick={() => setWorkoutViewMode('history')}
                            className={`px-4 py-2 rounded-md text-sm font-bold uppercase transition-all ${workoutViewMode === 'history' ? 'bg-[#BC0000] text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                        >
                            Historial
                        </button>
                    </div>
                </div>

                {workoutViewMode === 'active' ? (
                    // ACTIVE LIST
                    activeWorkouts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-20 text-center space-y-4 border border-gray-800 rounded-xl bg-gray-900/50">
                            <div className="text-6xl">🔥</div>
                            <h2 className="text-2xl font-bold text-white">Estás al día</h2>
                            <p className="text-gray-400">No tienes entrenamientos pendientes.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {activeWorkouts.map(workout => (
                                <TrainingCard
                                    key={workout.id}
                                    workout={workout}
                                    onSelect={setSelectedWorkout}
                                />
                            ))}
                        </div>
                    )
                ) : (
                    // HISTORY LIST
                    historyItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-20 text-center space-y-4 border border-gray-800 rounded-xl bg-gray-900/50">
                            <div className="text-6xl">📜</div>
                            <h2 className="text-2xl font-bold text-white">Historial Vacío</h2>
                            <p className="text-gray-400">Completa entrenamientos para verlos aquí.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {historyItems.map(item => (
                                <div
                                    key={item.id}
                                    onClick={() => setSelectedHistoryItem(item)}
                                    className="group flex flex-col md:flex-row items-start md:items-center justify-between p-6 bg-gray-900/30 border border-gray-800 rounded-xl hover:border-[#BC0000] hover:bg-black/40 cursor-pointer transition-all"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 rounded-full bg-green-900/20 text-green-500 border border-green-900/50">
                                            <CheckCircle className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg text-white group-hover:text-[#BC0000] transition-colors">{item.title}</h3>
                                            <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                                                <span className="flex items-center gap-1"><CalendarIcon className="w-3 h-3" /> {item.completedDate}</span>
                                                {item.completedAt && (
                                                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(item.completedAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 md:mt-0 flex items-center gap-2 text-[#BC0000] text-sm font-bold opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0">
                                        VER RESUMEN <ChevronRight className="w-4 h-4" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                )}
            </div>
        );
    };

    // --- History Detail View ---
    const HistoryDetailView = () => {
        if (!selectedHistoryItem) return null;
        const { exercises, generalFeedback } = selectedHistoryItem;

        return (
            <div className="bg-black/60 backdrop-blur-md border border-gray-800 rounded-xl overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-300">
                <div className="bg-gradient-to-r from-gray-900 to-black p-6 flex justify-between items-center sticky top-0 z-40 shadow-lg border-b border-gray-800">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSelectedHistoryItem(null)}
                            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors"
                        >
                            ← Volver
                        </button>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-bold text-white">{selectedHistoryItem.title}</h2>
                                <span className="text-xs font-bold text-green-500 bg-green-900/20 px-2 py-0.5 rounded border border-green-900/50">COMPLETADO</span>
                            </div>
                            <p className="text-gray-500 text-xs mt-1">{selectedHistoryItem.completedDate}</p>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-8">
                    {/* Feedback Section */}
                    {(generalFeedback?.notes || generalFeedback?.sessionRPE) && (
                        <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                            <h4 className="text-[#BC0000] text-xs font-bold uppercase mb-2">Feedback de la Sesión</h4>
                            <div className="flex flex-col sm:flex-row gap-6">
                                {generalFeedback.sessionRPE && (
                                    <div>
                                        <span className="text-gray-500 text-xs">RPE Global</span>
                                        <div className="text-2xl font-bold text-white">{generalFeedback.sessionRPE}/10</div>
                                    </div>
                                )}
                                {generalFeedback.generalNotes && (
                                    <div className="flex-1">
                                        <span className="text-gray-500 text-xs">Notas</span>
                                        <p className="text-sm text-gray-300 italic">"{generalFeedback.generalNotes}"</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Exercises List */}
                    <div className="space-y-6">
                        {exercises?.map((ex: any, i: number) => (
                            <div key={i} className="border border-gray-800 rounded-lg p-4 bg-gray-900/20">
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="font-bold text-white text-lg">{ex.name}</h3>
                                    {ex.painLevel > 0 && (
                                        <span className="text-xs text-red-400 font-bold bg-red-900/20 px-2 py-1 rounded">Dolor: {ex.painLevel}</span>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                                    {ex.series?.map((s: any, j: number) => (
                                        <div key={j} className={`p-2 rounded border text-xs ${s.completed ? 'border-green-900/30 bg-green-900/10' : 'border-gray-800 bg-gray-900'}`}>
                                            <div className="flex justify-between text-gray-500 mb-1 font-bold">
                                                <span>SET {s.setNumber}</span>
                                                <span className="text-[#BC0000]">
                                                    {s.intensityType === 'VELOCIDAD' ? 'V' : (s.intensityType || 'RPE')} {s.targetRPE}
                                                </span>
                                            </div>
                                            <div className="text-center py-1 space-y-1">
                                                <div className="flex items-center justify-center gap-2">
                                                    <div className="text-right">
                                                        <div className="text-[10px] text-gray-500 uppercase">Obj</div>
                                                        <div className="text-white/50 font-mono">{s.targetLoad || '-'}</div>
                                                    </div>
                                                    <div className="w-px h-6 bg-gray-700"></div>
                                                    <div className="text-left">
                                                        <div className="text-[10px] text-[#BC0000] uppercase font-bold">Real</div>
                                                        <div className="text-white font-bold text-lg">{s.actualLoad || '-'}</div>
                                                    </div>
                                                </div>
                                                <div className="text-xs text-center text-gray-400">
                                                    {s.actualReps || '-'} reps
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {ex.userNotes && (
                                    <div className="mt-3 text-xs text-gray-400 bg-black/30 p-2 rounded">
                                        <span className="font-bold text-gray-500">Nota:</span> {ex.userNotes}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    // --- Active Workout View (Detail) ---
    const WorkoutDetailView = ({ onFinish }: { onFinish: () => void }) => {
        if (!selectedWorkout) return null;

        const completedBlocks = selectedWorkout.completedBlocks || [];

        return (
            <div className="bg-black/60 backdrop-blur-md border border-gray-800 rounded-xl overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-300 md:pb-0 pb-32">
                {/* Header */}
                <div className="bg-gradient-to-r from-[#BC0000] to-gray-900 p-4 md:p-6 flex justify-between items-center sticky top-0 z-40 shadow-lg">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSelectedWorkout(null)}
                            className="p-2 rounded-full bg-black/20 hover:bg-black/40 text-white transition-colors"
                        >
                            <ChevronRight className="rotate-180 w-5 h-5" />
                        </button>
                        <div>
                            <h2 className="text-xl md:text-2xl font-black text-white italic tracking-tighter uppercase line-clamp-1">{selectedWorkout.title}</h2>
                            <p className="text-red-100 text-xs md:text-sm opacity-80 hidden md:block">Enfócate en la técnica y la intensidad.</p>
                        </div>
                    </div>
                </div>

                {/* Workout Content */}
                <div className="p-3 md:p-8 space-y-6 md:space-y-16">
                    {selectedWorkout.blocks?.map((block: any, blockIdx: number) => {
                        const isBlockCompleted = completedBlocks.includes(block.id || `block_${blockIdx}`);

                        return (
                            <div
                                key={block.id || blockIdx}
                                className={`space-y-4 md:space-y-6 relative transition-all ${isBlockCompleted ? 'opacity-60 grayscale' : ''}`}
                            >
                                {/* Block Header */}
                                <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                                    <h3 className="text-lg md:text-2xl font-black text-[#BC0000] uppercase tracking-wide flex items-center gap-3">
                                        <span className="text-2xl md:text-4xl opacity-20 text-white font-serif">{blockIdx + 1}</span>
                                        {block.title}
                                    </h3>
                                    {isBlockCompleted && (
                                        <div className="flex items-center gap-1 text-green-500 font-bold uppercase text-[10px] md:text-sm bg-green-900/10 px-2 py-1 rounded-full border border-green-500/30">
                                            <CheckCircle className="w-3 h-3 md:w-4 md:h-4" /> Finalizado
                                        </div>
                                    )}
                                </div>

                                {/* Exercises List (Cards) */}
                                <div className="space-y-4">
                                    {block.exercises?.map((exercise: any) => {
                                        if (exercise.isSection) {
                                            return (
                                                <div key={exercise.id} className="border-l-4 border-[#BC0000] bg-[#BC0000]/5 p-3 rounded-r-lg">
                                                    <div className="flex items-center gap-3 text-[#BC0000] font-black uppercase tracking-widest text-xs">
                                                        <LayoutTemplate className="w-4 h-4" />
                                                        {exercise.name}
                                                    </div>
                                                </div>
                                            );
                                        }

                                        const isCollapsed = collapsedExercises.has(exercise.id);

                                        return (
                                            <div key={exercise.id} className="border border-gray-800 rounded-xl bg-gray-900/10 overflow-hidden">
                                                {/* Exercise Card Header */}
                                                <div
                                                    className="p-3 bg-gray-900/50 flex justify-between items-start cursor-pointer hover:bg-gray-800/50 transition-colors"
                                                    onClick={() => toggleCollapse(exercise.id)}
                                                >
                                                    <div className="flex items-start gap-3">
                                                        {/* Video Trigger */}
                                                        {exercise.videoUrl && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setActiveVideo(exercise.videoUrl); }}
                                                                className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full bg-black/40 text-[#BC0000] border border-gray-700 hover:text-white flex items-center justify-center transition-all"
                                                            >
                                                                <Play className="w-3 h-3 fill-current" />
                                                            </button>
                                                        )}
                                                        <div>
                                                            <div className="font-bold text-white text-sm md:text-base leading-tight pr-2">{exercise.name}</div>
                                                            {exercise.rest && (
                                                                <div className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded bg-black/40 border border-gray-800">
                                                                    <Clock className="w-3 h-3 text-gray-500" />
                                                                    <span className="text-[10px] font-mono text-gray-400">{exercise.rest}</span>
                                                                </div>
                                                            )}
                                                            {exercise.notes && <div className="text-[10px] text-gray-500 italic mt-1 leading-tight line-clamp-2">{exercise.notes}</div>}
                                                        </div>
                                                    </div>
                                                    <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform ${isCollapsed ? 'rotate-0' : 'rotate-180'}`} />
                                                </div>

                                                {/* Exercise Content (Collapsible) */}
                                                {!isCollapsed && (
                                                    <div className="p-3 bg-black/20 animate-in slide-in-from-top-2 duration-200">
                                                        {/* Compact Series Grid */}
                                                        <div className="grid gap-1 mb-4">
                                                            {/* Table Header */}
                                                            <div className="grid grid-cols-[30px_1fr_1fr_1fr_30px] gap-2 mb-1 px-1 text-[9px] text-gray-500 uppercase font-bold text-center">
                                                                <div>#</div>
                                                                <div>Kg</div>
                                                                <div>Reps</div>
                                                                <div>RPE</div>
                                                                <div>Ok</div>
                                                            </div>

                                                            {exercise.series?.map((serie: any, setIdx: number) => {
                                                                const isCompleted = workoutData[exercise.id]?.[setIdx]?.completed;
                                                                const actualLoad = workoutData[exercise.id]?.[setIdx]?.load || "";

                                                                // Ghost History Logic
                                                                const prevData = lastHistoryData[exercise.id]?.[setIdx];
                                                                const placeholderLoad = serie.targetLoad || (prevData ? `${prevData.load}` : "Kg");

                                                                return (
                                                                    <div key={setIdx} className={`grid grid-cols-[30px_1fr_1fr_1fr_30px] gap-2 items-center p-1 rounded border overflow-hidden ${isCompleted ? 'bg-[#BC0000]/10 border-[#BC0000]/30' : 'bg-gray-900 border-gray-800'}`}>
                                                                        {/* Set Number */}
                                                                        <div className="text-[10px] text-gray-500 font-bold text-center">{setIdx + 1}</div>

                                                                        {/* Load Input */}
                                                                        <div>
                                                                            <DebouncedInput
                                                                                placeholder={placeholderLoad}
                                                                                disabled={isBlockCompleted}
                                                                                className={`w-full h-8 bg-black/50 border rounded text-xs text-center focus:border-[#BC0000] outline-none p-0 ${actualLoad ? 'text-white' : 'text-gray-500'}`}
                                                                                initialValue={actualLoad}
                                                                                onSave={(val) => updateSeries(exercise.id, setIdx, 'load', val)}
                                                                            />
                                                                            {/* Micro PR Indicator */}
                                                                            {(() => {
                                                                                const current = parseFloat(actualLoad);
                                                                                const prev = parseFloat(prevData?.load || "0");
                                                                                if (current && prev && current > prev) return <div className="flex justify-center -mt-1"><Trophy className="w-2 h-2 text-yellow-500" /></div>;
                                                                                return null;
                                                                            })()}
                                                                        </div>

                                                                        {/* Reps Input */}
                                                                        <DebouncedInput
                                                                            placeholder={serie.targetReps || "Reps"}
                                                                            disabled={isBlockCompleted}
                                                                            className="w-full h-8 bg-black/50 border border-gray-700 rounded text-xs text-center text-white focus:border-[#BC0000] outline-none p-0"
                                                                            initialValue={workoutData[exercise.id]?.[setIdx]?.reps || ""}
                                                                            onSave={(val) => updateSeries(exercise.id, setIdx, 'reps', val)}
                                                                        />

                                                                        {/* RPE/Intensity Display */}
                                                                        <div className="flex items-center justify-center text-[10px] font-bold text-[#BC0000]">
                                                                            {serie.targetRPE || "-"}
                                                                        </div>

                                                                        {/* Check Button */}
                                                                        <button
                                                                            onClick={() => toggleComplete(exercise.id, setIdx)}
                                                                            disabled={isBlockCompleted}
                                                                            className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${isCompleted ? 'bg-[#BC0000] text-white' : 'bg-gray-800 text-gray-500 hover:bg-gray-700'}`}
                                                                        >
                                                                            <CheckCircle className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Block Footer (Only visible if not using sticky footer for finishing block? The user asked for "Finish Entreno" in footer, not block. But blocks need to be finished too? Let's keep block finish inline for now, but maybe smaller) */}
                                {!isBlockCompleted && (
                                    <div className="flex justify-end">
                                        <button
                                            onClick={() => handleFinishBlock(block, blockIdx)}
                                            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-bold uppercase tracking-wider border border-gray-700 hover:border-gray-500"
                                        >
                                            Cerrar Bloque
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Sticky Footer for Active Workout */}
                <div className="fixed bottom-0 left-0 right-0 z-[100] bg-black/95 backdrop-blur-xl border-t border-gray-800 p-3 pb-8 md:pb-3 flex items-stretch gap-3 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] safe-area-bottom">
                    {/* Inline Rest Timer */}
                    <div className="w-1/3 max-w-[140px]">
                        <RestTimer mode="inline" />
                    </div>

                    {/* Finish Workout Button */}
                    <button
                        onClick={onFinish}
                        className="flex-1 bg-[#BC0000] hover:bg-red-700 text-white font-black text-sm uppercase tracking-widest rounded-xl shadow-lg hover:shadow-red-900/30 transition-all flex items-center justify-center gap-2"
                    >
                        <CheckCircle className="w-5 h-5" /> Finalizar Entreno
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="flex min-h-screen bg-black text-white font-sans selection:bg-[#BC0000] selection:text-white pb-24 md:pb-0">
            {/* 1. Fixed Sidebar */}
            <div className="isolate z-50">
                <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
                <MobileNav activeTab={activeTab} setActiveTab={setActiveTab} />
            </div>

            {/* 2. Main Content Area */}
            <div className="flex-1 md:pl-20 lg:pl-64 flex flex-col min-h-screen relative z-0">
                <main className="flex-1 p-4 md:px-8 lg:px-12 py-8 max-w-7xl mx-auto w-full">

                    {/* HOME VIEW */}
                    {activeTab === 'home' && (
                        <HomeView
                            userName={user?.displayName || "Atleta"}
                            onStartWorkout={() => {
                                if (nextWorkout) {
                                    setSelectedWorkout(nextWorkout);
                                }
                                setActiveTab('workout');
                            }}
                            onNavigate={(tab, subTab) => {
                                setActiveTab(tab);
                                if (tab === 'health' && subTab) {
                                    setHealthInitialTab(subTab as 'activity' | 'composition');
                                }
                            }}
                            nextSession={nextSession}
                        />
                    )}

                    {/* WORKOUT VIEW - Swaps between LIST and DETAIL and HISTORY DETAIL */}
                    {activeTab === 'workout' && (
                        selectedWorkout ? <WorkoutDetailView onFinish={handleFinishWorkout} /> :
                            selectedHistoryItem ? <HistoryDetailView /> :
                                <WorkoutListView />
                    )}

                    {/* HEALTH VIEW */}
                    {activeTab === 'health' && <HealthView initialTab={healthInitialTab} />}

                    {/* CALENDAR VIEW */}
                    {activeTab === 'calendar' && <CalendarView />}

                    {/* RESOURCES VIEW */}
                    {activeTab === 'resources' && <ResourcesView onPlayVideo={setActiveVideo} />}

                </main>
            </div>

            {/* Video Modal */}
            {activeVideo && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4" onClick={() => setActiveVideo(null)}>
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="bg-gray-900 p-2 rounded-xl w-full max-w-4xl aspect-video relative border border-gray-700 shadow-2xl flex flex-col"
                    >
                        <div className="absolute top-4 right-4 z-10">
                            <button onClick={() => setActiveVideo(null)} className="text-white hover:text-[#BC0000] font-bold text-xl drop-shadow-md">✕</button>
                        </div>
                        <div className="flex-1 flex items-center justify-center h-full bg-black rounded-lg overflow-hidden">
                            {/* Check if Youtube or Native */}
                            {(activeVideo.includes('youtube.com') || activeVideo.includes('youtu.be')) ? (
                                <iframe
                                    className="w-full h-full"
                                    src={activeVideo.replace('watch?v=', 'embed/').split('&')[0]}
                                    title="Video Player"
                                    frameBorder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                ></iframe>
                            ) : (
                                <video
                                    src={activeVideo}
                                    controls
                                    autoPlay
                                    playsInline
                                    preload="metadata"
                                    className="w-full h-full object-contain"
                                    controlsList="nodownload"
                                >
                                    Tu navegador no soporta el tag de video.
                                </video>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Success Modal */}
            {showSuccessModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
                    <div className="bg-gradient-to-br from-gray-900 to-black p-8 rounded-2xl border border-[#BC0000] shadow-[0_0_50px_rgba(188,0,0,0.4)] max-w-sm w-full text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#BC0000] to-transparent"></div>

                        <div className="text-6xl mb-4 animate-bounce">🔥</div>
                        <h2 className="text-3xl font-black text-white italic uppercase mb-2">¡Entrenamiento Completado!</h2>
                        <p className="text-gray-400 mb-8">Has destruido tus límites hoy. Buen trabajo.</p>

                        <button
                            onClick={() => {
                                setShowSuccessModal(false);
                                setSelectedWorkout(null);
                            }}
                            className="w-full py-4 bg-[#BC0000] hover:bg-red-700 text-white font-bold rounded-lg uppercase tracking-widest transition-all shadow-lg hover:shadow-red-900/40"
                        >
                            Continuar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
