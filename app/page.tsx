import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#09090b] text-white p-6">

      <div className="flex flex-col items-center max-w-sm mx-auto w-full">

        {/* Logo Section */}
        <div className="mb-8 relative w-24 h-24 md:w-32 md:h-32">
          <Image
            src="/assets/logo.png"
            alt="RR Performance Logo"
            fill
            className="object-contain"
            priority
          />
        </div>

        {/* Typography */}
        <h1 className="text-3xl md:text-4xl font-bold tracking-tighter text-white mb-2 text-center">
          RR PERFORMANCE
        </h1>

        <p className="text-xs font-medium tracking-[0.2em] uppercase text-gray-400 mb-12 text-center">
          Salud de Alto Rendimiento
        </p>

        {/* Buttons - Modern Pill Shape (Spotify/Netflix Style) */}
        <div className="flex flex-col w-full gap-3">
          <Link
            href="/login"
            className="h-12 w-full rounded-full bg-red-600 hover:bg-red-700 text-white font-bold text-sm tracking-wide transition-colors flex items-center justify-center"
          >
            INICIAR SESIÓN
          </Link>

          <Link
            href="/register"
            className="h-12 w-full rounded-full bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-sm tracking-wide transition-colors flex items-center justify-center"
          >
            Registrarse
          </Link>
        </div>

        {/* Footer */}
        <div className="mt-16 text-center">
          <span className="text-[10px] text-zinc-600 font-medium">© 2026 RR PERFORMANCE APP</span>
        </div>
      </div>
    </div>
  );
}
