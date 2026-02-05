import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Save, Video, GripVertical, Clock, LayoutTemplate, Copy, CheckCircle, List, ChevronDown } from "lucide-react";
import { db, auth } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp, collection, addDoc, query, where, getDocs } from "firebase/firestore";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableItem } from "./SortableItem";

interface WorkoutEditorProps {
    clientId: string;
    onClose: () => void;
    initialData?: any;
    workoutId?: string;
}

interface Serie {
    id: number;
    intensityType: "RPE" | "RIR" | "%RM" | "VELOCIDAD";
    targetRPE: string | number;
    targetReps: string;
    targetLoad: string;
}

interface Exercise {
    id: string;
    name: string;
    videoUrl: string;
    notes: string;
    rest: string;
    series: Serie[];
    isSection?: boolean;
}

interface Block {
    id: string;
    title: string;
    exercises: Exercise[];
}

import VideoSelector from "./VideoSelector";
import TemplateSelector from "./TemplateSelector";
import ImportWorkoutModal from "./ImportWorkoutModal";

export default function WorkoutEditor({ clientId, onClose, initialData, workoutId }: WorkoutEditorProps) {
    const [title, setTitle] = useState(initialData?.title || "");
    const [blocks, setBlocks] = useState<Block[]>(initialData?.blocks || []);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isReorderMode, setIsReorderMode] = useState(false);
    const [expandedBlocks, setExpandedBlocks] = useState<{ [key: string]: boolean }>({});

    // Video Selection State
    const [showVideoSelector, setShowVideoSelector] = useState(false);
    const [currentExerciseIdForVideo, setCurrentExerciseIdForVideo] = useState<{ blockId: string, exId: string } | null>(null);

    // Template Selector State (For inserting into specific block)
    const [showTemplateSelector, setShowTemplateSelector] = useState(false);
    const [targetBlockIdForTemplate, setTargetBlockIdForTemplate] = useState<string | null>(null);

    // Advanced Import Modal State (For creating new blocks)
    const [showImportModal, setShowImportModal] = useState(false);

    // Sensors for Dnd-Kit with strict activation constraint
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // Critical for distinguishing clicks from drags
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Load existing data if editing specific logic
    useEffect(() => {
        if (!initialData && workoutId) {
            // Fetch logic if needed, but usually passed via props
        }
    }, [workoutId]);

    const handleImport = (data: { title: string; exercises?: any[]; blocks?: any[] }) => {
        const newBlocks: Block[] = [];

        // Case A: Import Blocks (Preferred for Templates/Full Plans)
        if (data.blocks && data.blocks.length > 0) {
            data.blocks.forEach((block: any) => {
                const newB: Block = {
                    id: `imp_blk${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                    title: block.title || "DÍA IMPORTADO",
                    exercises: (block.exercises || []).map((ex: any) => ({
                        ...ex,
                        id: `imp_ex${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        series: (ex.series || []).map((s: any) => ({ ...s }))
                    }))
                };
                newBlocks.push(newB);
            });
        }
        // Case B: Import Flat Exercises (History Snapshot or simple list)
        else if (data.exercises && data.exercises.length > 0) {
            const newExercises = data.exercises.map((ex: any) => ({
                ...ex,
                id: `imp_ex${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                series: ex.series?.map((s: any) => ({ ...s })) || []
            }));

            newBlocks.push({
                id: `imp_blk${Date.now()}`,
                title: `COPIA DE: ${data.title}`,
                exercises: newExercises
            });
        }

        if (newBlocks.length > 0) {
            setBlocks([...blocks, ...newBlocks]);

            // Auto expand new blocks
            const newExpanded = { ...expandedBlocks };
            newBlocks.forEach(b => { newExpanded[b.id] = true; });
            setExpandedBlocks(newExpanded);
        }

        setShowImportModal(false);
    };

    const handleOpenVideoSelector = (blockId: string, exId: string) => {
        setCurrentExerciseIdForVideo({ blockId, exId });
        setShowVideoSelector(true);
    };

    const handleVideoSelect = (videoUrl: string) => {
        if (currentExerciseIdForVideo) {
            updateExercise(currentExerciseIdForVideo.blockId, currentExerciseIdForVideo.exId, "videoUrl", videoUrl);
            setShowVideoSelector(false);
            setCurrentExerciseIdForVideo(null);
        }
    };

    const handleOpenTemplateSelector = (blockId: string) => {
        setTargetBlockIdForTemplate(blockId);
        setShowTemplateSelector(true);
    };

    const handleTemplateSelect = (template: any) => {
        if (!targetBlockIdForTemplate) return;

        // Clone exercises from template with new IDs to avoid reference issues
        const newExercises = template.exercises.map((ex: any) => ({
            ...ex,
            id: `imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            series: ex.series.map((s: any) => ({ ...s })) // Deep copy series
        }));

        setBlocks(blocks.map(b => {
            if (b.id === targetBlockIdForTemplate) {
                return {
                    ...b,
                    exercises: [...b.exercises, ...newExercises] // Append to existing
                };
            }
            return b;
        }));

        setShowTemplateSelector(false);
        setTargetBlockIdForTemplate(null);
    };

    const addBlock = () => {
        setBlocks([...blocks, {
            id: `blk${Date.now()}`,
            title: `DÍA ${blocks.length + 1}`,
            exercises: []
        }]);
    };

    const addSection = (blockId: string) => {
        setBlocks(blocks.map(b => {
            if (b.id === blockId) {
                return {
                    ...b,
                    exercises: [...b.exercises, {
                        id: `sec${Date.now()}`,
                        name: "NUEVO BLOQUE / SECCIÓN",
                        videoUrl: "",
                        notes: "",
                        rest: "",
                        series: [],
                        isSection: true
                    }]
                };
            }
            return b;
        }));
    };

    const addExercise = (blockId: string, afterIndex?: number) => {
        setBlocks(blocks.map(b => {
            if (b.id === blockId) {
                const newEx: Exercise = {
                    id: `ex${Date.now()}`,
                    name: "",
                    videoUrl: "",
                    notes: "",
                    rest: "90s", // Default rest
                    series: [{
                        id: 1, // Start with 1 set
                        intensityType: "RPE",
                        targetRPE: 8,
                        targetReps: "10-12",
                        targetLoad: ""
                    }]
                };

                const newExercises = [...b.exercises];
                if (afterIndex !== undefined) {
                    newExercises.splice(afterIndex + 1, 0, newEx);
                } else {
                    newExercises.push(newEx);
                }

                return {
                    ...b,
                    exercises: newExercises
                };
            }
            return b;
        }));
    };

    const deleteExercise = (blockId: string, exId: string) => {
        if (!confirm("¿Eliminar ejercicio?")) return;
        setBlocks(blocks.map(b => {
            if (b.id === blockId) {
                return { ...b, exercises: b.exercises.filter(e => e.id !== exId) };
            }
            return b;
        }));
    };

    const updateExercise = (blockId: string, exId: string, field: keyof Exercise, value: any) => {
        setBlocks(blocks.map(b => {
            if (b.id === blockId) {
                return {
                    ...b,
                    exercises: b.exercises.map(ex => {
                        if (ex.id === exId) {
                            return { ...ex, [field]: value };
                        }
                        return ex;
                    })
                };
            }
            return b;
        }));
    };

    const addSerie = (blockId: string, exId: string) => {
        setBlocks(blocks.map(b => {
            if (b.id === blockId) {
                return {
                    ...b,
                    exercises: b.exercises.map(ex => {
                        if (ex.id === exId) {
                            return {
                                ...ex,
                                series: [...ex.series, {
                                    id: ex.series.length + 1,
                                    intensityType: "RPE",
                                    targetRPE: 8,
                                    targetReps: "10-12",
                                    targetLoad: ""
                                }]
                            };
                        }
                        return ex;
                    })
                };
            }
            return b;
        }));
    };

    const deleteSerie = (blockId: string, exId: string, sIdx: number) => {
        setBlocks(blocks.map(b => {
            if (b.id === blockId) {
                return {
                    ...b,
                    exercises: b.exercises.map(ex => {
                        if (ex.id === exId) {
                            const newSeries = ex.series.filter((_, idx) => idx !== sIdx);
                            return { ...ex, series: newSeries };
                        }
                        return ex;
                    })
                };
            }
            return b;
        }));
    };

    // --- DND KIT REORDER HANDLER ---
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        console.log("Drag End:", active.id, "Over:", over?.id);

        if (!over) return;
        if (active.id === over.id) return;

        // 1. Blocks Reorder
        // Check if both ids are blocks
        const activeBlockIndex = blocks.findIndex(b => b.id === active.id);
        const overBlockIndex = blocks.findIndex(b => b.id === over.id);

        if (activeBlockIndex !== -1 && overBlockIndex !== -1) {
            setBlocks((items) => {
                return arrayMove(items, activeBlockIndex, overBlockIndex);
            });
            return;
        }

        // 2. Exercise Reorder
        // We need to find which block holds the active exercise and over exercise
        let sourceBlockId = "";
        let targetBlockId = "";
        let sourceExIndex = -1;
        let targetExIndex = -1;

        // Locate Source
        blocks.forEach(b => {
            const idx = b.exercises.findIndex(e => e.id === active.id);
            if (idx !== -1) {
                sourceBlockId = b.id;
                sourceExIndex = idx;
            }
        });

        // Locate Target
        blocks.forEach(b => {
            const idx = b.exercises.findIndex(e => e.id === over.id);
            if (idx !== -1) {
                targetBlockId = b.id;
                targetExIndex = idx;
            }
        });

        // Only allow reordering within the same block for now (simplifies UX)
        // Or if different block, we move it.
        if (sourceBlockId && targetBlockId) {
            if (sourceBlockId === targetBlockId) {
                // Simple Reorder
                setBlocks(prev => {
                    return prev.map(b => {
                        if (b.id === sourceBlockId) {
                            return {
                                ...b,
                                exercises: arrayMove(b.exercises, sourceExIndex, targetExIndex)
                            };
                        }
                        return b;
                    });
                });
            } else {
                // Move to different block (Drag activeex over targetex)
                setBlocks(prev => {
                    const newBlocks = prev.map(b => ({ ...b, exercises: [...b.exercises] }));
                    const sourceBlock = newBlocks.find(b => b.id === sourceBlockId);
                    const targetBlock = newBlocks.find(b => b.id === targetBlockId);

                    if (sourceBlock && targetBlock) {
                        const [movedEx] = sourceBlock.exercises.splice(sourceExIndex, 1);
                        targetBlock.exercises.splice(targetExIndex, 0, movedEx);
                        // Auto expand target
                        setExpandedBlocks(curr => ({ ...curr, [targetBlockId]: true }));
                    }
                    return newBlocks;
                });
            }
        }
    };


    const handleSave = async () => {
        setSaving(true);
        try {
            // Determine Target Path: Update specific ID or default 'active_routine'
            const targetId = workoutId || "active_routine";

            const payload: any = {
                title,
                blocks,
                updatedAt: serverTimestamp(),
                assignedBy: "Coach",
                status: initialData?.status || "active"
            };

            // If it's a NEW publish (no workoutId) or we explicitly want to reset active_routine (implied by "Publicar")
            // We should reset the completion status so it appears as Active.
            if (!workoutId) {
                payload.completedBlocks = []; // RESET PROGRESS
                payload.status = 'active';
            }

            await setDoc(doc(db, "users", clientId, "workouts", targetId), payload, { merge: true });

            alert(`Planificación ${workoutId ? 'actualizada' : 'publicada'} correctamente`);
            onClose();
        } catch (e) {
            console.error(e);
            alert("Error al guardar el plan. Verifica permisos.");
        }
        setSaving(false);
    };

    const toggleBlockExpand = (blockId: string) => {
        setExpandedBlocks(prev => ({ ...prev, [blockId]: !prev[blockId] }));
    };

    if (loading) {
        return <div className="p-10 text-center text-gray-500 animate-pulse">Cargando planificación actual...</div>;
    }

    return (
        <div className="space-y-6 animate-in slide-in-from-right-10 duration-500 pb-20 relative">
            <header className="flex justify-between items-center bg-gray-900/50 p-6 rounded-xl border border-gray-800 backdrop-blur-md sticky top-4 z-40 shadow-2xl">
                <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="text-2xl font-bold bg-transparent text-white focus:outline-none border-b border-transparent focus:border-[#BC0000] transition-all w-full md:w-1/3 placeholder-gray-500"
                    placeholder="Nombre del Plan (ej. Mesociclo 1)"
                />
                <div className="flex gap-4 items-center">

                    {/* Import Button */}
                    <button
                        onClick={() => setShowImportModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg border border-gray-700 hover:border-[#BC0000] transition-all"
                        title="Importar desde Plantilla o Historial"
                    >
                        <Copy className="w-4 h-4 text-[#BC0000]" />
                        <span className="hidden lg:inline text-sm font-bold">Importar / Copiar</span>
                    </button>

                    <button
                        onClick={() => setIsReorderMode(!isReorderMode)}
                        className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${isReorderMode ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white bg-gray-800'}`}
                        title="Modo Organización (Arrastrar y Soltar)"
                    >
                        <List className="w-5 h-5" />
                        <span className="hidden md:inline">{isReorderMode ? "Terminar Organización" : "Organizar"}</span>
                    </button>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                    >
                        Cerrar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-2 bg-[#BC0000] text-white font-bold rounded-lg shadow-[0_0_15px_rgba(188,0,0,0.4)] hover:shadow-[0_0_25px_rgba(188,0,0,0.6)] hover:bg-red-700 transition-all disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? "Guardando..." : (workoutId ? "ACTUALIZAR PLANIFICACIÓN" : "PUBLICAR RUTINA")}
                    </button>
                </div>
            </header>

            <div className="space-y-8">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <div className="space-y-8">
                        {isReorderMode ? (
                            <div className="space-y-4 max-w-2xl mx-auto">
                                <div className="bg-blue-900/20 text-blue-200 p-4 rounded-lg flex items-center gap-3 mb-6 border border-blue-800/50">
                                    <List className="w-5 h-5 flex-shrink-0" />
                                    <p className="text-sm">
                                        <strong>Modo Organización Activo:</strong> Arrastra desde el icono de la izquierda para reordenar.
                                        Haz clic en el título de un día para ver sus ejercicios.
                                    </p>
                                </div>
                                <SortableContext
                                    items={blocks.map(b => b.id)}
                                    strategy={verticalListSortingStrategy}
                                >
                                    {blocks.map((block) => (
                                        <SortableItem key={block.id} id={block.id} className="bg-black/40 border border-gray-700 rounded-lg overflow-hidden mb-4">
                                            {/* Block Header (Draggable via SortableItem handle) */}
                                            <div className="flex items-center justify-between p-4 bg-gray-900/50">
                                                {/* Content (The SortableItem wraps this with a handle on the left) */}
                                                <div
                                                    className="flex-1 font-bold text-white uppercase text-sm cursor-pointer select-none flex justify-between items-center ml-2"
                                                    onClick={() => toggleBlockExpand(block.id)}
                                                >
                                                    <span>{block.title || "Sin Título"}</span>
                                                    <div className="flex items-center gap-3 text-gray-500 text-xs normal-case font-normal">
                                                        <span>{block.exercises.length} Ejercicios</span>
                                                        <ChevronDown className={`w-4 h-4 transition-transform ${expandedBlocks[block.id] ? 'rotate-180' : ''}`} />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Exercises List (Nested Sortable) */}
                                            {expandedBlocks[block.id] && (
                                                <div className="bg-black/20 p-2 space-y-2 border-t border-gray-800">
                                                    {block.exercises.length === 0 && <p className="text-xs text-center text-gray-600 py-2">Sin ejercicios</p>}

                                                    <SortableContext
                                                        items={block.exercises.map(e => e.id)}
                                                        strategy={verticalListSortingStrategy}
                                                    >
                                                        {block.exercises.map((ex) => (
                                                            <SortableItem
                                                                key={ex.id}
                                                                id={ex.id}
                                                                className={`rounded border pl-2 ${ex.isSection ? 'bg-[#BC0000]/10 border-[#BC0000]/30' : 'bg-gray-800/50 border-gray-800'}`}
                                                            >
                                                                <div className="flex items-center p-2">
                                                                    {ex.isSection && <LayoutTemplate className="w-4 h-4 text-[#BC0000] mr-2" />}
                                                                    <span className={`text-sm font-medium ${ex.isSection ? 'text-[#BC0000] uppercase font-bold' : 'text-gray-300'}`}>{ex.name || "Nuevo Ejercicio"}</span>
                                                                </div>
                                                            </SortableItem>
                                                        ))}
                                                    </SortableContext>
                                                </div>
                                            )}
                                        </SortableItem>
                                    ))}
                                </SortableContext>
                            </div>
                        ) : (
                            <>
                                {blocks.map((block, index) => {
                                    const isCompleted = initialData?.completedBlocks?.includes(block.id);
                                    return (
                                        <div
                                            key={block.id}
                                            className={`bg-black/40 border ${isCompleted ? 'border-green-500/50 shadow-[0_0_10px_rgba(34,197,94,0.1)]' : 'border-gray-800'} rounded-xl p-6 relative group transition-all duration-300 hover:border-gray-600`}
                                        >
                                            {isCompleted && (
                                                <div className="absolute top-0 right-0 bg-green-600 text-white text-[10px] uppercase font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg z-10 flex items-center gap-1">
                                                    <CheckCircle className="w-3 h-3" /> Completado
                                                </div>
                                            )}
                                            <div className="flex justify-between items-center mb-6">
                                                <div className="flex items-center gap-3 w-full">
                                                    <input
                                                        defaultValue={block.title}
                                                        onBlur={(e) => {
                                                            const newTitle = e.target.value;
                                                            if (newTitle !== block.title) {
                                                                setBlocks(blocks.map(b => b.id === block.id ? { ...b, title: newTitle } : b));
                                                            }
                                                        }}
                                                        className="text-xl font-bold text-[#BC0000] bg-transparent focus:outline-none uppercase tracking-wide w-full"
                                                        placeholder="NOMBRE DEL DÍA (ej. LUNES)"
                                                        disabled={isCompleted}
                                                    />
                                                </div>
                                                {!isCompleted && (
                                                    <button onClick={() => setBlocks(blocks.filter(b => b.id !== block.id))} className="text-gray-600 hover:text-red-500 ml-4">
                                                        <Trash2 className="w-5 h-5" />
                                                    </button>
                                                )}
                                            </div>

                                            <div className="space-y-4">
                                                {block.exercises.map((ex, exIndex) => {
                                                    if (ex.isSection) {
                                                        return (
                                                            <div
                                                                key={ex.id}
                                                                className="bg-[#BC0000]/10 border-l-4 border-[#BC0000] p-4 rounded-r-lg flex items-center justify-between mt-6 mb-2"
                                                            >
                                                                <div className="flex items-center gap-3 w-full">
                                                                    <LayoutTemplate className="w-5 h-5 text-[#BC0000]" />
                                                                    <input
                                                                        value={ex.name}
                                                                        onChange={(e) => updateExercise(block.id, ex.id, "name", e.target.value)}
                                                                        className="bg-transparent text-[#BC0000] font-black uppercase tracking-wider text-sm w-full focus:outline-none"
                                                                        placeholder="NOMBRE DEL BLOQUE"
                                                                    />
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <button
                                                                        onClick={() => addExercise(block.id, exIndex)}
                                                                        className="px-3 py-1 bg-[#BC0000] text-white text-xs font-bold rounded hover:bg-red-700 transition-colors whitespace-nowrap"
                                                                    >
                                                                        + Ejercicio
                                                                    </button>
                                                                    <button
                                                                        onClick={() => deleteExercise(block.id, ex.id)}
                                                                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-900/20 rounded"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    }

                                                    return (
                                                        <div
                                                            key={ex.id}
                                                            draggable={false} // Disable individual drag in Edit Mode
                                                            className="bg-gray-900/50 p-4 rounded-lg border border-gray-800 hover:border-gray-700 transition-colors ml-4"
                                                        >
                                                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">

                                                                {/* Exercise Info */}
                                                                <div className="md:col-span-5 space-y-3">
                                                                    <div className="flex gap-2">
                                                                        <div className="flex-1 space-y-2">
                                                                            <div className="flex items-center gap-2">
                                                                                <input
                                                                                    placeholder="Nombre del Ejercicio"
                                                                                    value={ex.name}
                                                                                    onChange={(e) => updateExercise(block.id, ex.id, "name", e.target.value)}
                                                                                    className="w-full bg-transparent text-white font-bold placeholder-gray-600 focus:outline-none text-lg"
                                                                                />
                                                                                <button
                                                                                    onClick={() => deleteExercise(block.id, ex.id)}
                                                                                    className="text-gray-600 hover:text-red-500 p-1 rounded hover:bg-red-500/10 transition-colors"
                                                                                    title="Eliminar ejercicio"
                                                                                >
                                                                                    <Trash2 className="w-4 h-4" />
                                                                                </button>
                                                                            </div>
                                                                            <button
                                                                                onClick={() => handleOpenVideoSelector(block.id, ex.id)}
                                                                                className={`flex items-center gap-2 text-sm p-2 rounded w-full transition-colors ${ex.videoUrl ? 'bg-[#BC0000]/20 text-[#BC0000] hover:bg-[#BC0000]/30' : 'bg-black/30 text-gray-500 hover:text-white'}`}
                                                                            >
                                                                                <Video className="w-4 h-4" />
                                                                                <span className="truncate">{ex.videoUrl ? "Video Enlazado (Click para cambiar)" : "Enlazar Video de la Biblioteca"}</span>
                                                                            </button>

                                                                            <div className="flex items-center gap-2 text-sm text-gray-500 bg-black/30 p-2 rounded w-1/2">
                                                                                <Clock className="w-4 h-4" />
                                                                                <input
                                                                                    placeholder="Descanso (ej. 90s)"
                                                                                    value={ex.rest}
                                                                                    onChange={(e) => updateExercise(block.id, ex.id, "rest", e.target.value)}
                                                                                    className="w-full bg-transparent focus:outline-none text-gray-300"
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <textarea
                                                                        placeholder="Notas técnicas / Instrucciones..."
                                                                        value={ex.notes}
                                                                        onChange={(e) => updateExercise(block.id, ex.id, "notes", e.target.value)}
                                                                        className="w-full bg-black/30 p-3 rounded text-sm text-gray-400 focus:outline-none resize-none h-20 border border-transparent focus:border-gray-700"
                                                                    />
                                                                </div>

                                                                {/* Series Table */}
                                                                <div className="md:col-span-7 bg-black/20 p-4 rounded-lg">
                                                                    <div className="grid grid-cols-12 gap-2 mb-3 text-[10px] uppercase font-bold text-gray-500 text-center tracking-wider">
                                                                        <div className="col-span-1">Serie</div>
                                                                        <div className="col-span-2">Peso (kg)</div>
                                                                        <div className="col-span-3">Reps</div>
                                                                        <div className="col-span-6">Intensidad</div>
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        {ex.series.map((serie, sIdx) => (
                                                                            <div key={sIdx} className="grid grid-cols-12 gap-2 relative group/serie">
                                                                                {/* 1. Serie Number */}
                                                                                <div className="col-span-1 bg-gray-800 rounded flex items-center justify-center text-xs font-mono text-gray-400 py-2 relative">
                                                                                    {sIdx + 1}
                                                                                    <button
                                                                                        onClick={() => deleteSerie(block.id, ex.id, sIdx)}
                                                                                        className="absolute -left-2 top-1/2 -translate-y-1/2 p-1 bg-red-900/80 text-white rounded-full opacity-0 group-hover/serie:opacity-100 transition-opacity hover:bg-red-600 shadow-sm z-10"
                                                                                        title="Eliminar serie"
                                                                                    >
                                                                                        <Trash2 className="w-3 h-3" />
                                                                                    </button>
                                                                                </div>

                                                                                {/* 2. Weight (New) */}
                                                                                <div className="col-span-2">
                                                                                    <input
                                                                                        className="w-full bg-gray-800 rounded text-center text-white text-xs focus:outline-none border border-transparent focus:border-[#BC0000] py-2"
                                                                                        placeholder="Kg"
                                                                                        value={serie.targetLoad || ""}
                                                                                        onChange={(e) => {
                                                                                            const newSeries = [...ex.series];
                                                                                            newSeries[sIdx].targetLoad = e.target.value;
                                                                                            updateExercise(block.id, ex.id, "series", newSeries);
                                                                                        }}
                                                                                    />
                                                                                </div>

                                                                                {/* 3. Reps */}
                                                                                <div className="col-span-3">
                                                                                    <input
                                                                                        className="w-full bg-gray-800 rounded text-center text-white text-xs focus:outline-none border border-transparent focus:border-[#BC0000] py-2"
                                                                                        placeholder="e.j. 10-12"
                                                                                        value={serie.targetReps}
                                                                                        onChange={(e) => {
                                                                                            const newSeries = [...ex.series];
                                                                                            newSeries[sIdx].targetReps = e.target.value;
                                                                                            updateExercise(block.id, ex.id, "series", newSeries);
                                                                                        }}
                                                                                    />
                                                                                </div>

                                                                                {/* 4. Intensity (Configurable) */}
                                                                                <div className="col-span-6 flex gap-1">
                                                                                    <select
                                                                                        className="w-1/2 bg-gray-800 rounded text-center text-xs text-gray-400 focus:outline-none border border-transparent focus:border-[#BC0000] appearance-none"
                                                                                        value={serie.intensityType || "RPE"}
                                                                                        onChange={(e) => {
                                                                                            const newSeries = [...ex.series];
                                                                                            newSeries[sIdx].intensityType = e.target.value as any;
                                                                                            updateExercise(block.id, ex.id, "series", newSeries);
                                                                                        }}
                                                                                    >
                                                                                        <option value="RPE">RPE</option>
                                                                                        <option value="RIR">RIR</option>
                                                                                        <option value="%RM">%RM</option>
                                                                                        <option value="VELOCIDAD">V (m/s)</option>
                                                                                    </select>
                                                                                    <input
                                                                                        className="w-1/2 bg-gray-800 rounded text-center text-white text-xs focus:outline-none border border-transparent focus:border-[#BC0000] py-2"
                                                                                        placeholder="Valor"
                                                                                        value={serie.targetRPE}
                                                                                        onChange={(e) => {
                                                                                            const newSeries = [...ex.series];
                                                                                            // Allow string input for flexibility (e.g. -10%)
                                                                                            newSeries[sIdx].targetRPE = e.target.value;
                                                                                            updateExercise(block.id, ex.id, "series", newSeries);
                                                                                        }}
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                        <button
                                                                            onClick={() => addSerie(block.id, ex.id)}
                                                                            className="w-full py-2 text-xs text-center text-gray-500 hover:text-[#BC0000] hover:bg-[#BC0000]/10 rounded transition-colors border border-dashed border-gray-800 hover:border-[#BC0000] mt-2"
                                                                        >
                                                                            + Añadir Serie
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                <div className="flex gap-4">
                                                    <button
                                                        onClick={() => addSection(block.id)}
                                                        className="flex-1 py-4 border-2 border-dashed border-[#BC0000]/50 rounded-lg text-[#BC0000] hover:bg-[#BC0000]/10 transition-colors flex items-center justify-center gap-2 font-bold uppercase tracking-wider text-sm"
                                                    >
                                                        <LayoutTemplate className="w-5 h-5" /> Añadir Bloque / Sección
                                                    </button>
                                                    <div className="flex-[2] flex gap-2">
                                                        <button
                                                            onClick={() => addExercise(block.id)}
                                                            className="flex-1 py-4 border-2 border-dashed border-gray-800 rounded-lg text-gray-500 hover:border-[#BC0000] hover:text-[#BC0000] transition-colors flex items-center justify-center gap-2 font-bold uppercase tracking-wider text-sm"
                                                        >
                                                            <Plus className="w-5 h-5" /> Añadir Ejercicio
                                                        </button>

                                                        {/* Template Import Button */}
                                                        <button
                                                            onClick={() => handleOpenTemplateSelector(block.id)}
                                                            className="py-4 px-6 border-2 border-dashed border-gray-800 rounded-lg text-gray-400 hover:border-[#BC0000] hover:text-[#BC0000] transition-colors flex items-center justify-center gap-2 font-bold uppercase tracking-wider text-sm"
                                                            title="Importar desde Plantilla"
                                                        >
                                                            <Copy className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                <button
                                    onClick={addBlock}
                                    className="w-full py-6 bg-gray-900 hover:bg-gray-800 rounded-xl text-gray-400 hover:text-white transition-all font-bold tracking-widest uppercase border border-gray-800 flex items-center justify-center gap-3"
                                >
                                    <Plus className="w-6 h-6" /> Crear Nuevo Día de Entrenamiento
                                </button>
                            </>
                        )}
                    </div>
                </DndContext>
            </div>

            {/* Template Selector Modal */}
            {showTemplateSelector && (
                <TemplateSelector
                    onSelect={handleTemplateSelect}
                    onClose={() => setShowTemplateSelector(false)}
                />
            )}

            {/* Advanced Import Modal */}
            {showImportModal && (
                <ImportWorkoutModal
                    clientId={clientId}
                    onImport={handleImport}
                    onClose={() => setShowImportModal(false)}
                />
            )}

            {/* Video Selector Modal */}
            {showVideoSelector && (
                <VideoSelector
                    onSelect={handleVideoSelect}
                    onClose={() => setShowVideoSelector(false)}
                />
            )}
        </div>
    );
}
