"use client";

import { useState, useEffect } from "react";
import { PlayCircle, FileText, Download } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

// ... imports
import { collection, query, orderBy } from "firebase/firestore";

interface ResourcesViewProps {
    onPlayVideo?: (url: string) => void;
}

export default function ResourcesView({ onPlayVideo }: ResourcesViewProps) {
    const { user } = useAuth();
    const [documents, setDocuments] = useState<any[]>([]);
    const [resources, setResources] = useState<any[]>([]);

    // 1. Fetch User Documents (Private)
    useEffect(() => {
        if (!user) return;
        const userRef = doc(db, "users", user.uid);
        const unsubscribe = onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.documents && Array.isArray(data.documents)) {
                    setDocuments([...data.documents].reverse());
                } else {
                    setDocuments([]);
                }
            }
        });
        return () => unsubscribe();
    }, [user]);

    // 2. Fetch Global Resources (Public)
    useEffect(() => {
        const q = query(collection(db, "global_resources"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setResources(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, []);

    // Group items by category
    const groupedResources: Record<string, any[]> = {};
    resources.forEach(res => {
        const cat = res.category || "General";
        if (!groupedResources[cat]) groupedResources[cat] = [];
        groupedResources[cat].push(res);
    });

    const handleVideoClick = (url: string, e: React.MouseEvent) => {
        if (onPlayVideo) {
            e.preventDefault();
            onPlayVideo(url);
        }
    };

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <header>
                <h2 className="text-3xl font-bold text-white">Biblioteca RR</h2>
                <p className="text-gray-400">Recursos exclusivos para elevar tu rendimiento.</p>
            </header>

            {/* Private Documents Section */}
            {documents.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-xl font-bold text-white border-l-4 border-[#BC0000] pl-3 flex items-center gap-2">
                        <FileText /> Mis Documentos Privados
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {documents.map((doc, idx) => (
                            <a
                                key={idx}
                                href={doc.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between p-4 bg-gray-900 border border-gray-800 rounded-xl hover:border-[#BC0000] hover:bg-gray-800 transition-all group"
                            >
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="p-2 bg-black/20 rounded-lg text-[#BC0000]">
                                        <FileText className="w-6 h-6" />
                                    </div>
                                    <div className="truncate">
                                        <div className="text-white font-bold truncate">{doc.title}</div>
                                        <div className="text-xs text-gray-500">
                                            {doc.createdAt?.seconds
                                                ? new Date(doc.createdAt.seconds * 1000).toLocaleDateString()
                                                : new Date(doc.createdAt || Date.now()).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>
                                <Download className="w-5 h-5 text-gray-500 group-hover:text-white transition-colors" />
                            </a>
                        ))}
                    </div>
                </div>
            )}

            {/* Global Video Categories */}
            {Object.entries(groupedResources).length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                    Cargando biblioteca de recursos...
                </div>
            ) : Object.entries(groupedResources).map(([category, items]) => (
                <div key={category} className="space-y-4">
                    <h3 className="text-xl font-bold text-white border-l-4 border-[#BC0000] pl-3">
                        {category}
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {items.map((video) => (
                            <div
                                key={video.id}
                                onClick={(e) => handleVideoClick(video.videoUrl, e)}
                                className="group relative aspect-video bg-gray-900 rounded-lg overflow-hidden border border-gray-800 cursor-pointer hover:border-[#BC0000] transition-all hover:scale-105 duration-300 block"
                            >
                                {/* Thumbnail */}
                                {video.thumbnailUrl ? (
                                    <img src={video.thumbnailUrl} alt={video.title} className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                                ) : (
                                    <div className="absolute inset-0 bg-gray-800 opacity-50"></div>
                                )}

                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent"></div>

                                {/* Content */}
                                <div className="absolute bottom-0 left-0 p-4 w-full">
                                    <h4 className="text-white font-bold text-sm line-clamp-2 leading-tight">{video.title}</h4>
                                    <span className="text-xs text-gray-400 mt-1 block">
                                        {video.createdAt?.seconds ? new Date(video.createdAt.seconds * 1000).toLocaleDateString() : ''}
                                    </span>
                                </div>

                                {/* Play Overlay */}
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <PlayCircle className="w-12 h-12 text-[#BC0000] fill-black/50" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
