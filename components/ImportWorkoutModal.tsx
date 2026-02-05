"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, limit, getDocs, doc, getDoc } from "firebase/firestore";
import { Copy, Clock, LayoutTemplate, Briefcase, Loader2, X, Calendar, CheckCircle } from "lucide-react";

interface ImportWorkoutModalProps {
    clientId: string;
    onImport: (data: { title: string; exercises?: any[]; blocks?: any[] }) => void;
    onClose: () => void;
}

export default function ImportWorkoutModal({ clientId, onImport, onClose }: ImportWorkoutModalProps) {
    const [activeTab, setActiveTab] = useState<'templates' | 'history'>('templates');
    const [loading, setLoading] = useState(true);

    // Data
    const [templates, setTemplates] = useState<any[]>([]);
    const [history, setHistory] = useState<any[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // 1. Fetch Templates (Real-time listener not strictly necessary for this modal, acts as a picker)
                // But for consistency let's just fetch once or listen. Listening is fine.
                const templatesQuery = query(collection(db, "templates"), orderBy("createdAt", "desc"));
                const templatesSnap = await getDocs(templatesQuery);
                const templatesData = templatesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setTemplates(templatesData);

                // 2. Fetch History (Last 10)
                if (clientId) {
                    const historyQuery = query(
                        collection(db, "users", clientId, "workout_history"),
                        orderBy("completedAt", "desc"),
                        limit(10)
                    );
                    const historySnap = await getDocs(historyQuery);
                    const historyData = historySnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    setHistory(historyData);
                }
            } catch (error) {
                console.error("Error fetching import data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [clientId]);

    const handleSelect = async (item: any, type: 'template' | 'history') => {
        // Prepare data for import
        const title = item.name || item.title || "Sesión Importada";

        // Handle both flat exercises and block-based structures
        let blocks = item.blocks || [];
        let exercises = item.exercises || [];

        // Legacy Handling: If history item has NO exercises/blocks but has originalWorkoutId
        if (type === 'history' && (!blocks || blocks.length === 0) && (!exercises || exercises.length === 0) && item.originalWorkoutId) {
            try {
                setLoading(true);
                const originalRef = doc(db, "users", clientId, "workouts", item.originalWorkoutId);
                const originalSnap = await getDoc(originalRef);

                if (originalSnap.exists()) {
                    const originalData = originalSnap.data();
                    if (originalData.blocks) blocks = originalData.blocks;
                    if (originalData.exercises) exercises = originalData.exercises;
                }
            } catch (e) {
                console.error("Error fetching legacy original:", e);
                alert("No se pudo recuperar la estructura de esta sesión antigua.");
            }
        }

        onImport({ title, blocks, exercises });
        onClose();
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-2xl flex flex-col shadow-2xl relative max-h-[85vh] overflow-hidden">

                {/* Header */}
                <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900 z-10">
                    <div>
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <Copy className="text-[#BC0000] w-5 h-5" /> Importar / Copiar Sesión
                        </h3>
                        <p className="text-gray-400 text-sm">Carga una plantilla o una sesión anterior.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full transition-colors text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-800 bg-gray-900/50">
                    <button
                        onClick={() => setActiveTab('templates')}
                        className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${activeTab === 'templates' ? 'border-b-2 border-[#BC0000] text-white bg-white/5' : 'text-gray-500 hover:text-white'}`}
                    >
                        <LayoutTemplate className="w-4 h-4" /> Mis Plantillas
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${activeTab === 'history' ? 'border-b-2 border-[#BC0000] text-white bg-white/5' : 'text-gray-500 hover:text-white'}`}
                    >
                        <Clock className="w-4 h-4" /> Historial Reciente
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 bg-black/20">
                    {loading ? (
                        <div className="flex justify-center py-20">
                            <Loader2 className="animate-spin text-[#BC0000] w-8 h-8" />
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {activeTab === 'templates' && (
                                templates.length === 0 ? (
                                    <div className="text-center py-10 text-gray-500">
                                        <p>No tienes plantillas guardadas.</p>
                                        <p className="text-xs mt-1">Crea una en la pestaña "Plantillas" del dashboard.</p>
                                    </div>
                                ) : (
                                    templates.map((t) => (
                                        <button
                                            key={t.id}
                                            onClick={() => handleSelect(t, 'template')}
                                            className="w-full text-left bg-gray-800/40 border border-gray-800 p-4 rounded-lg hover:border-[#BC0000] hover:bg-gray-800 transition-all group relative overflow-hidden"
                                        >
                                            <div className="flex justify-between items-center relative z-10">
                                                <div>
                                                    <h4 className="font-bold text-white text-lg group-hover:text-[#BC0000] transition-colors">{t.name}</h4>
                                                    <div className="flex items-center gap-4 text-xs text-gray-400 mt-1">
                                                        <span className="bg-[#BC0000]/10 text-[#BC0000] px-2 py-0.5 rounded font-bold uppercase">
                                                            {(t.exercises?.length || 0) + (t.blocks?.reduce((acc: number, b: any) => acc + (b.exercises?.length || 0), 0) || 0)} Ejercicios
                                                        </span>
                                                        <span className="truncate max-w-[250px]">{t.description}</span>
                                                    </div>
                                                </div>
                                                <div className="bg-[#BC0000] text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transform translate-x-4 group-hover:translate-x-0 transition-all">
                                                    <Copy className="w-4 h-4" />
                                                </div>
                                            </div>
                                        </button>
                                    ))
                                )
                            )}

                            {activeTab === 'history' && (
                                history.length === 0 ? (
                                    <div className="text-center py-10 text-gray-500">
                                        <p>Este cliente no tiene historial de entrenamientos completados.</p>
                                    </div>
                                ) : (
                                    history.map((h) => (
                                        <button
                                            key={h.id}
                                            onClick={() => handleSelect(h, 'history')}
                                            className="w-full text-left bg-gray-800/40 border border-gray-800 p-4 rounded-lg hover:border-[#BC0000] hover:bg-gray-800 transition-all group relative overflow-hidden"
                                        >
                                            <div className="flex justify-between items-center relative z-10">
                                                <div>
                                                    <h4 className="font-bold text-white text-lg group-hover:text-[#BC0000] transition-colors flex items-center gap-2">
                                                        {h.title}
                                                        {h.completedDate && <span className="text-xs font-normal text-gray-500 bg-black/30 px-2 py-0.5 rounded border border-gray-700">{h.completedDate}</span>}
                                                    </h4>
                                                    <div className="flex items-center gap-4 text-xs text-gray-400 mt-1">
                                                        <span className="flex items-center gap-1 text-green-500">
                                                            <CheckCircle className="w-3 h-3" /> Completado
                                                        </span>
                                                        <span>
                                                            {(h.exercises?.length || 0) + (h.blocks?.reduce((acc: number, b: any) => acc + (b.exercises?.length || 0), 0) || 0)} Ejercicios
                                                        </span>
                                                        <span className="truncate max-w-[200px]">RPE: {h.feedback?.sessionRPE || 'N/A'}</span>
                                                    </div>
                                                </div>
                                                <div className="bg-[#BC0000] text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transform translate-x-4 group-hover:translate-x-0 transition-all">
                                                    <Copy className="w-4 h-4" />
                                                </div>
                                            </div>
                                        </button>
                                    ))
                                )
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
