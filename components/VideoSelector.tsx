"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { Search, PlayCircle, X } from "lucide-react";

interface VideoSelectorProps {
    onSelect: (videoUrl: string) => void;
    onClose: () => void;
}

export default function VideoSelector({ onSelect, onClose }: VideoSelectorProps) {
    const [resources, setResources] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("Todos");

    // Fetch Resources
    useEffect(() => {
        const q = query(collection(db, "global_resources"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setResources(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Filter Logic
    const filteredResources = resources.filter(res => {
        const matchesSearch = res.title.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === "Todos" || res.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const categories = ["Todos", ...Array.from(new Set(resources.map(r => r.category)))];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl relative">

                {/* Header */}
                <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/90 rounded-t-xl z-10">
                    <div>
                        <h3 className="text-xl font-bold text-white">Seleccionar Video</h3>
                        <p className="text-gray-400 text-sm">Elige un video de la biblioteca para este ejercicio</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full transition-colors text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Filters */}
                <div className="p-4 bg-gray-900/50 border-b border-gray-800 flex gap-4 flex-wrap">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Buscar ejercicio..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-black/50 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white focus:border-[#BC0000] focus:outline-none"
                            autoFocus
                        />
                    </div>
                    <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="bg-black/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-[#BC0000] focus:outline-none"
                    >
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="text-center py-20 text-gray-500 animate-pulse">Cargando biblioteca...</div>
                    ) : filteredResources.length === 0 ? (
                        <div className="text-center py-20 text-gray-500">
                            No se encontraron videos. <br /> Sube videos en la sección "Recursos" primero.
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {filteredResources.map((res) => (
                                <div
                                    key={res.id}
                                    onClick={() => onSelect(res.videoUrl)}
                                    className="group relative bg-black border border-gray-800 rounded-lg overflow-hidden hover:border-[#BC0000] cursor-pointer transition-all hover:scale-[1.02]"
                                >
                                    {/* Thumbnail */}
                                    <div className="aspect-video relative">
                                        <img src={res.thumbnailUrl} alt={res.title} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <PlayCircle className="w-10 h-10 text-white/80 group-hover:text-[#BC0000] transition-colors drop-shadow-md" />
                                        </div>
                                    </div>

                                    {/* Info */}
                                    <div className="p-3">
                                        <div className="text-[10px] text-[#BC0000] font-bold uppercase truncate">{res.category}</div>
                                        <div className="text-sm font-bold text-white line-clamp-2 leading-tight">{res.title}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
