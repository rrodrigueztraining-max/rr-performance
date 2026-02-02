"use client";

import { useState, useEffect, useRef } from "react";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { Trash2, Upload, Video, Image as ImageIcon, Plus, PlayCircle, Loader2 } from "lucide-react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

const CATEGORIES = [
    "Técnica de Ejercicios",
    "Nutrición & Suplementación",
    "Mindset & Disciplina",
    "General"
];

export default function CoachResourceManager() {
    const [resources, setResources] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [compressing, setCompressing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState("");

    // Form State
    const [title, setTitle] = useState("");
    const [category, setCategory] = useState(CATEGORIES[0]);
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [thumbFile, setThumbFile] = useState<File | null>(null);

    const ffmpegRef = useRef(new FFmpeg());
    const [ffmpegLoaded, setFfmpegLoaded] = useState(false);

    // Initialize FFmpeg
    const loadFfmpeg = async () => {
        try {
            const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
            const ffmpeg = ffmpegRef.current;

            // Listen to progress
            ffmpeg.on("progress", ({ progress, time }) => {
                // progress is 0-1
                setProgress(Math.round(progress * 100));
            });

            // Try loading default core (might fail if headers missing and it tries MT)
            // For 0.12.x, we need to ensure we don't use MT if headers are missing.
            // However, 0.12 was rewritten for MT. 
            // Let's rely on the fact that if it fails, we just don't compress.
            await ffmpeg.load({
                coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
                wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
            });
            setFfmpegLoaded(true);
        } catch (e) {
            console.error("Failed to load FFmpeg (likely due to missing headers for SharedArrayBuffer). Compression will be skipped.", e);
            setFfmpegLoaded(false);
        }
    };

    useEffect(() => {
        loadFfmpeg();
    }, []);

    // Fetch Resources
    useEffect(() => {
        const q = query(collection(db, "global_resources"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setResources(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const compressVideo = async (file: File): Promise<Blob> => {
        const ffmpeg = ffmpegRef.current;
        if (!ffmpegLoaded) await loadFfmpeg();

        setStatusText("Optimizando video para web...");
        setCompressing(true);
        setProgress(0);

        const inputName = "input.mp4";
        const outputName = "output.mp4";

        await ffmpeg.writeFile(inputName, await fetchFile(file));

        // Compress command: 720p, CRF 28, AAC audio
        await ffmpeg.exec([
            "-i", inputName,
            "-vf", "scale=1280:-2", // 720p width, auto height
            "-c:v", "libx264",
            "-crf", "28",
            "-preset", "ultrafast",
            "-c:a", "aac", // Ensure AAC audio (widely supported)
            "-b:a", "128k",
            outputName
        ]);

        const data = await ffmpeg.readFile(outputName);
        setCompressing(false);

        // Cast data to any to avoid strict type mismatch with SharedArrayBuffer in some envs
        return new Blob([data as any], { type: "video/mp4" });
    };

    const handleUpload = async () => {
        if (!title || !videoFile || !thumbFile) {
            alert("Por favor completa el título y selecciona ambos archivos (Video y Portada).");
            return;
        }

        setUploading(true);
        try {
            // 1. Compress/Convert Video
            let fileToUpload: File | Blob = videoFile;

            const isMov = videoFile.name.toLowerCase().endsWith('.mov') || videoFile.type === 'video/quicktime';

            // Force conversion if it's MOV or if it's > 5MB (compression)
            if (isMov || videoFile.size > 5 * 1024 * 1024) {
                try {
                    console.log(isMov ? "Detected .mov file, converting..." : "Detected large file, compressing...");
                    fileToUpload = await compressVideo(videoFile);
                    console.log(`Optimization: ${videoFile.size / 1024 / 1024}MB -> ${fileToUpload.size / 1024 / 1024}MB`);
                } catch (e) {
                    console.error("Optimization failed, uploading raw file.", e);
                    setStatusText("Fallo en optimización, subiendo original...");
                }
            }

            setStatusText("Subiendo archivos...");

            // 2. Upload Video
            const videoPath = `resources/videos/${Date.now()}_compressed.mp4`;
            const videoRef = ref(storage, videoPath);
            const videoSnap = await uploadBytes(videoRef, fileToUpload);
            const videoUrl = await getDownloadURL(videoSnap.ref);

            // 3. Upload Thumbnail
            const thumbPath = `resources/thumbnails/${Date.now()}_${thumbFile.name}`;
            const thumbRef = ref(storage, thumbPath);
            const thumbSnap = await uploadBytes(thumbRef, thumbFile);
            const thumbUrl = await getDownloadURL(thumbSnap.ref);

            // 4. Save to Firestore
            await addDoc(collection(db, "global_resources"), {
                title,
                category,
                videoUrl,
                thumbnailUrl: thumbUrl,
                createdAt: serverTimestamp(),
                duration: "N/A"
            });

            // Reset Form
            setTitle("");
            setVideoFile(null);
            setThumbFile(null);
            setProgress(0);
            setStatusText("");
            alert("¡Recurso subido exitosamente!");

        } catch (error: any) {
            console.error("Upload Error:", error);
            alert("Error al subir el recurso: " + error.message);
        } finally {
            setUploading(false);
            setCompressing(false);
            setStatusText("");
        }
    };

    const handleDelete = async (id: string, videoUrl: string, thumbnailUrl: string) => {
        if (!confirm("¿Seguro que quieres eliminar este recurso? Esta acción es irreversible.")) return;

        try {
            // 1. Delete Video from Storage
            if (videoUrl) {
                try {
                    const videoRef = ref(storage, videoUrl);
                    await deleteObject(videoRef);
                } catch (e) {
                    console.error("Error deleting video file:", e);
                }
            }

            // 2. Delete Thumbnail from Storage
            if (thumbnailUrl) {
                try {
                    const thumbRef = ref(storage, thumbnailUrl);
                    await deleteObject(thumbRef);
                } catch (e) {
                    console.error("Error deleting thumbnail file:", e);
                }
            }

            // 3. Delete Document from Firestore
            await deleteDoc(doc(db, "global_resources", id));
            alert("Recurso eliminado correctamente.");
        } catch (error) {
            console.error("Error deleting resource:", error);
            alert("Hubo un error al eliminar el recurso.");
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">Biblioteca Global</h2>
                    <p className="text-gray-400 text-sm">Estos videos serán visibles para TODOS los clientes en su sección "Recursos".</p>
                </div>
            </div>

            {/* Upload Form */}
            <div className={`bg-black/40 border ${uploading ? 'border-[#BC0000] shadow-[0_0_15px_rgba(188,0,0,0.2)]' : 'border-gray-800'} rounded-xl p-6 transition-all`}>
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    {uploading ? <Loader2 className="animate-spin text-[#BC0000]" /> : <Plus className="text-[#BC0000]" />}
                    {uploading ? statusText : "Añadir Nuevo Video"}
                </h3>

                {uploading && (
                    <div className="mb-6">
                        <div className="flex justify-between text-xs text-gray-400 mb-2 font-bold uppercase">
                            <span>Progreso</span>
                            <span>{progress}%</span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                            <div
                                className="bg-[#BC0000] h-full transition-all duration-300 ease-out"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                )}

                <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                    {/* Left Column: Inputs */}
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Título del Video</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-800 rounded p-3 text-white focus:border-[#BC0000] focus:outline-none"
                                placeholder="Ej: Técnica de Sentadilla..."
                            />
                        </div>

                        <div>
                            <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Categoría</label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-800 rounded p-3 text-white focus:border-[#BC0000] focus:outline-none"
                            >
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Right Column: Files */}
                    <div className="space-y-4">
                        {/* Video Input */}
                        <div className="relative group">
                            <input
                                type="file"
                                accept="video/*"
                                onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                                className="hidden"
                                id="video-upload"
                            />
                            <label
                                htmlFor="video-upload"
                                className={`flex items-center gap-3 p-3 border-2 border-dashed rounded-lg cursor-pointer transition-all ${videoFile ? 'border-[#BC0000] bg-[#BC0000]/10' : 'border-gray-700 hover:border-gray-500'}`}
                            >
                                <div className="p-2 bg-black/40 rounded">
                                    <Video className={`w-5 h-5 ${videoFile ? 'text-[#BC0000]' : 'text-gray-400'}`} />
                                </div>
                                <div className="overflow-hidden">
                                    <div className="text-sm font-bold text-white truncate">{videoFile ? videoFile.name : "Seleccionar Video"}</div>
                                    <div className="text-xs text-gray-500">MP4, MOV</div>
                                </div>
                            </label>
                        </div>

                        {/* Thumbnail Input */}
                        <div className="relative group">
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => setThumbFile(e.target.files?.[0] || null)}
                                className="hidden"
                                id="thumb-upload"
                            />
                            <label
                                htmlFor="thumb-upload"
                                className={`flex items-center gap-3 p-3 border-2 border-dashed rounded-lg cursor-pointer transition-all ${thumbFile ? 'border-[#BC0000] bg-[#BC0000]/10' : 'border-gray-700 hover:border-gray-500'}`}
                            >
                                <div className="p-2 bg-black/40 rounded">
                                    <ImageIcon className={`w-5 h-5 ${thumbFile ? 'text-[#BC0000]' : 'text-gray-400'}`} />
                                </div>
                                <div className="overflow-hidden">
                                    <div className="text-sm font-bold text-white truncate">{thumbFile ? thumbFile.name : "Seleccionar Portada"}</div>
                                    <div className="text-xs text-gray-500">JPG, PNG</div>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex justify-end">
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

            {/* Existing Resources List */}
            <div className="space-y-6">
                <h3 className="text-xl font-bold text-white border-l-4 border-[#BC0000] pl-3">Videos Publicados</h3>

                {resources.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 border border-dashed border-gray-800 rounded-xl">
                        No hay videos en la biblioteca global.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {resources.map((res) => (
                            <div key={res.id} className="group relative bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-[#BC0000] transition-all">
                                {/* Thumbnail */}
                                <div className="aspect-video relative bg-black">
                                    <img src={res.thumbnailUrl} alt={res.title} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <PlayCircle className="w-12 h-12 text-white/80 group-hover:text-[#BC0000] transition-colors drop-shadow-lg" />
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
                                    <div className="text-xs text-[#BC0000] font-bold uppercase tracking-wider mb-1">{res.category}</div>
                                    <h4 className="font-bold text-white line-clamp-2" title={res.title}>{res.title}</h4>
                                    <div className="text-xs text-gray-500 mt-2">
                                        {res.createdAt?.seconds ? new Date(res.createdAt.seconds * 1000).toLocaleDateString() : 'Reciente'}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
