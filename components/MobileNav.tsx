"use client";

import { Home, Dumbbell, Activity, Calendar, FileText } from "lucide-react";
import { useRouter } from "next/navigation";

interface MobileNavProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
}

export default function MobileNav({ activeTab, setActiveTab }: MobileNavProps) {
    const router = useRouter();

    // We omit "Resources" (Settings) on mobile bottom nav to save space if needed, 
    // or we can include it. Let's include top 5 specific to daily use.
    // User requested "Resources" as Settings icon in Sidebar, let's keep consistent if space allows.
    // 5 items is standard max for bottom nav.

    const navItems = [
        { id: "home", label: "Inicio", icon: Home },
        { id: "workout", label: "Entreno", icon: Dumbbell },
        { id: "health", label: "Salud", icon: Activity },
        { id: "calendar", label: "Agenda", icon: Calendar },
        { id: "forms", label: "Forms", icon: FileText },
    ];

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 h-20 bg-black/90 backdrop-blur-lg border-t border-gray-800 z-50 px-6 pb-6 pt-2 flex justify-between items-center safe-area-bottom">
            {navItems.map((item) => {
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
                        className={`flex flex-col items-center gap-1 transition-all duration-200 ${isActive ? "text-[#BC0000] scale-110" : "text-gray-500 hover:text-gray-300"}`}
                    >
                        <div className={`p-1.5 rounded-full ${isActive ? "bg-[#BC0000]/10" : "bg-transparent"}`}>
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
