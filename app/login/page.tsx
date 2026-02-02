"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await signInWithEmailAndPassword(auth, email, password);
            router.push("/dashboard");
        } catch (err: any) {
            setError(err.message);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-carbon-texture text-white p-4">
            <div className="max-w-md w-full space-y-8 p-8 bg-black/60 backdrop-blur-md rounded-xl shadow-2xl border border-gray-800/50">
                <div className="text-center">
                    <h2 className="mt-6 text-3xl font-extrabold tracking-tight bg-gradient-to-r from-[#BC0000] to-gray-500 bg-clip-text text-transparent">
                        Bienvenido de nuevo
                    </h2>
                    <p className="mt-2 text-sm text-gray-400">
                        Inicia sesión para acceder a tu plan de alto rendimiento
                    </p>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleLogin}>
                    <div className="rounded-md shadow-sm space-y-4">
                        <div>
                            <input
                                type="email"
                                required
                                className="appearance-none rounded-lg relative block w-full px-3 py-3 border border-gray-700 placeholder-gray-500 text-white bg-gray-800 focus:outline-none focus:ring-[#BC0000] focus:border-[#BC0000] focus:z-10 sm:text-sm transition-colors"
                                placeholder="Dirección de correo"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div>
                            <input
                                type="password"
                                required
                                className="appearance-none rounded-lg relative block w-full px-3 py-3 border border-gray-700 placeholder-gray-500 text-white bg-gray-800 focus:outline-none focus:ring-[#BC0000] focus:border-[#BC0000] focus:z-10 sm:text-sm transition-colors"
                                placeholder="Contraseña"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    {error && <div className="text-red-500 text-sm text-center">{error}</div>}

                    <div>
                        <button
                            type="submit"
                            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-lg text-white bg-[#BC0000] hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#BC0000] btn-glow"
                        >
                            Iniciar sesión
                        </button>
                    </div>
                </form>
                <div className="text-center mt-4">
                    <Link href="/register" className="text-sm text-[#BC0000] hover:text-red-400">
                        ¿No tienes cuenta? Regístrate
                    </Link>
                </div>
            </div>
        </div>
    );
}

