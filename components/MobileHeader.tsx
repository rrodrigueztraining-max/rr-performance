"use client";

import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

export default function MobileHeader() {
    const pathname = usePathname();
    const router = useRouter();

    // Define main routes where the header should NOT appear (or behavior changes)
    // On these routes, we usually have the Bottom Nav or specific headers
    const MAIN_ROUTES = ['/dashboard', '/login', '/register', '/', '/dashboard/forms'];

    // Check if current path is a main route
    const isMainRoute = MAIN_ROUTES.includes(pathname);

    // If it's a main route, don't show this generic back header
    if (isMainRoute) return null;

    return (
        <div className="md:hidden fixed top-0 left-0 right-0 min-h-16 safe-area-top bg-black/90 backdrop-blur-md border-b border-gray-800 z-50 flex items-center px-4 pb-2">
            <button
                onClick={() => router.back()}
                className="p-2 -ml-2 rounded-full hover:bg-gray-800 text-white transition-colors flex items-center gap-1"
            >
                <ChevronLeft className="w-6 h-6" />
                <span className="text-sm font-bold">Atrás</span>
            </button>
        </div>
    );
}
