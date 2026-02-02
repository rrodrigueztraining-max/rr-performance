"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, Timestamp } from "firebase/firestore";
import { Plus, Trash2, Edit2, Scale, Activity, Ruler, Calendar, Save, X } from "lucide-react";

interface BiometricsManagerProps {
    clientId: string;
}

export default function BiometricsManager({ clientId }: BiometricsManagerProps) {
    const [metrics, setMetrics] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        weight: "",
        fatPercentage: "",
        musclePercentage: "",
        waist: "",
        hip: "",
        notes: ""
    });

    // 1. Fetch Metrics
    useEffect(() => {
        if (!clientId) return;

        const q = query(
            collection(db, "users", clientId, "biometrics"),
            orderBy("date", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMetrics(data);
        });

        return () => unsubscribe();
    }, [clientId]);

    const handleOpenModal = (metric?: any) => {
        if (metric) {
            setEditingId(metric.id);
            setFormData({
                date: metric.date,
                weight: metric.weight || "",
                fatPercentage: metric.fatPercentage || "",
                musclePercentage: metric.musclePercentage || (metric.muscleMass && metric.weight ? ((metric.muscleMass / metric.weight) * 100).toFixed(1) : ""),
                waist: metric.waist || "",
                hip: metric.hip || "",
                notes: metric.notes || ""
            });
        } else {
            setEditingId(null);
            setFormData({
                date: new Date().toISOString().split('T')[0],
                weight: "",
                fatPercentage: "",
                musclePercentage: "",
                waist: "",
                hip: "",
                notes: ""
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!formData.date || !formData.weight) {
            alert("Fecha y Peso son obligatorios.");
            return;
        }

        try {
            const weightVal = parseFloat(formData.weight);
            const musclePercentVal = formData.musclePercentage ? parseFloat(formData.musclePercentage) : null;

            // Calculate Muscle Mass in Kg if % is provided
            const calculatedMuscleMass = musclePercentVal !== null
                ? (weightVal * (musclePercentVal / 100))
                : null;

            const payload = {
                clientId,
                date: formData.date,
                weight: weightVal,
                fatPercentage: formData.fatPercentage ? parseFloat(formData.fatPercentage) : null,
                musclePercentage: musclePercentVal,
                muscleMass: calculatedMuscleMass, // Store kg for charts
                waist: formData.waist ? parseFloat(formData.waist) : null,
                hip: formData.hip ? parseFloat(formData.hip) : null,
                notes: formData.notes,
                recordedAt: Timestamp.fromDate(new Date(formData.date)) // Helper for sorting if date string fails
            };

            if (editingId) {
                await updateDoc(doc(db, "users", clientId, "biometrics", editingId), payload);
            } else {
                await addDoc(collection(db, "users", clientId, "biometrics"), payload);
            }

            setIsModalOpen(false);
        } catch (error) {
            console.error("Error saving metric:", error);
            alert("Error al guardar.");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("¿Seguro que quieres borrar esta medición?")) return;
        try {
            await deleteDoc(doc(db, "users", clientId, "biometrics", id));
        } catch (error) {
            console.error("Error deleting:", error);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header Action */}
            <div className="flex justify-between items-center bg-gray-900/50 p-4 rounded-xl border border-gray-800">
                <div>
                    <h3 className="text-white font-bold flex items-center gap-2">
                        <Activity className="text-[#BC0000]" /> Biometría y Salud
                    </h3>
                    <p className="text-xs text-gray-500">Gestiona el peso, grasa y medidas del cliente.</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="bg-[#BC0000] hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors"
                >
                    <Plus className="w-4 h-4" /> Nueva Medición
                </button>
            </div>

            {/* List Table */}
            <div className="bg-black/40 border border-gray-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left min-w-[600px]">
                        <thead className="bg-gray-900/50 text-xs text-gray-500 uppercase font-bold">
                            <tr>
                                <th className="px-6 py-3">Fecha</th>
                                <th className="px-6 py-3">Peso</th>
                                <th className="px-6 py-3">% Grasa</th>
                                <th className="px-6 py-3">% Músculo</th>
                                <th className="px-6 py-3">Cintura / Cadera</th>
                                <th className="px-6 py-3">Notas</th>
                                <th className="px-6 py-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {metrics.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                                        No hay registros. Añade la primera medición.
                                    </td>
                                </tr>
                            ) : (
                                metrics.map((item) => (
                                    <tr key={item.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="px-6 py-4 font-mono text-white whitespace-nowrap">{item.date}</td>
                                        <td className="px-6 py-4 text-white font-bold">{item.weight} kg</td>
                                        <td className="px-6 py-4 text-gray-400">{item.fatPercentage ? `${item.fatPercentage}%` : '-'}</td>
                                        <td className="px-6 py-4 text-gray-400">{item.musclePercentage ? `${item.musclePercentage}%` : (item.muscleMass ? `${((item.muscleMass / item.weight) * 100).toFixed(1)}%` : '-')}</td>
                                        <td className="px-6 py-4 text-gray-400">
                                            {item.waist ? `${item.waist}cm` : '-'}{item.hip ? ` / ${item.hip}cm` : ''}
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 italic truncate max-w-[150px]">{item.notes || '-'}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleOpenModal(item)} className="p-2 hover:bg-gray-800 rounded text-blue-400"><Edit2 className="w-4 h-4" /></button>
                                                <button onClick={() => handleDelete(item.id)} className="p-2 hover:bg-gray-800 rounded text-gray-500 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg shadow-2xl">
                        <div className="flex justify-between items-center p-6 border-b border-gray-800">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                {editingId ? <Edit2 className="text-[#BC0000]" /> : <Plus className="text-[#BC0000]" />}
                                {editingId ? "Editar Medición" : "Nueva Medición"}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white"><X className="w-6 h-6" /></button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Fecha</label>
                                <div className="flex items-center bg-black border border-gray-700 rounded px-3">
                                    <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                                    <input
                                        type="date"
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                        className="bg-transparent w-full py-3 text-white outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Peso (kg) *</label>
                                    <div className="flex items-center bg-black border border-gray-700 rounded px-3 focus-within:border-[#BC0000]">
                                        <Scale className="w-4 h-4 text-gray-400 mr-2" />
                                        <input
                                            type="number"
                                            value={formData.weight}
                                            onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                                            placeholder="0.0"
                                            className="bg-transparent w-full py-3 text-white outline-none font-bold"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 uppercase font-bold block mb-1">% Grasa</label>
                                    <div className="flex items-center bg-black border border-gray-700 rounded px-3 focus-within:border-[#BC0000]">
                                        <Activity className="w-4 h-4 text-gray-400 mr-2" />
                                        <input
                                            type="number"
                                            value={formData.fatPercentage}
                                            onChange={(e) => setFormData({ ...formData, fatPercentage: e.target.value })}
                                            placeholder="%"
                                            className="bg-transparent w-full py-3 text-white outline-none"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 uppercase font-bold block mb-1">% Músculo</label>
                                    <div className="flex items-center bg-black border border-gray-700 rounded px-3 focus-within:border-[#BC0000]">
                                        <Activity className="w-4 h-4 text-gray-400 mr-2" />
                                        <input
                                            type="number"
                                            value={formData.musclePercentage}
                                            onChange={(e) => setFormData({ ...formData, musclePercentage: e.target.value })}
                                            placeholder="%"
                                            className="bg-transparent w-full py-3 text-white outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Cintura (cm)</label>
                                    <div className="flex items-center bg-black border border-gray-700 rounded px-3 focus-within:border-[#BC0000]">
                                        <Ruler className="w-4 h-4 text-gray-400 mr-2" />
                                        <input
                                            type="number"
                                            value={formData.waist}
                                            onChange={(e) => setFormData({ ...formData, waist: e.target.value })}
                                            placeholder="cm"
                                            className="bg-transparent w-full py-3 text-white outline-none"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Cadera (cm)</label>
                                    <div className="flex items-center bg-black border border-gray-700 rounded px-3 focus-within:border-[#BC0000]">
                                        <Ruler className="w-4 h-4 text-gray-400 mr-2" />
                                        <input
                                            type="number"
                                            value={formData.hip}
                                            onChange={(e) => setFormData({ ...formData, hip: e.target.value })}
                                            placeholder="cm"
                                            className="bg-transparent w-full py-3 text-white outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Notas</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="Comentarios sobre la medición..."
                                    className="w-full bg-black border border-gray-700 rounded p-3 text-white h-24 resize-none focus:border-[#BC0000] outline-none"
                                />
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-800 flex justify-end gap-3">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded text-gray-400 hover:text-white font-bold">Cancelar</button>
                            <button onClick={handleSave} className="px-6 py-2 bg-[#BC0000] hover:bg-red-700 text-white rounded font-bold flex items-center gap-2">
                                <Save className="w-4 h-4" /> Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
