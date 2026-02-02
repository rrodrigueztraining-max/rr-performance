"use client";

import { useState, useRef } from "react";
import { Plus, Trash2, Save, Video, GripVertical, Clock, List, LayoutTemplate, X, ChevronDown } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp, collection, addDoc, updateDoc } from "firebase/firestore";
import VideoSelector from "./VideoSelector";

// Reuse interfaces from WorkoutEditor where possible or define new ones for Templates
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

interface TemplateEditorProps {
    onClose: () => void;
    initialData?: any; // If editing an existing template
    templateId?: string; // If editing
    onSaveSuccess?: () => void;
}

export default function TemplateEditor({ onClose, initialData, templateId, onSaveSuccess }: TemplateEditorProps) {
    const [name, setName] = useState(initialData?.name || "");
    const [description, setDescription] = useState(initialData?.description || "");
    const [exercises, setExercises] = useState<Exercise[]>(initialData?.exercises || []);

    const [saving, setSaving] = useState(false);
    const [isReorderMode, setIsReorderMode] = useState(false);

    // Video Selection State
    const [showVideoSelector, setShowVideoSelector] = useState(false);
    const [currentExerciseIdForVideo, setCurrentExerciseIdForVideo] = useState<string | null>(null);

    // --- Actions ---

    const handleOpenVideoSelector = (exId: string) => {
        setCurrentExerciseIdForVideo(exId);
        setShowVideoSelector(true);
    };

    const handleVideoSelect = (videoUrl: string) => {
        if (currentExerciseIdForVideo) {
            updateExercise(currentExerciseIdForVideo, "videoUrl", videoUrl);
            setShowVideoSelector(false);
            setCurrentExerciseIdForVideo(null);
        }
    };

    const addExercise = (afterIndex?: number) => {
        const newEx: Exercise = {
            id: `ex${Date.now()}`,
            name: "",
            videoUrl: "",
            notes: "",
            rest: "90s",
            series: [{
                id: 1,
                intensityType: "RPE",
                targetRPE: 8,
                targetReps: "10-12",
                targetLoad: ""
            }]
        };

        const newExercises = [...exercises];
        if (afterIndex !== undefined) {
            newExercises.splice(afterIndex + 1, 0, newEx);
        } else {
            newExercises.push(newEx);
        }
        setExercises(newExercises);
    };

    const addSection = () => {
        const newSection: Exercise = {
            id: `sec${Date.now()}`,
            name: "NUEVA SECCIÓN",
            videoUrl: "",
            notes: "",
            rest: "",
            series: [],
            isSection: true
        };
        setExercises([...exercises, newSection]);
    };

    const deleteExercise = (exId: string) => {
        if (!confirm("¿Eliminar ejercicio?")) return;
        setExercises(exercises.filter(e => e.id !== exId));
    };

    const updateExercise = (exId: string, field: keyof Exercise, value: any) => {
        setExercises(exercises.map(ex => {
            if (ex.id === exId) {
                return { ...ex, [field]: value };
            }
            return ex;
        }));
    };

    const addSerie = (exId: string) => {
        setExercises(exercises.map(ex => {
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
        }));
    };

    const deleteSerie = (exId: string, sIdx: number) => {
        setExercises(exercises.map(ex => {
            if (ex.id === exId) {
                const newSeries = ex.series.filter((_, idx) => idx !== sIdx);
                return { ...ex, series: newSeries };
            }
            return ex;
        }));
    };

    // --- Drag and Drop ---
    const dragItem = useRef<any>(null);
    const dragOverItem = useRef<any>(null);

    const handleDragStart = (e: React.DragEvent, index: number) => {
        dragItem.current = index;
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();
        const dragIndex = dragItem.current;
        if (dragIndex === null || dragIndex === dropIndex) return;

        const newExercises = [...exercises];
        const [movedItem] = newExercises.splice(dragIndex, 1);
        newExercises.splice(dropIndex, 0, movedItem);
        setExercises(newExercises);
        dragItem.current = null;
    };


    const handleSave = async () => {
        if (!name.trim()) {
            alert("Por favor, dale un nombre a la plantilla.");
            return;
        }

        setSaving(true);
        try {
            const payload = {
                name,
                description,
                exercises,
                updatedAt: serverTimestamp()
            };

            if (templateId) {
                // Update existing
                await updateDoc(doc(db, "templates", templateId), payload);
            } else {
                // Create new
                await addDoc(collection(db, "templates"), {
                    ...payload,
                    createdAt: serverTimestamp()
                });
            }

            if (onSaveSuccess) onSaveSuccess();
            onClose();
        } catch (e) {
            console.error(e);
            alert("Error al guardar la plantilla.");
        }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col overflow-hidden animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex justify-between items-center bg-gray-900 border-b border-gray-800 p-4 shrink-0">
                <div className="flex items-center gap-4 flex-1">
                    <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                    <div className="flex-1 max-w-2xl">
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="text-xl font-bold bg-transparent text-white focus:outline-none border-b border-transparent focus:border-[#BC0000] w-full placeholder-gray-500"
                            placeholder="Nombre de la Plantilla (ej. Pectoral Hipertrofia)"
                            autoFocus={!templateId}
                        />
                        <input
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="text-sm text-gray-400 bg-transparent focus:outline-none w-full mt-1 placeholder-gray-600"
                            placeholder="Descripción opcional (ej. Enfocado en press banca)"
                        />
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={() => setIsReorderMode(!isReorderMode)}
                        className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${isReorderMode ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white bg-gray-800'}`}
                    >
                        <List className="w-4 h-4" />
                        <span className="hidden md:inline">{isReorderMode ? "Terminar" : "Organizar"}</span>
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-2 bg-[#BC0000] text-white font-bold rounded-lg hover:bg-red-700 transition-all disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? "Guardando..." : "Guardar Plantilla"}
                    </button>
                </div>
            </div>

            {/* Content Scroller */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="max-w-4xl mx-auto space-y-6">

                    {/* Add Buttons (Top) */}
                    {!isReorderMode && (
                        <div className="flex gap-4">
                            <button
                                onClick={addSection}
                                className="flex-1 py-4 border-2 border-dashed border-[#BC0000]/30 rounded-lg text-[#BC0000] hover:bg-[#BC0000]/10 transition-colors flex items-center justify-center gap-2 font-bold uppercase tracking-wider text-xs"
                            >
                                <LayoutTemplate className="w-4 h-4" /> Nueva Sección
                            </button>
                            <button
                                onClick={() => addExercise()}
                                className="flex-[2] py-4 border-2 border-dashed border-gray-700 rounded-lg text-gray-400 hover:border-[#BC0000] hover:text-white transition-colors flex items-center justify-center gap-2 font-bold uppercase tracking-wider text-xs"
                            >
                                <Plus className="w-4 h-4" /> Añadir Ejercicio
                            </button>
                        </div>
                    )}

                    {/* Exercises List */}
                    <div className="space-y-4">
                        {exercises.length === 0 && (
                            <div className="text-center py-20 text-gray-500">
                                <p>No hay ejercicios en esta plantilla.</p>
                                <p className="text-sm">Empieza añadiendo uno arriba.</p>
                            </div>
                        )}

                        {exercises.map((ex, index) => (
                            <div
                                key={ex.id}
                                draggable={isReorderMode}
                                onDragStart={(e) => handleDragStart(e, index)}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, index)}
                                className={`relative group transition-all ${isReorderMode ? 'cursor-move border-2 border-blue-500/50' : ''} ${ex.isSection ? 'bg-[#BC0000]/10 border-l-4 border-[#BC0000] p-4 rounded-r-lg' : 'bg-gray-900/50 p-6 rounded-lg border border-gray-800'}`}
                            >

                                {isReorderMode && (
                                    <div className="absolute top-2 left-2 p-1 bg-blue-500/20 text-blue-400 rounded">
                                        <GripVertical className="w-4 h-4" />
                                    </div>
                                )}

                                {ex.isSection ? (
                                    // Section Header View
                                    <div className="flex items-center gap-3">
                                        <LayoutTemplate className="w-5 h-5 text-[#BC0000]" />
                                        <input
                                            value={ex.name}
                                            onChange={(e) => updateExercise(ex.id, "name", e.target.value)}
                                            className="bg-transparent text-[#BC0000] font-black uppercase tracking-wider text-lg w-full focus:outline-none"
                                            placeholder="NOMBRE DE LA SECCIÓN"
                                            disabled={isReorderMode}
                                        />
                                        <button onClick={() => deleteExercise(ex.id)} className="text-gray-500 hover:text-red-500">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    // Exercise View
                                    <div className={`grid grid-cols-1 md:grid-cols-12 gap-6 ${isReorderMode ? 'pointer-events-none opacity-50' : ''}`}>

                                        {/* Exercise Details */}
                                        <div className="md:col-span-5 space-y-4">
                                            <div className="flex gap-2 items-start">
                                                <input
                                                    placeholder="Nombre del Ejercicio"
                                                    value={ex.name}
                                                    onChange={(e) => updateExercise(ex.id, "name", e.target.value)}
                                                    className="w-full bg-transparent text-white font-bold placeholder-gray-600 focus:outline-none text-lg border-b border-transparent focus:border-gray-700 pb-1"
                                                />
                                                <button onClick={() => deleteExercise(ex.id)} className="text-gray-600 hover:text-red-500 mt-1">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>

                                            <button
                                                onClick={() => handleOpenVideoSelector(ex.id)}
                                                className={`flex items-center gap-2 text-sm p-2 rounded w-full transition-colors ${ex.videoUrl ? 'bg-[#BC0000]/20 text-[#BC0000] hover:bg-[#BC0000]/30' : 'bg-black/30 text-gray-500 hover:text-white'}`}
                                            >
                                                <Video className="w-4 h-4" />
                                                <span className="truncate">{ex.videoUrl ? "Video Enlazado (Click para cambiar)" : "Enlazar Video de la Biblioteca"}</span>
                                            </button>

                                            <div className="flex items-center gap-2 text-sm text-gray-500 bg-black/30 p-2 rounded w-2/3">
                                                <Clock className="w-4 h-4" />
                                                <input
                                                    placeholder="Descanso (ej. 90s)"
                                                    value={ex.rest}
                                                    onChange={(e) => updateExercise(ex.id, "rest", e.target.value)}
                                                    className="w-full bg-transparent focus:outline-none text-gray-300"
                                                />
                                            </div>

                                            <textarea
                                                placeholder="Notas técnicas..."
                                                value={ex.notes}
                                                onChange={(e) => updateExercise(ex.id, "notes", e.target.value)}
                                                className="w-full bg-black/30 p-3 rounded text-sm text-gray-400 focus:outline-none resize-none h-24 border border-transparent focus:border-gray-700"
                                            />
                                        </div>

                                        {/* Series Table */}
                                        <div className="md:col-span-7 bg-black/20 p-4 rounded-lg self-start">
                                            <div className="grid grid-cols-12 gap-2 mb-2 text-[10px] uppercase font-bold text-gray-500 text-center tracking-wider">
                                                <div className="col-span-1">#</div>
                                                <div className="col-span-2">Kg</div>
                                                <div className="col-span-3">Reps</div>
                                                <div className="col-span-6">Intensidad</div>
                                            </div>
                                            <div className="space-y-2">
                                                {ex.series.map((serie, sIdx) => (
                                                    <div key={sIdx} className="grid grid-cols-12 gap-2 relative group/serie">
                                                        <div className="col-span-1 bg-gray-800 rounded flex items-center justify-center text-xs font-mono text-gray-400 py-2">
                                                            {sIdx + 1}
                                                        </div>
                                                        <div className="col-span-2">
                                                            <input
                                                                className="w-full bg-gray-800 rounded text-center text-white text-xs focus:outline-none border border-transparent focus:border-[#BC0000] py-2"
                                                                placeholder="-"
                                                                value={serie.targetLoad}
                                                                onChange={(e) => {
                                                                    const newSeries = [...ex.series];
                                                                    newSeries[sIdx].targetLoad = e.target.value;
                                                                    updateExercise(ex.id, "series", newSeries);
                                                                }}
                                                            />
                                                        </div>
                                                        <div className="col-span-3">
                                                            <input
                                                                className="w-full bg-gray-800 rounded text-center text-white text-xs focus:outline-none border border-transparent focus:border-[#BC0000] py-2"
                                                                value={serie.targetReps}
                                                                onChange={(e) => {
                                                                    const newSeries = [...ex.series];
                                                                    newSeries[sIdx].targetReps = e.target.value;
                                                                    updateExercise(ex.id, "series", newSeries);
                                                                }}
                                                            />
                                                        </div>
                                                        <div className="col-span-6 flex gap-1 relative">
                                                            <select
                                                                className="w-1/2 bg-gray-800 rounded text-center text-xs text-gray-400 focus:outline-none border border-transparent focus:border-[#BC0000] appearance-none"
                                                                value={serie.intensityType}
                                                                onChange={(e) => {
                                                                    const newSeries = [...ex.series];
                                                                    newSeries[sIdx].intensityType = e.target.value as any;
                                                                    updateExercise(ex.id, "series", newSeries);
                                                                }}
                                                            >
                                                                <option value="RPE">RPE</option>
                                                                <option value="RIR">RIR</option>
                                                                <option value="%RM">%RM</option>
                                                                <option value="VELOCIDAD">V</option>
                                                            </select>
                                                            <input
                                                                className="w-1/2 bg-gray-800 rounded text-center text-white text-xs focus:outline-none border border-transparent focus:border-[#BC0000] py-2"
                                                                value={serie.targetRPE}
                                                                onChange={(e) => {
                                                                    const newSeries = [...ex.series];
                                                                    newSeries[sIdx].targetRPE = e.target.value;
                                                                    updateExercise(ex.id, "series", newSeries);
                                                                }}
                                                            />

                                                            {/* Delete Button (Hover) */}
                                                            <button
                                                                onClick={() => deleteSerie(ex.id, sIdx)}
                                                                className="absolute -right-6 top-1/2 -translate-y-1/2 text-gray-600 hover:text-red-500 opacity-100 md:opacity-0 md:group-hover/serie:opacity-100 transition-opacity"
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                                <button
                                                    onClick={() => addSerie(ex.id)}
                                                    className="w-full py-2 text-xs text-center text-gray-500 hover:text-[#BC0000] hover:bg-[#BC0000]/10 rounded transition-colors border border-dashed border-gray-800 hover:border-[#BC0000] mt-2"
                                                >
                                                    + Añadir Serie
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* Repeat Add Buttons (Bottom for convenience) */}
                        {!isReorderMode && exercises.length > 3 && (
                            <div className="flex gap-4 pt-4 pb-20">
                                <button
                                    onClick={() => addExercise()}
                                    className="w-full py-4 border-2 border-dashed border-gray-800 rounded-lg text-gray-500 hover:border-[#BC0000] hover:text-white transition-colors flex items-center justify-center gap-2 font-bold uppercase tracking-wider text-sm"
                                >
                                    <Plus className="w-5 h-5" /> Añadir Ejercicio
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

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
