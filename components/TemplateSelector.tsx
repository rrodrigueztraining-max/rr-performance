"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { Search, Loader2, X, Copy, LayoutTemplate } from "lucide-react";

interface TemplateSelectorProps {
    onSelect: (template: any) => void;
    onClose: () => void;
}

export default function TemplateSelector({ onSelect, onClose }: TemplateSelectorProps) {
    const [templates, setTemplates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        const q = query(collection(db, "templates"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setTemplates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const filteredTemplates = templates.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-2xl flex flex-col shadow-2xl relative max-h-[80vh]">

                {/* Header */}
                <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/95 rounded-t-xl z-10">
                    <div>
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <Copy className="text-[#BC0000] w-5 h-5" /> Importar Plantilla
                        </h3>
                        <p className="text-gray-400 text-sm">Selecciona una plantilla para cargar sus ejercicios.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full transition-colors text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Search */}
                <div className="p-4 bg-gray-900/50 border-b border-gray-800">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Buscar plantilla..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-black/50 border border-gray-700 rounded-lg pl-10 pr-4 py-3 text-white focus:border-[#BC0000] focus:outline-none"
                            autoFocus
                        />
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {loading ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="animate-spin text-[#BC0000]" />
                        </div>
                    ) : filteredTemplates.length === 0 ? (
                        <div className="text-center py-10 text-gray-500">
                            No se encontraron plantillas.
                        </div>
                    ) : (
                        filteredTemplates.map((template) => (
                            <button
                                key={template.id}
                                onClick={() => onSelect(template)}
                                className="w-full text-left bg-black/40 border border-gray-800 p-4 rounded-lg hover:border-[#BC0000] hover:bg-white/5 transition-all group flex justify-between items-center"
                            >
                                <div>
                                    <h4 className="font-bold text-white group-hover:text-[#BC0000] transition-colors">{template.name}</h4>
                                    <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                                        <span className="flex items-center gap-1">
                                            <LayoutTemplate className="w-3 h-3" />
                                            {template.exercises?.length || 0} Ejercicios
                                        </span>
                                        {template.description && (
                                            <span className="truncate max-w-[200px] opacity-70 border-l border-gray-700 pl-4">
                                                {template.description}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="hidden group-hover:flex items-center text-xs font-bold text-[#BC0000] bg-[#BC0000]/10 px-3 py-1 rounded-full">
                                    IMPORTAR
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
