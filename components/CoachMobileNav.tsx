"use client";

import { Users, LayoutTemplate, Globe, FileText, Dumbbell } from "lucide-react";

interface CoachMobileNavProps {
    activeTab: string;
    setActiveTab: (tab: any) => void;
}

export default function CoachMobileNav({ activeTab, setActiveTab }: CoachMobileNavProps) {
    const navItems = [
        { id: "clients", label: "Clientes", icon: Users },
        { id: "templates", label: "Plantillas", icon: LayoutTemplate },
        { id: "resources", label: "Global", icon: Globe },
        { id: "forms", label: "Forms", icon: FileText },
    ];

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 h-20 bg-[#09090b]/95 backdrop-blur-lg border-t border-white/10 z-50 px-6 pb-6 pt-2 flex justify-between items-center safe-area-bottom">
            {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                    <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`flex flex-col items-center gap-1 transition-all duration-200 ${isActive ? "text-red-500 scale-110" : "text-zinc-500 hover:text-zinc-300"}`}
                    >
                        <div className={`p-1.5 rounded-full ${isActive ? "bg-red-500/10" : "bg-transparent"}`}>
                            <Icon className={`w-6 h-6 ${isActive ? "stroke-[2.5px]" : "stroke-2"}`} />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-tight">
                            {item.label}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
