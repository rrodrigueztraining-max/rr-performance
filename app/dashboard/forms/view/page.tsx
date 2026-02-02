"use client";

import { Suspense, use } from "react";
import { useSearchParams } from "next/navigation";
import FormRenderer from "@/components/forms/FormRenderer";

// Inner component that uses search params
function FormViewContent() {
    const searchParams = useSearchParams();
    const formId = searchParams.get('formId');

    if (!formId) {
        return <div className="p-10 text-center text-gray-500">Error: No Form ID provided.</div>;
    }

    return <FormRenderer formId={formId} />;
}

export default function FormViewPage() {
    return (
        <div className="min-h-screen bg-black">
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black text-white">Cargando formulario...</div>}>
                <FormViewContent />
            </Suspense>
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
