"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { CheckCircle, Save, Camera } from "lucide-react";
import { useRouter } from "next/navigation";

// Reuse types from builder locally for simplicity
interface QuestionObject {
    id: string;
    type: string;
    questionText: string;
    required: boolean;
    options?: string[];
}

interface AssignedForm {
    id: string;
    templateTitle: string;
    questionsSnapshot: QuestionObject[];
    status: string;
    answers: Record<string, any>;
}

export default function FormRenderer({ formId }: { formId: string }) {
    const [form, setForm] = useState<AssignedForm | null>(null);
    const [answers, setAnswers] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const router = useRouter();

    useEffect(() => {
        console.log("FormRenderer mounted. ID:", formId);

        if (!formId) {
            console.error("No formId provided");
            setLoading(false);
            return;
        }

        const fetchForm = async () => {
            try {
                // Validate ID format if necessary (e.g. valid string)
                if (typeof formId !== 'string' || formId.trim() === '') {
                    throw new Error("ID de formulario inválido");
                }

                const docRef = doc(db, "assignedForms", formId);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    setForm({ id: snap.id, ...snap.data() } as AssignedForm);
                    setAnswers(snap.data()?.answers || {});
                } else {
                    alert("Formulario no encontrado o eliminado.");
                    router.push("/dashboard");
                }
            } catch (e: any) {
                console.error("Error fetching form:", e);
                // Don't alert on simple navigation aborts or minor issues, but do for logic errors
                if (e.message) {
                    // alert(`Error: ${e.message}`); // Optional: reduced verbosity for user
                }
            } finally {
                setLoading(false);
            }
        };
        fetchForm();
    }, [formId, router]);

    const handleAnswerChange = (qId: string, value: any) => {
        setAnswers(prev => ({ ...prev, [qId]: value }));
    };

    const handleSubmit = async () => {
        if (!form) return;

        // Validation
        for (const q of form.questionsSnapshot) {
            if (q.required && (answers[q.id] === undefined || answers[q.id] === "")) {
                alert(`La pregunta "${q.questionText}" es obligatoria.`);
                return;
            }
        }

        setSubmitting(true);
        try {
            await updateDoc(doc(db, "assignedForms", formId), {
                answers,
                status: "completed",
                completedAt: serverTimestamp()
            });
            alert("Formulario enviado correctamente");
            router.push("/dashboard");
        } catch (e) {
            console.error(e);
            alert("Error al enviar");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="p-10 text-center text-white">Cargando formulario...</div>;
    if (!form) return null;

    // Helper for uploading images
    const handleImageUpload = async (qId: string, file: File) => {
        if (!file) return;

        // Optimistic UI or separate loading could be added here
        try {
            const { storage } = await import("@/lib/firebase");
            const { ref, uploadBytes, getDownloadURL } = await import("firebase/storage");

            // Create specific path: forms/{formId}/{questionId}_{timestamp}_{filename}
            const path = `forms/${formId}/${qId}_${Date.now()}_${file.name}`;
            const storageRef = ref(storage, path);

            // Show uploading state (simple text for MVP)
            setAnswers(prev => ({ ...prev, [qId]: "Subiendo imagen..." }));

            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);

            // Save URL
            setAnswers(prev => ({ ...prev, [qId]: downloadURL }));

        } catch (error) {
            console.error("Error uploading image:", error);
            alert("Error al subir la imagen. Inténtalo de nuevo.");
            setAnswers(prev => ({ ...prev, [qId]: "" })); // Clear on error
        }
    };

    return (
        <div className="min-h-screen bg-black text-white p-4 pt-24 pb-32 max-w-2xl mx-auto">
            {/* ... other code ... */}
            <div className="space-y-6">
                {form.questionsSnapshot.map((q, idx) => (
                    <div key={q.id} className="bg-gray-900/50 p-5 rounded-xl border border-gray-800">
                        {/* ... label ... */}
                        <label className="block text-sm font-bold text-gray-200 mb-3">
                            <span className="text-[#BC0000] mr-2">{idx + 1}.</span>
                            {q.questionText}
                            {q.required && <span className="text-[#BC0000] ml-1">*</span>}
                        </label>

                        {/* RENDER INPUT BASED ON TYPE */}
                        {q.type === 'text' && (
                            <input
                                className="w-full bg-black/40 border border-gray-700 rounded-lg p-3 text-white focus:border-[#BC0000] outline-none"
                                placeholder="Tu respuesta..."
                                value={answers[q.id] || ""}
                                onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                            />
                        )}

                        {q.type === 'textarea' && (
                            <textarea
                                className="w-full bg-black/40 border border-gray-700 rounded-lg p-3 text-white focus:border-[#BC0000] outline-none h-32 resize-none"
                                placeholder="Escribe aquí..."
                                value={answers[q.id] || ""}
                                onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                            />
                        )}

                        {q.type === 'number' && (
                            <input
                                type="number"
                                className="w-full bg-black/40 border border-gray-700 rounded-lg p-3 text-white focus:border-[#BC0000] outline-none"
                                placeholder="0"
                                value={answers[q.id] || ""}
                                onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                            />
                        )}

                        {q.type === 'yes_no' && (
                            <div className="flex gap-4">
                                <button
                                    onClick={() => handleAnswerChange(q.id, "Sí")}
                                    className={`flex-1 py-3 rounded-lg border font-bold transition-all ${answers[q.id] === "Sí" ? 'bg-[#BC0000] border-[#BC0000] text-white' : 'bg-transparent border-gray-700 text-gray-400'}`}
                                >
                                    SÍ
                                </button>
                                <button
                                    onClick={() => handleAnswerChange(q.id, "No")}
                                    className={`flex-1 py-3 rounded-lg border font-bold transition-all ${answers[q.id] === "No" ? 'bg-gray-700 border-gray-600 text-white' : 'bg-transparent border-gray-700 text-gray-400'}`}
                                >
                                    NO
                                </button>
                            </div>
                        )}

                        {q.type === 'scale' && (
                            <div className="flex justify-between gap-1 overflow-x-auto pb-2">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(val => (
                                    <button
                                        key={val}
                                        onClick={() => handleAnswerChange(q.id, val)}
                                        className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full font-bold text-sm transition-all ${answers[q.id] === val ? 'bg-[#BC0000] text-white scale-110' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                                    >
                                        {val}
                                    </button>
                                ))}
                            </div>
                        )}

                        {q.type === 'photo' && (
                            <div className="border-2 border-dashed border-gray-700 rounded-lg p-6 text-center hover:border-gray-500 transition-colors cursor-pointer relative group">
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                    onChange={(e) => {
                                        if (e.target.files?.[0]) {
                                            handleImageUpload(q.id, e.target.files[0]);
                                        }
                                    }}
                                />
                                <div className="flex flex-col items-center gap-2 text-gray-400">
                                    <Camera className={`w-8 h-8 ${answers[q.id] === "Subiendo imagen..." ? 'animate-pulse text-[#BC0000]' : ''}`} />
                                    <span className="text-sm">
                                        {answers[q.id] && answers[q.id].toString().startsWith('http')
                                            ? "Imagen cargada (Click para cambiar)"
                                            : answers[q.id] === "Subiendo imagen..."
                                                ? "Subiendo..."
                                                : "Subir Foto"}
                                    </span>
                                </div>
                                {answers[q.id] && answers[q.id].toString().startsWith('http') && (
                                    <div className="mt-4 relative h-32 w-full max-w-xs mx-auto rounded-lg overflow-hidden border border-gray-700">
                                        <img src={answers[q.id]} alt="Preview" className="w-full h-full object-cover" />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full bg-[#BC0000] text-white font-bold py-4 rounded-xl mt-8 shadow-lg shadow-red-900/20 hover:bg-red-700 transition-all flex justify-center items-center gap-2 disabled:opacity-50"
            >
                {submitting ? "Enviando..." : (
                    <>
                        <CheckCircle className="w-5 h-5" /> Enviar Formulario
                    </>
                )}
            </button>
        </div>
    );
}
