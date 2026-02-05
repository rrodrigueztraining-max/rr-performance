"use client";

import { useState, useEffect, useRef } from "react";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp, where, getDocs } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { Trash2, Upload, Video, Image as ImageIcon, Plus, PlayCircle, Loader2, Users, Globe, Lock, FolderPlus } from "lucide-react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

export default function CoachResourceManager() {
    // Resources & Data
    const [resources, setResources] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [clients, setClients] = useState<any[]>([]);

    // UI Loading States
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [compressing, setCompressing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState("");

    // Form State
    const [title, setTitle] = useState("");
    const [categoryId, setCategoryId] = useState("");
    const [isPublic, setIsPublic] = useState(true);
    const [allowedUserIds, setAllowedUserIds] = useState<string[]>([]);

    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [thumbFile, setThumbFile] = useState<File | null>(null);

    // New Category State
    const [isCreatingCategory, setIsCreatingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState("");

    const ffmpegRef = useRef(new FFmpeg());
    const [ffmpegLoaded, setFfmpegLoaded] = useState(false);

    // Initialize FFmpeg
    const loadFfmpeg = async () => {
        try {
            const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
            const ffmpeg = ffmpegRef.current;
            ffmpeg.on("progress", ({ progress }) => {
                setProgress(Math.round(progress * 100));
            });
            await ffmpeg.load({
                coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
                wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
            });
            setFfmpegLoaded(true);
        } catch (e) {
            console.error("Failed to load FFmpeg. Compression will be skipped.", e);
            setFfmpegLoaded(false);
        }
    };

    useEffect(() => {
        loadFfmpeg();
    }, []);

    // 1. Fetch Categories
    useEffect(() => {
        const q = query(collection(db, "library_categories"), orderBy("name"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCategories(cats);
            if (cats.length > 0 && !categoryId) {
                setCategoryId(cats[0].id);
            }
        });
        return () => unsubscribe();
    }, []);

    // 2. Fetch Clients
    useEffect(() => {
        const fetchClients = async () => {
            try {
                // Query all users, client-side filter is fine for this list size usually
                const q = query(collection(db, "users"));
                const snapshot = await getDocs(q);
                const loadedClients: any[] = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.role === 'client') {
                        loadedClients.push({ id: doc.id, displayName: data.displayName || "Usuario", email: data.email });
                    }
                });
                setClients(loadedClients);
            } catch (error) {
                console.error("Error fetching clients:", error);
            }
        };
        fetchClients();
    }, []);

    // 3. Fetch Resources
    useEffect(() => {
        const q = query(collection(db, "global_resources"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setResources(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleCreateCategory = async () => {
        if (!newCategoryName.trim()) return;
        try {
            await addDoc(collection(db, "library_categories"), {
                name: newCategoryName.trim(),
                createdAt: serverTimestamp()
            });
            setNewCategoryName("");
            setIsCreatingCategory(false);
        } catch (error) {
            console.error("Error creating category:", error);
            alert("Error al crear categoría");
        }
    };

    const compressVideo = async (file: File): Promise<Blob> => {
        const ffmpeg = ffmpegRef.current;
        if (!ffmpegLoaded) await loadFfmpeg();

        setStatusText("Optimizando video para web...");
        setCompressing(true);
        setProgress(0);

        const inputName = "input.mp4";
        const outputName = "output.mp4";

        await ffmpeg.writeFile(inputName, await fetchFile(file));

        await ffmpeg.exec([
            "-i", inputName,
            "-vf", "scale=1280:-2",
            "-c:v", "libx264",
            "-crf", "28",
            "-preset", "ultrafast",
            "-c:a", "aac",
            "-b:a", "128k",
            outputName
        ]);

        const data = await ffmpeg.readFile(outputName);
        setCompressing(false);
        return new Blob([data as any], { type: "video/mp4" });
    };

    const handleUpload = async () => {
        if (!title || !videoFile || !thumbFile || !categoryId) {
            alert("Por favor completa el título, selecciona categoría y ambos archivos.");
            return;
        }

        if (!isPublic && allowedUserIds.length === 0) {
            alert("Si el video es privado, debes seleccionar al menos un cliente.");
            return;
        }

        setUploading(true);
        try {
            // Compress logic
            let fileToUpload: File | Blob = videoFile;
            const isMov = videoFile.name.toLowerCase().endsWith('.mov') || videoFile.type === 'video/quicktime';
            if (isMov || videoFile.size > 5 * 1024 * 1024) {
                try {
                    fileToUpload = await compressVideo(videoFile);
                } catch (e) {
                    console.error("Optim failed", e);
                    setStatusText("Fallo optimización, subiendo original...");
                }
            }

            setStatusText("Subiendo archivos...");

            // Uploads
            const videoPath = `resources/videos/${Date.now()}_compressed.mp4`;
            const videoSnap = await uploadBytes(ref(storage, videoPath), fileToUpload);
            const videoUrl = await getDownloadURL(videoSnap.ref);

            const thumbPath = `resources/thumbnails/${Date.now()}_${thumbFile.name}`;
            const thumbSnap = await uploadBytes(ref(storage, thumbPath), thumbFile);
            const thumbUrl = await getDownloadURL(thumbSnap.ref);

            // Firestore
            const selectedCat = categories.find(c => c.id === categoryId);

            await addDoc(collection(db, "global_resources"), {
                title,
                categoryId,
                category: selectedCat ? selectedCat.name : "General", // Legacy/Display support
                videoUrl,
                thumbnailUrl: thumbUrl,
                isPublic,
                allowedUserIds: isPublic ? [] : allowedUserIds,
                createdAt: serverTimestamp(),
            });

            // Reset
            setTitle("");
            setVideoFile(null);
            setThumbFile(null);
            setAllowedUserIds([]);
            setIsPublic(true);
            setProgress(0);
            setStatusText("");
            alert("¡Recurso subido exitosamente!");

        } catch (error: any) {
            console.error("Upload Error:", error);
            alert("Error: " + error.message);
        } finally {
            setUploading(false);
            setCompressing(false);
            setStatusText("");
        }
    };

    const handleDelete = async (id: string, videoUrl: string, thumbnailUrl: string) => {
        if (!confirm("¿Eliminar recurso irreversiblemente? This is irreversible.")) return;
        try {
            if (videoUrl) await deleteObject(ref(storage, videoUrl)).catch(console.error);
            if (thumbnailUrl) await deleteObject(ref(storage, thumbnailUrl)).catch(console.error);
            await deleteDoc(doc(db, "global_resources", id));
            alert("Recurso eliminado.");
        } catch (e) {
            console.error(e);
            alert("Error al eliminar.");
        }
    };

    const toggleClient = (uid: string) => {
        setAllowedUserIds(prev =>
            prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
        );
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">Biblioteca Global</h2>
                <p className="text-gray-400 text-sm">Gestiona videos, categorías y permisos de acceso para tus clientes.</p>
            </div>

            {/* Upload Form */}
            <div className={`bg-black/40 border ${uploading ? 'border-[#BC0000] shadow-[0_0_15px_rgba(188,0,0,0.2)]' : 'border-gray-800'} rounded-xl p-6 transition-all`}>
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    {uploading ? <Loader2 className="animate-spin text-[#BC0000]" /> : <Plus className="text-[#BC0000]" />}
                    {uploading ? statusText : "Nuevo Video"}
                </h3>

                {uploading && (
                    <div className="mb-6">
                        <div className="flex justify-between text-xs text-gray-400 mb-2 font-bold uppercase">
                            <span>Progreso</span>
                            <span>{progress}%</span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                            <div className="bg-[#BC0000] h-full transition-all duration-300" style={{ width: `${progress}%` }} />
                        </div>
                    </div>
                )}

                <div className={`grid grid-cols-1 lg:grid-cols-2 gap-8 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>

                    {/* LEFT: Metadata & Files */}
                    <div className="space-y-6">
                        {/* Title */}
                        <div>
                            <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Título</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-800 rounded p-3 text-white focus:border-[#BC0000] focus:outline-none"
                                placeholder="Ej: Técnica de Sentadilla..."
                            />
                        </div>

                        {/* Category */}
                        <div>
                            <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Categoría</label>
                            <div className="flex gap-2">
                                <select
                                    value={categoryId}
                                    onChange={(e) => setCategoryId(e.target.value)}
                                    className="flex-1 bg-gray-900 border border-gray-800 rounded p-3 text-white focus:border-[#BC0000] focus:outline-none"
                                >
                                    <option value="" disabled>Seleccionar Carpeta...</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                <button
                                    onClick={() => setIsCreatingCategory(!isCreatingCategory)}
                                    className="p-3 bg-gray-800 rounded hover:bg-gray-700 text-white"
                                    title="Nueva Carpeta"
                                >
                                    <FolderPlus className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Create Category Input */}
                            {isCreatingCategory && (
                                <div className="mt-2 flex gap-2 animate-in fade-in slide-in-from-top-1">
                                    <input
                                        type="text"
                                        value={newCategoryName}
                                        onChange={(e) => setNewCategoryName(e.target.value)}
                                        placeholder="Nombre de nueva carpeta"
                                        className="flex-1 bg-gray-900 border border-gray-800 rounded p-2 text-sm text-white focus:border-[#BC0000] focus:outline-none"
                                    />
                                    <button
                                        onClick={handleCreateCategory}
                                        className="px-4 py-2 bg-[#BC0000] text-white text-xs font-bold rounded"
                                    >
                                        Crear
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Files */}
                        <div className="grid grid-cols-2 gap-4">
                            {/* Video */}
                            <div className="relative group">
                                <input
                                    type="file"
                                    accept="video/*"
                                    id="video-upload"
                                    onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                                    className="hidden"
                                />
                                <label htmlFor="video-upload" className={`block p-4 border-2 border-dashed rounded-lg cursor-pointer text-center transition-all ${videoFile ? 'border-[#BC0000] bg-[#BC0000]/10' : 'border-gray-800 hover:border-gray-600'}`}>
                                    <Video className={`w-6 h-6 mx-auto mb-2 ${videoFile ? 'text-[#BC0000]' : 'text-gray-500'}`} />
                                    <div className="text-xs font-bold text-white truncate">{videoFile ? videoFile.name : "Video"}</div>
                                </label>
                            </div>

                            {/* Thumbnail */}
                            <div className="relative group">
                                <input
                                    type="file"
                                    accept="image/*"
                                    id="thumb-upload"
                                    onChange={(e) => setThumbFile(e.target.files?.[0] || null)}
                                    className="hidden"
                                />
                                <label htmlFor="thumb-upload" className={`block p-4 border-2 border-dashed rounded-lg cursor-pointer text-center transition-all ${thumbFile ? 'border-[#BC0000] bg-[#BC0000]/10' : 'border-gray-800 hover:border-gray-600'}`}>
                                    <ImageIcon className={`w-6 h-6 mx-auto mb-2 ${thumbFile ? 'text-[#BC0000]' : 'text-gray-500'}`} />
                                    <div className="text-xs font-bold text-white truncate">{thumbFile ? thumbFile.name : "Portada"}</div>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: Permissions */}
                    <div className="space-y-4 bg-gray-900/50 p-4 rounded-xl border border-gray-800">
                        <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Visibilidad</label>

                        <div className="flex gap-4 mb-4">
                            <label className={`flex-1 cursor-pointer p-3 rounded-lg border transition-all flex items-center gap-3 ${isPublic ? 'bg-[#BC0000]/20 border-[#BC0000]' : 'bg-gray-900 border-gray-800 hover:bg-gray-800'}`}>
                                <input
                                    type="radio"
                                    className="hidden"
                                    checked={isPublic}
                                    onChange={() => setIsPublic(true)}
                                />
                                <Globe className={`w-5 h-5 ${isPublic ? 'text-[#BC0000]' : 'text-gray-500'}`} />
                                <div>
                                    <div className={`text-sm font-bold ${isPublic ? 'text-white' : 'text-gray-400'}`}>Público</div>
                                    <div className="text-xs text-gray-500">Visible para todos</div>
                                </div>
                            </label>

                            <label className={`flex-1 cursor-pointer p-3 rounded-lg border transition-all flex items-center gap-3 ${!isPublic ? 'bg-[#BC0000]/20 border-[#BC0000]' : 'bg-gray-900 border-gray-800 hover:bg-gray-800'}`}>
                                <input
                                    type="radio"
                                    className="hidden"
                                    checked={!isPublic}
                                    onChange={() => setIsPublic(false)}
                                />
                                <Lock className={`w-5 h-5 ${!isPublic ? 'text-[#BC0000]' : 'text-gray-500'}`} />
                                <div>
                                    <div className={`text-sm font-bold ${!isPublic ? 'text-white' : 'text-gray-400'}`}>Privado</div>
                                    <div className="text-xs text-gray-500">Solo seleccionados</div>
                                </div>
                            </label>
                        </div>

                        {/* Client Selector (Only if Private) */}
                        {!isPublic && (
                            <div className="animate-in fade-in slide-in-from-top-2">
                                <div className="text-xs text-gray-400 mb-2 font-bold px-1">SELECCIONAR CLIENTES ({allowedUserIds.length})</div>
                                <div className="max-h-48 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
                                    {clients.map(client => (
                                        <label key={client.id} className="flex items-center gap-3 p-2 rounded hover:bg-gray-800 cursor-pointer transition-colors">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 rounded border-gray-600 text-[#BC0000] focus:ring-[#BC0000] bg-gray-700"
                                                checked={allowedUserIds.includes(client.id)}
                                                onChange={() => toggleClient(client.id)}
                                            />
                                            <div className="text-sm">
                                                <div className="text-white font-medium">{client.displayName}</div>
                                                <div className="text-[10px] text-gray-500">{client.email}</div>
                                            </div>
                                        </label>
                                    ))}
                                    {clients.length === 0 && <div className="text-xs text-gray-500 italic p-2">No se encontraron clientes.</div>}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-8 flex justify-end">
                    <button
                        onClick={handleUpload}
                        disabled={uploading}
                        className={`px-8 py-3 bg-[#BC0000] text-white font-bold rounded-lg hover:bg-red-700 transition-all flex items-center gap-2 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {uploading ? (
                            <><Loader2 className="w-5 h-5 animate-spin" /> Procesando...</>
                        ) : (
                            <><Upload className="w-5 h-5" /> Publicar Recurso</>
                        )}
                    </button>
                </div>
            </div>

            {/* Resources List */}
            <div className="space-y-6">
                <h3 className="text-xl font-bold text-white border-l-4 border-[#BC0000] pl-3">Videos Publicados</h3>

                {resources.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 border border-dashed border-gray-800 rounded-xl">
                        No hay videos en la biblioteca.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {resources.map((res) => (
                            <div key={res.id} className="group relative bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-[#BC0000] transition-all">
                                {/* Thumbnail */}
                                <div className="aspect-video relative bg-black">
                                    <img src={res.thumbnailUrl} alt={res.title} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                                    <div className="absolute top-2 left-2 flex gap-1">
                                        {res.isPublic ? (
                                            <span className="bg-green-500/20 text-green-400 text-[10px] font-bold px-2 py-0.5 rounded border border-green-500/30">PÚBLICO</span>
                                        ) : (
                                            <span className="bg-red-500/20 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded border border-red-500/30 flex items-center gap-1">
                                                <Lock className="w-3 h-3" /> {(res.allowedUserIds || []).length} CLIENTES
                                            </span>
                                        )}
                                    </div>
                                    <div className="absolute top-2 right-2">
                                        <button
                                            onClick={() => handleDelete(res.id, res.videoUrl, res.thumbnailUrl)}
                                            className="p-2 bg-red-900/80 text-white rounded-full hover:bg-red-600 transition-colors"
                                            title="Eliminar"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Info */}
                                <div className="p-4">
                                    <div className="text-xs text-[#BC0000] font-bold uppercase tracking-wider mb-1">{res.category || "General"}</div>
                                    <h4 className="font-bold text-white line-clamp-2 text-sm" title={res.title}>{res.title}</h4>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
