"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Save, Type, Image as ImageIcon, List, AlignJustify, Hash, CheckSquare, X } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, updateDoc, doc, serverTimestamp, deleteDoc } from "firebase/firestore";

// --- Types ---

export type QuestionType = "text" | "textarea" | "number" | "scale" | "yes_no" | "photo";

export interface QuestionObject {
    id: string;
    type: QuestionType;
    questionText: string;
    required: boolean;
    options?: string[]; // For future selects, not strictly used yet but good to have
}

export interface FormTemplate {
    id: string;
    title: string;
    questions: QuestionObject[];
    createdAt?: any;
}

interface FormBuilderProps {
    onClose?: () => void;
}

import FormAssignmentModal from "./FormAssignmentModal";

export default function FormBuilder({ onClose }: FormBuilderProps) {
    const [templates, setTemplates] = useState<FormTemplate[]>([]);
    const [editingTemplate, setEditingTemplate] = useState<FormTemplate | null>(null);
    const [assigningTemplate, setAssigningTemplate] = useState<FormTemplate | null>(null);
    const [loading, setLoading] = useState(false);

    // Load templates on mount
    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, "formTemplates"));
            const fetched: FormTemplate[] = [];
            querySnapshot.forEach((doc) => {
                fetched.push({ id: doc.id, ...doc.data() } as FormTemplate);
            });
            setTemplates(fetched);
        } catch (error) {
            console.error("Error fetching templates:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateNew = () => {
        setEditingTemplate({
            id: "new",
            title: "",
            questions: []
        });
    };

    const handleEdit = (template: FormTemplate) => {
        setEditingTemplate({ ...template });
    };

    const handleDelete = async (id: string) => {
        if (!confirm("¿Seguro que quieres eliminar esta plantilla?")) return;
        try {
            await deleteDoc(doc(db, "formTemplates", id));
            setTemplates(prev => prev.filter(t => t.id !== id));
        } catch (e) {
            console.error("Error deleting template:", e);
        }
    };

    // --- Editor Logic ---

    const addQuestion = (type: QuestionType) => {
        if (!editingTemplate) return;
        const newQuestion: QuestionObject = {
            id: `q_${Date.now()}`,
            type,
            questionText: "",
            required: false,
        };
        setEditingTemplate({
            ...editingTemplate,
            questions: [...editingTemplate.questions, newQuestion]
        });
    };

    const updateQuestion = (qId: string, field: keyof QuestionObject, value: any) => {
        if (!editingTemplate) return;
        setEditingTemplate({
            ...editingTemplate,
            questions: editingTemplate.questions.map(q =>
                q.id === qId ? { ...q, [field]: value } : q
            )
        });
    };

    const removeQuestion = (qId: string) => {
        if (!editingTemplate) return;
        setEditingTemplate({
            ...editingTemplate,
            questions: editingTemplate.questions.filter(q => q.id !== qId)
        });
    };

    const saveTemplate = async () => {
        if (!editingTemplate) return;
        if (!editingTemplate.title) return alert("Por favor pon un título a la plantilla");

        setLoading(true);
        try {
            const dataToSave = {
                title: editingTemplate.title,
                questions: editingTemplate.questions,
                updatedAt: serverTimestamp()
            };

            if (editingTemplate.id === "new") {
                const docRef = await addDoc(collection(db, "formTemplates"), {
                    ...dataToSave,
                    createdAt: serverTimestamp()
                });
                setTemplates([...templates, { ...editingTemplate, id: docRef.id }]);
            } else {
                await updateDoc(doc(db, "formTemplates", editingTemplate.id), dataToSave);
                setTemplates(templates.map(t => t.id === editingTemplate.id ? { ...t, ...dataToSave } as FormTemplate : t));
            }
            setEditingTemplate(null);
        } catch (e) {
            console.error("Error saving template:", e);
            alert("Error al guardar");
        } finally {
            setLoading(false);
        }
    };

    // --- Render ---

    if (editingTemplate) {
        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 bg-gray-900/90 p-6 rounded-xl border border-gray-800">
                <div className="flex justify-between items-center mb-4">
                    <input
                        className="text-2xl font-bold bg-transparent border-b border-gray-700 focus:border-[#BC0000] outline-none text-white w-full mr-4 placeholder-gray-600"
                        placeholder="Título del Formulario (ej. Check-in Semanal)"
                        value={editingTemplate.title}
                        onChange={(e) => setEditingTemplate({ ...editingTemplate, title: e.target.value })}
                    />
                    <div className="flex gap-2">
                        <button onClick={() => setEditingTemplate(null)} className="p-2 text-gray-400 hover:text-white">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                <div className="space-y-4">
                    {editingTemplate.questions.map((q, index) => (
                        <div key={q.id} className="bg-black/40 p-4 rounded-lg border border-gray-800 relative group">
                            <div className="flex gap-4 items-start">
                                <span className="bg-gray-800 text-gray-400 text-xs font-mono p-1 rounded mt-1">
                                    {index + 1}. {q.type.toUpperCase()}
                                </span>
                                <div className="flex-1 space-y-3">
                                    <input
                                        className="w-full bg-transparent text-white font-medium placeholder-gray-600 outline-none"
                                        placeholder="Escribe la pregunta aquí..."
                                        value={q.questionText}
                                        onChange={(e) => updateQuestion(q.id, "questionText", e.target.value)}
                                    />
                                    <div className="flex items-center gap-4 text-xs text-gray-400">
                                        <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                                            <input
                                                type="checkbox"
                                                checked={q.required}
                                                onChange={(e) => updateQuestion(q.id, "required", e.target.checked)}
                                                className="rounded border-gray-700 bg-gray-800 text-[#BC0000] focus:ring-[#BC0000]"
                                            />
                                            Obligatorio
                                        </label>
                                    </div>
                                </div>
                                <button
                                    onClick={() => removeQuestion(q.id)}
                                    className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-500 transition-opacity"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="border-t border-gray-800 pt-4">
                    <p className="text-sm text-gray-500 mb-3 font-bold uppercase tracking-wider">Añadir Pregunta:</p>
                    <div className="flex flex-wrap gap-2">
                        <AddQuestionBtn icon={<Type />} label="Texto Corto" onClick={() => addQuestion("text")} />
                        <AddQuestionBtn icon={<AlignJustify />} label="Párrafo" onClick={() => addQuestion("textarea")} />
                        <AddQuestionBtn icon={<Hash />} label="Número" onClick={() => addQuestion("number")} />
                        <AddQuestionBtn icon={<List />} label="Escala 1-10" onClick={() => addQuestion("scale")} />
                        <AddQuestionBtn icon={<CheckSquare />} label="Sí / No" onClick={() => addQuestion("yes_no")} />
                        <AddQuestionBtn icon={<ImageIcon />} label="Foto" onClick={() => addQuestion("photo")} />
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-6">
                    <button
                        onClick={() => setEditingTemplate(null)}
                        className="px-4 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={saveTemplate}
                        disabled={loading}
                        className="px-6 py-2 bg-[#BC0000] hover:bg-red-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        {loading ? "Guardando..." : "Guardar Plantilla"}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">Plantillas de Formularios</h2>
                <button
                    onClick={handleCreateNew}
                    className="flex items-center gap-2 px-4 py-2 bg-[#BC0000] text-white rounded-lg hover:bg-red-700 transition-colors font-bold text-sm"
                >
                    <Plus className="w-4 h-4" /> Crear Nueva
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map(t => (
                    <div key={t.id} className="bg-gray-900 border border-gray-800 p-5 rounded-xl hover:border-gray-600 transition-all group">
                        <div className="flex justify-between items-start mb-3">
                            <h3 className="font-bold text-lg text-white truncate">{t.title}</h3>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => handleEdit(t)}
                                    className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded"
                                >
                                    <List className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleDelete(t.id)}
                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-900/20 rounded"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <p className="text-sm text-gray-500 mb-4">{t.questions.length} preguntas</p>
                        <button
                            className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-sm font-medium rounded-lg transition-colors"
                            onClick={() => setAssigningTemplate(t)}
                        >
                            Asignar a Cliente
                        </button>
                    </div>
                ))}
            </div>

            {templates.length === 0 && !loading && (
                <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-800 rounded-xl">
                    <p>No hay plantillas creadas</p>
                </div>
            )}

            {assigningTemplate && (
                <FormAssignmentModal
                    template={assigningTemplate}
                    onClose={() => setAssigningTemplate(null)}
                />
            )}
        </div>
    );
}

function AddQuestionBtn({ icon, label, onClick }: { icon: any, label: string, onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-500 rounded text-xs text-gray-300 font-medium transition-all"
        >
            <span className="w-4 h-4">{icon}</span>
            {label}
        </button>
    );
}
