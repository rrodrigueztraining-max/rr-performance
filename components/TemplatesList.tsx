"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, deleteDoc, doc } from "firebase/firestore";
import { Plus, Edit2, Trash2, LayoutTemplate, Search, Loader2 } from "lucide-react";
import TemplateEditor from "./TemplateEditor";

export default function TemplatesList() {
    const [templates, setTemplates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // Editor State
    const [showEditor, setShowEditor] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<any | null>(null);

    useEffect(() => {
        const q = query(collection(db, "templates"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setTemplates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`¿Seguro que quieres eliminar la plantilla "${name}"?`)) return;
        try {
            await deleteDoc(doc(db, "templates", id));
        } catch (e) {
            console.error(e);
            alert("Error al eliminar.");
        }
    };

    const handleEdit = (template: any) => {
        setEditingTemplate(template);
        setShowEditor(true);
    };

    const handleCreate = () => {
        setEditingTemplate(null);
        setShowEditor(true);
    };

    const filteredTemplates = templates.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">Mis Plantillas</h2>
                    <p className="text-gray-400 text-sm">Crea sesiones reutilizables para asignarlas rápidamente.</p>
                </div>

                <button
                    onClick={handleCreate}
                    className="px-6 py-2 bg-[#BC0000] text-white rounded-lg font-bold text-sm shadow-[0_0_10px_rgba(188,0,0,0.3)] hover:bg-red-700 transition-all flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" /> Nueva Plantilla
                </button>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                <input
                    type="text"
                    placeholder="Buscar plantilla..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full md:w-1/3 bg-black/40 border border-gray-800 rounded-lg pl-10 pr-4 py-2 text-white focus:border-[#BC0000] focus:outline-none transition-colors"
                />
            </div>

            {/* Grid */}
            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="animate-spin text-[#BC0000] w-8 h-8" />
                </div>
            ) : filteredTemplates.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-gray-800 rounded-xl">
                    <LayoutTemplate className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <h3 className="text-gray-400 font-medium">No tienes plantillas creadas.</h3>
                    <p className="text-xs text-gray-500 mt-1">Crea una para agilizar tu trabajo.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredTemplates.map((template) => (
                        <div
                            key={template.id}
                            className="bg-black/60 border border-gray-800 rounded-xl p-6 hover:border-[#BC0000]/50 transition-all group relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 bg-gradient-to-l from-black via-black/80 to-transparent pl-8">
                                <button
                                    onClick={() => handleEdit(template)}
                                    className="p-2 bg-gray-800 text-white rounded hover:bg-[#BC0000] transition-colors"
                                    title="Editar"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleDelete(template.id, template.name)}
                                    className="p-2 bg-gray-800 text-white rounded hover:bg-red-600 transition-colors"
                                    title="Eliminar"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="mb-4">
                                <h3 className="text-lg font-bold text-white mb-1 group-hover:text-[#BC0000] transition-colors">{template.name}</h3>
                                {template.description && <p className="text-xs text-gray-500 line-clamp-2">{template.description}</p>}
                            </div>

                            <div className="space-y-3">
                                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Ejercicios ({template.exercises?.length || 0})</div>
                                <div className="space-y-1">
                                    {template.exercises?.slice(0, 3).map((ex: any, i: number) => (
                                        <div key={i} className="text-sm text-gray-300 flex items-center gap-2">
                                            <div className="w-1 h-1 rounded-full bg-[#BC0000]" />
                                            <span className="truncate">{ex.name}</span>
                                        </div>
                                    ))}
                                    {(template.exercises?.length || 0) > 3 && (
                                        <div className="text-xs text-gray-500 pl-3">
                                            + {(template.exercises?.length || 0) - 3} más...
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Editor Modal */}
            {showEditor && (
                <TemplateEditor
                    initialData={editingTemplate}
                    templateId={editingTemplate?.id}
                    onClose={() => setShowEditor(false)}
                    onSaveSuccess={() => {
                        // Toast or notification could go here
                    }}
                />
            )}
        </div>
    );
}
