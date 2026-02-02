import { useState, useEffect } from "react";
import { X, Search, CheckCircle, Send } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { FormTemplate } from "./FormBuilder";

interface FormAssignmentModalProps {
    template: FormTemplate;
    onClose: () => void;
}

interface Client {
    id: string;
    email: string;
    fullName?: string;
    displayName?: string; // Fallback
}

export default function FormAssignmentModal({ template, onClose }: FormAssignmentModalProps) {
    const [clients, setClients] = useState<Client[]>([]);
    const [selectedClients, setSelectedClients] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [sending, setSending] = useState(false);

    useEffect(() => {
        const fetchClients = async () => {
            const querySnapshot = await getDocs(collection(db, "users"));
            const fetched: Client[] = [];
            querySnapshot.forEach(doc => {
                const data = doc.data();
                // Basic filtering for "clients" if you have a role field, otherwise fetch all users
                if (data.role === 'client' || !data.role) { // Assuming 'client' is default or explicit
                    fetched.push({ id: doc.id, email: data.email, fullName: data.fullName, displayName: data.displayName });
                }
            });
            setClients(fetched);
        };
        fetchClients();
    }, []);

    const toggleClient = (id: string) => {
        setSelectedClients(prev =>
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
    };

    const handleAssign = async () => {
        if (selectedClients.length === 0) return;
        setSending(true);
        try {
            const promises = selectedClients.map(clientId => {
                return addDoc(collection(db, "assignedForms"), {
                    clientId,
                    templateId: template.id,
                    templateTitle: template.title, // store snapshot of title
                    status: 'pending',
                    answers: {},
                    assignedAt: serverTimestamp(),
                    questionsSnapshot: template.questions // Snapshot questions in case template changes later
                });
            });
            await Promise.all(promises);
            alert(`Formulario asignado a ${selectedClients.length} clientes.`);
            onClose();
        } catch (e) {
            console.error(e);
            alert("Error al asignar");
        } finally {
            setSending(false);
        }
    };

    const filteredClients = clients.filter(c =>
        (c.fullName || c.displayName || c.email || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-gray-900 w-full max-w-lg rounded-xl border border-gray-700 shadow-2xl flex flex-col max-h-[80vh]">
                <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-white">Asignar Formulario</h3>
                        <p className="text-sm text-gray-400">"{template.title}"</p>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-4 border-b border-gray-800">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                            placeholder="Buscar cliente..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-black/30 border border-gray-700 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:border-[#BC0000]"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {filteredClients.map(client => {
                        const isSelected = selectedClients.includes(client.id);
                        return (
                            <div
                                key={client.id}
                                onClick={() => toggleClient(client.id)}
                                className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all border ${isSelected ? 'bg-[#BC0000]/10 border-[#BC0000]' : 'bg-gray-800/50 border-gray-800 hover:border-gray-600'}`}
                            >
                                <div>
                                    <p className="font-bold text-gray-200">{client.fullName || client.displayName || "Sin Nombre"}</p>
                                    <p className="text-xs text-gray-500">{client.email}</p>
                                </div>
                                {isSelected && <CheckCircle className="w-5 h-5 text-[#BC0000]" />}
                            </div>
                        );
                    })}
                </div>

                <div className="p-6 border-t border-gray-800 flex justify-between items-center bg-gray-900/50">
                    <span className="text-sm text-gray-400">
                        {selectedClients.length} seleccionados
                    </span>
                    <button
                        onClick={handleAssign}
                        disabled={selectedClients.length === 0 || sending}
                        className="px-6 py-2 bg-[#BC0000] hover:bg-red-700 text-white font-bold rounded-lg disabled:opacity-50 flex items-center gap-2"
                    >
                        <Send className="w-4 h-4" />
                        {sending ? "Enviando..." : "Asignar"}
                    </button>
                </div>
            </div>
        </div>
    );
}
