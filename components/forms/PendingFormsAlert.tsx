import { useState, useEffect } from "react";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import Link from "next/link";

interface PendingFormsAlertProps {
    clientId: string;
}

export default function PendingFormsAlert({ clientId }: PendingFormsAlertProps) {
    const [pendingForms, setPendingForms] = useState<any[]>([]);

    useEffect(() => {
        const fetchPending = async () => {
            const q = query(
                collection(db, "assignedForms"),
                where("clientId", "==", clientId),
                where("status", "==", "pending")
                // orderBy("assignedAt", "desc") // Requires index, optionally skip for now or ensure index exists
            );

            try {
                const snapshot = await getDocs(q);
                const forms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setPendingForms(forms);
            } catch (e) {
                console.error("Error fetching pending forms:", e);
            }
        };

        if (clientId) fetchPending();
    }, [clientId]);

    if (pendingForms.length === 0) return null;

    return (
        <div className="mb-6 space-y-2">
            {pendingForms.map(form => (
                <Link key={form.id} href={`/dashboard/forms/view?formId=${form.id}`}>
                    <div className="bg-[#BC0000]/10 border border-[#BC0000]/30 p-4 rounded-xl flex items-center justify-between hover:bg-[#BC0000]/20 transition-all cursor-pointer group">
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-[#BC0000]/20 rounded-full text-[#BC0000]">
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-bold text-white text-sm">Tarea Pendiente</h4>
                                <p className="text-[#BC0000] text-xs font-medium">Debes completar: {form.templateTitle}</p>
                            </div>
                        </div>
                        <ChevronRight className="text-gray-500 group-hover:text-white transition-colors" />
                    </div>
                </Link>
            ))}
        </div>
    );
}
