"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from 'next/link';
import CoachDashboard from "@/components/CoachDashboard";
import ClientDashboard from "@/components/ClientDashboard";

export default function DashboardPage() {
    const { user, role, loading, logout } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
        }
    }, [user, loading, router]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#BC0000]"></div>
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="min-h-screen bg-carbon-texture text-white">
            {role === 'coach' && (
                <nav className="bg-black/50 backdrop-blur-md border-b border-gray-800 sticky top-0 z-50">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex justify-between h-16">
                            <div className="flex items-center">
                                <h1 className="text-xl font-bold bg-gradient-to-r from-[#BC0000] to-gray-500 bg-clip-text text-transparent">
                                    RR Performance
                                </h1>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-sm text-gray-400">
                                    Entrenador
                                </span>
                                <div className="h-8 w-8 rounded-full bg-[#BC0000] flex items-center justify-center text-xs font-bold">
                                    {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
                                </div>
                                <button
                                    onClick={() => logout()}
                                    className="text-gray-400 hover:text-white text-sm"
                                >
                                    Salir
                                </button>
                            </div>
                        </div>
                    </div>
                </nav>
            )}

            <main className="min-h-screen">
                {role === 'coach' ? (
                    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                        <CoachDashboard />
                    </div>
                ) : (
                    <ClientDashboard />
                )}
            </main>
        </div>
    );
}
