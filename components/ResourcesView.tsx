"use client";

import { useState, useEffect } from "react";
import { PlayCircle, FileText, Download, Lock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, collection, query, orderBy, where, getDocs } from "firebase/firestore";

interface ResourcesViewProps {
    onPlayVideo?: (url: string) => void;
}

export default function ResourcesView({ onPlayVideo }: ResourcesViewProps) {
    const { user } = useAuth();
    const [documents, setDocuments] = useState<any[]>([]);

    // Library State
    const [categories, setCategories] = useState<any[]>([]);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [resources, setResources] = useState<any[]>([]);
    const [loadingResources, setLoadingResources] = useState(false);

    // 1. Fetch User Documents (Private Files) - Kept from original
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

    // 2. Fetch Categories
    useEffect(() => {
        const q = query(collection(db, "library_categories"), orderBy("name"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCategories(cats);
            // Select first category by default if none selected
            if (cats.length > 0 && !selectedCategoryId) {
                setSelectedCategoryId(cats[0].id);
            }
        });
        return () => unsubscribe();
    }, []);

    // 3. Fetch Video Resources based on Selection & Permissions
    useEffect(() => {
        if (!user || !selectedCategoryId) return;

        setLoadingResources(true);

        const fetchVideos = async () => {
            try {
                // Strategy: Two queries merged (Public in Cat OR Private allowed in Cat)
                // Firestore logical OR across different fields is tricky, so parallel queries are safer.

                // Query 1: Public videos in this category
                const qPublic = query(
                    collection(db, "global_resources"),
                    where("categoryId", "==", selectedCategoryId),
                    where("isPublic", "==", true)
                );

                // Query 2: Private videos where allowedUserIds contains my UID
                const qPrivate = query(
                    collection(db, "global_resources"),
                    where("categoryId", "==", selectedCategoryId),
                    where("allowedUserIds", "array-contains", user.uid)
                );

                const [snapPublic, snapPrivate] = await Promise.all([
                    getDocs(qPublic),
                    getDocs(qPrivate)
                ]);

                // Merge and deduplicate
                const results = new Map();

                snapPublic.forEach(doc => {
                    results.set(doc.id, { id: doc.id, ...doc.data() });
                });

                snapPrivate.forEach(doc => {
                    results.set(doc.id, { id: doc.id, ...doc.data() });
                });

                // Sort by createdAt desc (manual sort since we merged)
                const sorted = Array.from(results.values()).sort((a, b) => {
                    const tA = a.createdAt?.seconds || 0;
                    const tB = b.createdAt?.seconds || 0;
                    return tB - tA;
                });

                setResources(sorted);
            } catch (error) {
                console.error("Error fetching resources:", error);
            } finally {
                setLoadingResources(false);
            }
        };

        fetchVideos();
    }, [user, selectedCategoryId]);

    const handleVideoClick = (url: string, e: React.MouseEvent) => {
        if (onPlayVideo) {
            e.preventDefault();
            onPlayVideo(url);
        }
    };

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
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

            {/* Categories & Videos */}
            <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-gray-800 pb-4">
                    <h3 className="text-xl font-bold text-white border-l-4 border-[#BC0000] pl-3">
                        Videos y Clases
                    </h3>
                </div>

                {/* Categories Tabs */}
                {categories.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategoryId(cat.id)}
                                className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${selectedCategoryId === cat.id
                                        ? 'bg-[#BC0000] text-white shadow-lg'
                                        : 'bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800'
                                    }`}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="text-gray-500 text-sm">Cargando categorías...</div>
                )}

                {/* Videos Grid */}
                {loadingResources ? (
                    <div className="py-12 text-center text-gray-500 animate-pulse">Cargando videos...</div>
                ) : resources.length === 0 ? (
                    <div className="py-12 text-center text-gray-500 border border-dashed border-gray-800 rounded-xl">
                        No hay videos disponibles en esta categoría.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {resources.map((video) => (
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
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs text-gray-400 block">
                                            {video.createdAt?.seconds ? new Date(video.createdAt.seconds * 1000).toLocaleDateString() : ''}
                                        </span>
                                        {!video.isPublic && (
                                            <span className="bg-[#BC0000]/20 text-[#BC0000] text-[10px] px-1.5 py-0.5 rounded border border-[#BC0000]/20 flex items-center gap-0.5">
                                                <Lock className="w-3 h-3" /> Privado
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Play Overlay */}
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <PlayCircle className="w-12 h-12 text-[#BC0000] fill-black/50" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
