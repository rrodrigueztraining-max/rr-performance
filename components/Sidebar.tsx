"use client";

import { Home, Dumbbell, Activity, Calendar, FileText, Settings, LogOut } from "lucide-react";
import { auth } from "@/lib/firebase";

import Image from "next/image";
import { useRouter } from "next/navigation";

import { useAuth } from "@/context/AuthContext";

interface SidebarProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
}

export default function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
    const { logout } = useAuth();
    const router = useRouter();
    const mainNavItems = [
        { id: "home", label: "Inicio", icon: Home },
        { id: "workout", label: "Entreno", icon: Dumbbell },
        { id: "health", label: "Salud", icon: Activity },
        { id: "calendar", label: "Agenda", icon: Calendar },
        { id: "forms", label: "Formularios", icon: FileText },
        { id: "resources", label: "Recursos", icon: Settings }, // Changed Icon temporarily as FileText is now forms
    ];

    return (
        <aside className="hidden md:flex fixed inset-y-0 left-0 w-20 lg:w-64 bg-black border-r border-[#BC0000]/20 flex-col z-50 transition-all duration-300">
            {/* Logo Area */}
            <div className="h-24 flex items-center justify-center border-b border-gray-900 bg-gradient-to-b from-[#BC0000]/10 to-transparent">
                <div className="relative w-12 h-12 lg:w-16 lg:h-16">
                    <Image
                        src="/assets/logo.png"
                        alt="RR Logo"
                        fill
                        className="object-contain drop-shadow-[0_0_10px_rgba(188,0,0,0.5)]"
                    />
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-8 space-y-2 px-2 lg:px-4">
                {mainNavItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => {
                                if (item.id === 'forms') {
                                    router.push("/dashboard/forms");
                                } else {
                                    setActiveTab(item.id);
                                }
                            }}
                            className={`w-full flex items-center justify-center lg:justify-start gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden ${isActive
                                ? "bg-[#BC0000] text-white shadow-[0_0_20px_rgba(188,0,0,0.4)]"
                                : "text-gray-500 hover:bg-gray-900 hover:text-white"
                                }`}
                        >
                            <Icon className={`w-6 h-6 ${isActive ? "text-white" : "text-gray-500 group-hover:text-white"}`} />
                            <span className={`hidden lg:block font-medium ${isActive ? "text-white" : "text-gray-400 group-hover:text-white"}`}>
                                {item.label}
                            </span>
                        </button>
                    );
                })}
            </nav>

            {/* Footer / Logout */}
            <div className="p-4 border-t border-gray-900">
                <button
                    onClick={() => logout()}
                    className="w-full flex items-center justify-center lg:justify-start gap-3 px-3 py-3 rounded-xl text-gray-500 hover:text-red-500 hover:bg-red-950/10 transition-colors"
                >
                    <LogOut className="w-5 h-5" />
                    <span className="hidden lg:block font-medium text-sm">
                        Cerrar Sesión
                    </span>
                </button>
            </div>
        </aside>
    );
}
