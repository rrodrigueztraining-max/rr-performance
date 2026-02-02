"use client";

import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { useRouter } from "next/navigation";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { FileText, CheckCircle, Clock, ChevronRight } from "lucide-react";
import Link from "next/link"; // Ensure Link is imported

export default function FormsListPage() {
    const { user, role, loading } = useAuth();
    const router = useRouter();
    const [forms, setForms] = useState<any[]>([]);
    const [loadingForms, setLoadingForms] = useState(true);
    const [viewMode, setViewMode] = useState<'pending' | 'completed'>('pending');

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
        }
    }, [user, loading, router]);

    // Fetch Forms Logic
    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, "assignedForms"),
            where("clientId", "==", user.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Client side sort by date (assignedAt or completedAt)
            setForms(fetched);
            setLoadingForms(false);
        });

        return () => unsubscribe();
    }, [user]);

    // Redirect Hook for Sidebar Logic (Since we are hijacking sidebar)
    const handleSidebarNavigation = (tab: string) => {
        // If they click anything other than 'forms', go back to dashboard
        if (tab !== 'forms') {
            router.push(`/dashboard`);
            // Ideally we could pass query param ?tab=${tab} to dashboard to open correct tab
        }
    };

    if (loading || loadingForms) {
        return <div className="min-h-screen bg-black text-white flex items-center justify-center">Cargando...</div>;
    }

    const pendingForms = forms.filter(f => f.status === 'pending');
    const completedForms = forms.filter(f => f.status === 'completed');
    const displayedForms = viewMode === 'pending' ? pendingForms : completedForms;

    return (
        <div className="flex min-h-screen bg-black text-white pb-24 md:pb-0">
            {/* Sidebar Reuse - Active Tab 'forms' */}
            <Sidebar activeTab="forms" setActiveTab={handleSidebarNavigation} />

            <div className="flex-1 md:pl-20 lg:pl-64 p-4 md:px-12 max-w-7xl mx-auto w-full animate-in fade-in slide-in-from-right duration-300">
                <header className="mb-8 mt-8">
                    <h2 className="text-gray-400 text-sm font-medium uppercase tracking-widest mb-1">Tu Espacio</h2>
                    <h1 className="text-4xl font-bold text-white flex items-center gap-3">
                        <FileText className="text-[#BC0000] w-8 h-8" /> Formularios y Revisiones
                    </h1>
                </header>

                {/* Tabs */}
                <div className="flex bg-gray-900/50 p-1 rounded-lg w-fit border border-gray-800 mb-8">
                    <button
                        onClick={() => setViewMode('pending')}
                        className={`px-6 py-2 rounded-md text-sm font-bold uppercase transition-all ${viewMode === 'pending' ? 'bg-[#BC0000] text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        Pendientes ({pendingForms.length})
                    </button>
                    <button
                        onClick={() => setViewMode('completed')}
                        className={`px-6 py-2 rounded-md text-sm font-bold uppercase transition-all ${viewMode === 'completed' ? 'bg-[#BC0000] text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        Completados ({completedForms.length})
                    </button>
                </div>

                {/* List */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {displayedForms.length === 0 ? (
                        <div className="col-span-full py-20 text-center border border-dashed border-gray-800 rounded-xl">
                            <p className="text-gray-500">No hay formularios en esta sección.</p>
                        </div>
                    ) : (
                        displayedForms.map(form => (
                            <Link
                                href={viewMode === 'pending' ? `/dashboard/forms/view?formId=${form.id}` : '#'}
                                key={form.id}
                                className={`block bg-gray-900/40 border border-gray-800 rounded-xl p-6 transition-all hover:border-[#BC0000] group relative overflow-hidden ${viewMode === 'completed' ? 'opacity-75 hover:opacity-100 cursor-default' : 'hover:bg-gray-900/60'}`}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`p-3 rounded-lg ${viewMode === 'pending' ? 'bg-yellow-900/20 text-yellow-500' : 'bg-green-900/20 text-green-500'}`}>
                                        {viewMode === 'pending' ? <Clock className="w-6 h-6" /> : <CheckCircle className="w-6 h-6" />}
                                    </div>
                                    {viewMode === 'pending' && <span className="text-xs font-bold text-[#BC0000] uppercase tracking-wide bg-[#BC0000]/10 px-2 py-1 rounded">Acción Requerida</span>}
                                </div>

                                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-[#BC0000] transition-colors">{form.templateTitle || "Formulario Sin Título"}</h3>
                                <p className="text-sm text-gray-500 mb-4">
                                    {viewMode === 'pending'
                                        ? `Asignado el: ${form.assignedAt?.toDate().toLocaleDateString()}`
                                        : `Completado el: ${form.completedAt?.toDate().toLocaleDateString()}`
                                    }
                                </p>

                                {viewMode === 'pending' && (
                                    <div className="flex items-center gap-2 text-sm font-bold text-white mt-4 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0 text-[#BC0000]">
                                        RESPONDER AHORA <ChevronRight className="w-4 h-4" />
                                    </div>
                                )}
                            </Link>
                        ))
                    )}
                </div>
            </div>
            <MobileNavWrapper />
        </div>
    );
}

function MobileNavWrapper() {
    const router = require("next/navigation").useRouter();

    // Simple navigation handler: if not forms, go to dashboard
    // We mock setActiveTab since we are not in the main dashboard context
    const handleNav = (tab: string) => {
        if (tab !== 'forms') {
            router.push('/dashboard');
        }
    };

    const MobileNav = require("@/components/MobileNav").default;

    return <MobileNav activeTab="forms" setActiveTab={handleNav} />;
}
