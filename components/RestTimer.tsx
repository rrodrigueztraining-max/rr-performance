"use client";

import { useState, useEffect, useRef } from "react";
import { Play, Square, Timer, Plus, Minus, RotateCcw, ChevronDown, CheckCircle, Volume2, VolumeX, Pause } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function RestTimer({ mode = 'floating' }: { mode?: 'floating' | 'inline' }) {
    // Configuration State
    const [workTime, setWorkTime] = useState(30);
    const [restTime, setRestTime] = useState(15);
    const [totalRounds, setTotalRounds] = useState(3);
    const [soundEnabled, setSoundEnabled] = useState(true);

    // Runtime State
    const [timeLeft, setTimeLeft] = useState(0);
    const [isActive, setIsActive] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [phase, setPhase] = useState<'IDLE' | 'PREP' | 'WORK' | 'REST'>('IDLE');
    const [currentRound, setCurrentRound] = useState(1);

    // UI State
    const [isExpanded, setIsExpanded] = useState(false);

    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);

    // Circle Config
    const radius = 120;
    const circumference = 2 * Math.PI * radius;

    // --- Audio Logic ---
    const initAudio = () => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
        }
    };

    const playBeep = (freq = 880, duration = 0.1, type: OscillatorType = 'sine') => {
        if (!soundEnabled || !audioContextRef.current) return;
        try {
            const osc = audioContextRef.current.createOscillator();
            const gain = audioContextRef.current.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, audioContextRef.current.currentTime);
            gain.gain.setValueAtTime(0.1, audioContextRef.current.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.00001, audioContextRef.current.currentTime + duration);
            osc.connect(gain);
            gain.connect(audioContextRef.current.destination);
            osc.start();
            osc.stop(audioContextRef.current.currentTime + duration);
        } catch (e) {
            console.error("Audio play error", e);
        }
    };

    // --- Timer Logic ---
    useEffect(() => {
        if (isActive && !isPaused && timeLeft > 0) {
            timerRef.current = setInterval(() => {
                setTimeLeft((prev) => prev - 1);
            }, 1000);
        } else if (timeLeft === 0 && isActive && !isPaused) {
            handlePhaseTransition();
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isActive, isPaused, timeLeft]);

    // Beeps Effect
    useEffect(() => {
        if (isActive && !isPaused && timeLeft <= 3 && timeLeft > 0) {
            playBeep(880, 0.1, 'sine'); // Countdown beep
        }
    }, [timeLeft, isActive, isPaused]);

    const handlePhaseTransition = () => {
        if (phase === 'PREP') {
            playBeep(1200, 0.4, 'square'); // GO!
            setPhase('WORK');
            setTimeLeft(workTime);
        } else if (phase === 'WORK') {
            playBeep(440, 0.4, 'sawtooth'); // Rest Start
            if (currentRound < totalRounds || restTime > 0) {
                setPhase('REST');
                setTimeLeft(restTime);
            } else {
                finishTimer(); // No rest needed if last round? Usually yes, but implies done.
            }
        } else if (phase === 'REST') {
            if (currentRound < totalRounds) {
                setCurrentRound(prev => prev + 1);
                playBeep(1200, 0.4, 'square'); // Next Round GO
                setPhase('WORK');
                setTimeLeft(workTime);
            } else {
                finishTimer();
            }
        }
    };

    const startTimer = () => {
        initAudio();
        setIsActive(true);
        setIsPaused(false);
        setPhase('PREP');
        setTimeLeft(3);
        setIsExpanded(true); // Auto expand on start
    };

    const finishTimer = () => {
        playBeep(880, 0.6, 'square'); // Finish
        playBeep(1100, 0.8, 'square'); // Victory
        setIsActive(false);
        setPhase('IDLE');
        setCurrentRound(1);
        if (navigator.vibrate) navigator.vibrate([500, 200, 500]);
    };

    const stopTimer = () => {
        setIsActive(false);
        setPhase('IDLE');
        if (timerRef.current) clearInterval(timerRef.current);
    };

    const togglePause = () => {
        setIsPaused(!isPaused);
    };

    const resetTimer = () => {
        stopTimer();
        setTimeLeft(0);
        setCurrentRound(1);
    };

    const addTime = (seconds: number) => {
        setTimeLeft(prev => prev + seconds);
    };

    // --- Helpers ---
    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, "0")}`;
    };

    const getPhaseColor = () => {
        if (phase === 'PREP') return "text-yellow-500 stroke-yellow-500";
        if (phase === 'WORK') return "text-green-500 stroke-green-500";
        if (phase === 'REST') return "text-red-500 stroke-red-500";
        return "text-[#BC0000] stroke-[#BC0000]";
    };

    const getPhaseLabel = () => {
        if (phase === 'PREP') return "PREP";
        if (phase === 'WORK') return "WORK";
        if (phase === 'REST') return "REST";
        return "TIMER";
    };

    const getTotalDuration = () => {
        if (phase === 'PREP') return 3;
        if (phase === 'WORK') return workTime;
        if (phase === 'REST') return restTime;
        return 60; // default for idle circle
    };

    const duration = getTotalDuration();
    const strokeDashoffset = circumference - (timeLeft / duration) * circumference;

    return (
        <>
            {/* INLINE / FLOATING TRIGGER */}
            <AnimatePresence>
                {!isExpanded && (
                    mode === 'floating' ? (
                        <motion.button
                            initial={{ y: 100, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 100, opacity: 0 }}
                            onClick={() => setIsExpanded(true)}
                            className={`fixed bottom-24 right-4 z-[90] flex items-center gap-3 px-4 py-3 rounded-full shadow-2xl backdrop-blur-md border transition-all ${isActive ? "bg-gray-900/90 border-[#BC0000]/50" : "bg-black/80 border-gray-700"}`}
                        >
                            <div className="relative w-10 h-10 flex items-center justify-center">
                                <svg className="w-full h-full -rotate-90">
                                    <circle cx="20" cy="20" r="18" className="stroke-gray-800" strokeWidth="4" fill="none" />
                                    <circle
                                        cx="20" cy="20" r="18"
                                        className={`transition-all duration-1000 ${isActive ? getPhaseColor() : "stroke-gray-500"}`}
                                        strokeWidth="4"
                                        fill="none"
                                        strokeDasharray={2 * Math.PI * 18}
                                        strokeDashoffset={isActive ? (2 * Math.PI * 18) - (timeLeft / duration) * (2 * Math.PI * 18) : 0}
                                    />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    {isActive ? (
                                        <span className="text-[10px] font-mono font-bold text-white mb-0.5">{timeLeft}</span>
                                    ) : (
                                        <Timer className="w-4 h-4 text-white" />
                                    )}
                                </div>
                            </div>
                            <div className="text-left">
                                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                                    {getPhaseLabel()}
                                </div>
                                <div className="text-xs font-bold text-white">
                                    {isActive ? `Ronda ${currentRound}/${totalRounds}` : "Abrir"}
                                </div>
                            </div>
                        </motion.button>
                    ) : (
                        // INLINE MODE
                        <button
                            onClick={() => setIsExpanded(true)}
                            className={`flex items-center gap-3 px-3 py-2 rounded-xl border transition-all w-full h-full justify-center ${isActive ? "bg-gray-900/90 border-[#BC0000]/50" : "bg-black/50 border-gray-700"}`}
                        >
                            <div className="relative w-8 h-8 flex items-center justify-center">
                                <svg className="w-full h-full -rotate-90">
                                    <circle cx="16" cy="16" r="14" className="stroke-gray-800" strokeWidth="3" fill="none" />
                                    <circle
                                        cx="16" cy="16" r="14"
                                        className={`transition-all duration-1000 ${isActive ? getPhaseColor() : "stroke-gray-500"}`}
                                        strokeWidth="3"
                                        fill="none"
                                        strokeDasharray={2 * Math.PI * 14}
                                        strokeDashoffset={isActive ? (2 * Math.PI * 14) - (timeLeft / duration) * (2 * Math.PI * 14) : 0}
                                    />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    {isActive ? (
                                        <span className="text-[9px] font-mono font-bold text-white">{timeLeft}</span>
                                    ) : (
                                        <Timer className="w-3 h-3 text-white" />
                                    )}
                                </div>
                            </div>
                            <div className="text-left hidden xs:block">
                                <div className="text-[9px] text-gray-400 font-bold uppercase leading-tight">
                                    {getPhaseLabel()}
                                </div>
                                <div className="text-[10px] font-bold text-white leading-tight">
                                    {isActive ? formatTime(timeLeft) : "Timer"}
                                </div>
                            </div>
                        </button>
                    )
                )}
            </AnimatePresence>

            {/* EXPANDED SHEET */}
            <AnimatePresence>
                {isExpanded && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsExpanded(false)}
                            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
                        />

                        <motion.div
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className={`fixed bottom-0 left-0 right-0 z-[101] border-t border-gray-800 rounded-t-3xl p-6 shadow-2xl w-full md:w-[95%] max-w-md mx-auto min-h-[500px] flex flex-col ${phase === 'WORK' ? 'bg-green-950/20 shadow-[0_0_50px_rgba(0,255,0,0.1)]' :
                                    phase === 'REST' ? 'bg-red-950/20 shadow-[0_0_50px_rgba(255,0,0,0.1)]' :
                                        'bg-[#0a0a0a]'
                                }`}
                        >
                            {/* Drag Handle & Header */}
                            <div className="flex justify-between items-center mb-6">
                                <button onClick={() => setSoundEnabled(!soundEnabled)} className="text-gray-400 hover:text-white">
                                    {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                                </button>
                                <div className="w-12 h-1.5 bg-gray-700 rounded-full cursor-pointer" onClick={() => setIsExpanded(false)} />
                                <button onClick={() => setIsExpanded(false)} className="text-gray-400 hover:text-white">
                                    <ChevronDown className="w-6 h-6" />
                                </button>
                            </div>

                            {/* CONFIG SECTION (Only when IDLE) */}
                            {!isActive && (
                                <div className="space-y-4 mb-6 animate-in fade-in slide-in-from-bottom-2">
                                    <div className="flex items-center justify-between bg-gray-900/50 p-3 rounded-xl border border-gray-800">
                                        <span className="text-xs font-bold text-gray-400 uppercase">Rondas</span>
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => setTotalRounds(Math.max(1, totalRounds - 1))} className="w-8 h-8 flex items-center justify-center bg-gray-800 rounded-full hover:bg-gray-700 text-white"><Minus className="w-4 h-4" /></button>
                                            <span className="text-xl font-bold text-white w-8 text-center">{totalRounds}</span>
                                            <button onClick={() => setTotalRounds(totalRounds + 1)} className="w-8 h-8 flex items-center justify-center bg-gray-800 rounded-full hover:bg-gray-700 text-white"><Plus className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between bg-green-900/10 p-3 rounded-xl border border-green-900/30">
                                        <span className="text-xs font-bold text-green-500 uppercase">Trabajo</span>
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => setWorkTime(Math.max(5, workTime - 5))} className="w-8 h-8 flex items-center justify-center bg-gray-800 rounded-full hover:bg-gray-700 text-white"><Minus className="w-4 h-4" /></button>
                                            <span className="text-xl font-bold text-white w-12 text-center">{formatTime(workTime)}</span>
                                            <button onClick={() => setWorkTime(workTime + 5)} className="w-8 h-8 flex items-center justify-center bg-gray-800 rounded-full hover:bg-gray-700 text-white"><Plus className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between bg-red-900/10 p-3 rounded-xl border border-red-900/30">
                                        <span className="text-xs font-bold text-red-500 uppercase">Descanso</span>
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => setRestTime(Math.max(0, restTime - 5))} className="w-8 h-8 flex items-center justify-center bg-gray-800 rounded-full hover:bg-gray-700 text-white"><Minus className="w-4 h-4" /></button>
                                            <span className="text-xl font-bold text-white w-12 text-center">{formatTime(restTime)}</span>
                                            <button onClick={() => setRestTime(restTime + 5)} className="w-8 h-8 flex items-center justify-center bg-gray-800 rounded-full hover:bg-gray-700 text-white"><Plus className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TIMER DISPLAY */}
                            <div className="flex-1 flex flex-col items-center justify-center relative min-h-[220px]">
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <svg viewBox="0 0 280 280" className="w-[260px] h-[260px] -rotate-90 drop-shadow-2xl">
                                        <circle cx="140" cy="140" r={radius} fill="none" stroke="#1a1a1a" strokeWidth="12" strokeLinecap="round" />
                                        <circle
                                            cx="140" cy="140" r={radius}
                                            fill="none"
                                            className={`transition-all duration-1000 ease-linear ${isActive ? getPhaseColor() : 'stroke-gray-700'}`}
                                            strokeWidth="12"
                                            strokeLinecap="round"
                                            strokeDasharray={circumference}
                                            strokeDashoffset={isActive ? strokeDashoffset : 0}
                                        />
                                    </svg>
                                </div>

                                <div className="relative z-10 flex flex-col items-center text-center">
                                    <div className={`text-6xl font-black font-mono tracking-tighter ${isActive ? getPhaseColor().replace('stroke-', 'text-') : 'text-white'}`}>
                                        {formatTime(timeLeft)}
                                    </div>
                                    <div className="text-sm font-bold uppercase tracking-[0.2em] text-gray-400 mt-2">
                                        {getPhaseLabel()}
                                    </div>
                                    {isActive && (
                                        <div className="mt-4 px-3 py-1 bg-white/10 rounded-full text-xs font-mono text-white/70">
                                            Ronda {currentRound} / {totalRounds}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* CONTROLS */}
                            <div className="mt-8">
                                {!isActive ? (
                                    <button
                                        onClick={startTimer}
                                        className="w-full py-5 rounded-2xl bg-[#BC0000] hover:bg-red-600 text-white font-black text-xl uppercase tracking-widest shadow-xl hover:shadow-red-900/30 transition-all flex items-center justify-center gap-3"
                                    >
                                        <Play className="fill-current w-6 h-6" /> Iniciar
                                    </button>
                                ) : (
                                    <div className="flex gap-4">
                                        <button
                                            onClick={resetTimer}
                                            className="flex-1 py-4 bg-gray-900 rounded-xl font-bold text-gray-400 hover:text-white border border-gray-800 transition-all flex items-center justify-center gap-2"
                                        >
                                            <RotateCcw className="w-5 h-5" /> Stop
                                        </button>
                                        <button
                                            onClick={togglePause}
                                            className="flex-[2] py-4 bg-white text-black rounded-xl font-black text-xl uppercase tracking-widest hover:bg-gray-200 transition-all flex items-center justify-center gap-3"
                                        >
                                            {isPaused ? <Play className="fill-current w-5 h-5" /> : <Pause className="fill-current w-5 h-5" />}
                                            {isPaused ? "Reanudar" : "Pausa"}
                                        </button>
                                    </div>
                                )}
                            </div>

                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
