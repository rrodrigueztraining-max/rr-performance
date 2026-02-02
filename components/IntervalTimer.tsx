"use client";

import { useState, useEffect, useRef } from "react";
import { Play, Square, Pause, RotateCcw, Settings, Volume2, VolumeX, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function IntervalTimer({ onClose }: { onClose?: () => void }) {
    // Configuration State
    const [workTime, setWorkTime] = useState(30);
    const [restTime, setRestTime] = useState(15);
    const [rounds, setRounds] = useState(3);
    const [soundEnabled, setSoundEnabled] = useState(true);

    // Runtime State
    const [isActive, setIsActive] = useState(false);
    const [isPaused, setIsPaused] = useState(false); // If active but paused
    const [currentRound, setCurrentRound] = useState(1);
    const [phase, setPhase] = useState<'IDLE' | 'PREP' | 'WORK' | 'REST'>('IDLE');
    const [timeLeft, setTimeLeft] = useState(0);

    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);

    // Initialize Audio Context on user interaction
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

    // Timer Logic
    useEffect(() => {
        if (isActive && !isPaused && timeLeft > 0) {
            timerRef.current = setInterval(() => {
                setTimeLeft((prev) => {
                    // Beep logic at 3, 2, 1
                    if (prev <= 4 && prev > 1) { // Beep at 3, 2, 1 (which are displayed as such)
                        // Actually, if we tick every second, at 3.0s we beep. 
                        // Check inside the effect might drift. 
                        // Better: check prev value.
                    }
                    return prev - 1;
                });
            }, 1000);
        } else if (timeLeft === 0 && isActive && !isPaused) {
            handlePhaseTransition();
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isActive, isPaused, timeLeft]);

    // Independent effect for beeps to avoid tight coupling with setState tick lag
    useEffect(() => {
        if (isActive && !isPaused && timeLeft <= 3 && timeLeft > 0) {
            playBeep(880, 0.1, 'sine'); // Short beep 3..2..1
        }
    }, [timeLeft, isActive, isPaused]);

    const handlePhaseTransition = () => {
        if (phase === 'PREP') {
            playBeep(1200, 0.6, 'square'); // GO!
            setPhase('WORK');
            setTimeLeft(workTime);
        } else if (phase === 'WORK') {
            playBeep(440, 0.6, 'sawtooth'); // Rest start
            if (currentRound < rounds || restTime > 0) {
                setPhase('REST');
                setTimeLeft(restTime);
            } else {
                finishTimer();
            }
        } else if (phase === 'REST') {
            if (currentRound < rounds) {
                setCurrentRound(prev => prev + 1);
                playBeep(1200, 0.6, 'square'); // Next Round GO
                setPhase('WORK');
                setTimeLeft(workTime);
            } else {
                finishTimer();
            }
        }
    };

    const finishTimer = () => {
        playBeep(880, 0.8, 'square'); // FINISH
        playBeep(1100, 0.8, 'square'); // Victory
        setIsActive(false);
        setPhase('IDLE');
        setCurrentRound(1);
    };

    const startTimer = () => {
        initAudio();
        setIsActive(true);
        setIsPaused(false);
        setPhase('PREP');
        setTimeLeft(3); // 3s Prep
    };

    const togglePause = () => {
        setIsPaused(!isPaused);
    };

    const resetTimer = () => {
        setIsActive(false);
        setIsPaused(false);
        setPhase('IDLE');
        setCurrentRound(1);
        setTimeLeft(0);
    };

    // Color Helpers
    const getBgColor = () => {
        if (phase === 'PREP') return 'bg-yellow-500';
        if (phase === 'WORK') return 'bg-green-600';
        if (phase === 'REST') return 'bg-red-600';
        return 'bg-gray-900';
    };

    const getPhaseLabel = () => {
        if (phase === 'PREP') return 'PREPÁRATE';
        if (phase === 'WORK') return '¡TRABAJO!';
        if (phase === 'REST') return 'DESCANSO';
        return 'CONFIGURAR';
    };

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    return (
        <div className={`relative w-full max-w-md mx-auto rounded-3xl overflow-hidden shadow-2xl transition-colors duration-500 border border-white/10 ${getBgColor()}`}>

            {/* Header */}
            <div className="flex justify-between items-center p-4 bg-black/20 backdrop-blur-sm">
                <span className="font-bold text-white/50 text-xs tracking-widest uppercase">Interval Timer Pro</span>
                <div className="flex items-center gap-4">
                    <button onClick={() => setSoundEnabled(!soundEnabled)} className="text-white/80 hover:text-white">
                        {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                    </button>
                    {onClose && (
                        <button onClick={onClose} className="text-white/80 hover:text-white">
                            <ChevronDown className="w-6 h-6" />
                        </button>
                    )}
                </div>
            </div>

            {/* Main Display */}
            <div className="p-8 flex flex-col items-center justify-center min-h-[300px]">
                {!isActive ? (
                    // CONFIG MODE
                    <div className="w-full space-y-6 animate-in fade-in duration-300">
                        {/* Rounds Input */}
                        <div className="bg-black/30 rounded-xl p-4 flex justify-between items-center">
                            <span className="text-gray-300 font-bold uppercase text-sm">Rondas</span>
                            <div className="flex items-center gap-4">
                                <button onClick={() => setRounds(Math.max(1, rounds - 1))} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xl font-bold">-</button>
                                <span className="text-3xl font-black text-white w-12 text-center">{rounds}</span>
                                <button onClick={() => setRounds(rounds + 1)} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xl font-bold">+</button>
                            </div>
                        </div>

                        {/* Work Input */}
                        <div className="bg-black/30 rounded-xl p-4 flex justify-between items-center border-l-4 border-green-500">
                            <span className="text-gray-300 font-bold uppercase text-sm">Trabajo</span>
                            <div className="flex items-center gap-4">
                                <button onClick={() => setWorkTime(Math.max(5, workTime - 5))} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xl font-bold">-</button>
                                <span className="text-3xl font-black text-white w-16 text-center">{formatTime(workTime)}</span>
                                <button onClick={() => setWorkTime(workTime + 5)} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xl font-bold">+</button>
                            </div>
                        </div>

                        {/* Rest Input */}
                        <div className="bg-black/30 rounded-xl p-4 flex justify-between items-center border-l-4 border-red-500">
                            <span className="text-gray-300 font-bold uppercase text-sm">Descanso</span>
                            <div className="flex items-center gap-4">
                                <button onClick={() => setRestTime(Math.max(0, restTime - 5))} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xl font-bold">-</button>
                                <span className="text-3xl font-black text-white w-16 text-center">{formatTime(restTime)}</span>
                                <button onClick={() => setRestTime(restTime + 5)} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xl font-bold">+</button>
                            </div>
                        </div>
                    </div>
                ) : (
                    // ACTIVE MODE
                    <div className="flex flex-col items-center animate-in zoom-in duration-300">
                        <div className="text-white/80 font-bold tracking-[0.2em] mb-4 text-xl animate-pulse">
                            {getPhaseLabel()}
                        </div>
                        <div className="text-9xl font-black text-white font-mono tracking-tighter drop-shadow-lg">
                            {phase === 'PREP' ? timeLeft : formatTime(timeLeft)}
                        </div>
                        <div className="mt-8 flex items-center gap-2 text-white/60 font-mono text-sm bg-black/20 px-4 py-2 rounded-full">
                            <span>Ronda {currentRound}</span>
                            <span className="opacity-50">/</span>
                            <span>{rounds}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer / Controls */}
            <div className="p-6 bg-black/40 backdrop-blur-md border-t border-white/5">
                {!isActive ? (
                    <button
                        onClick={startTimer}
                        className="w-full py-4 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-black text-2xl uppercase tracking-widest shadow-lg transform hover:scale-[1.02] transition-all flex items-center justify-center gap-3"
                    >
                        <Play className="fill-current w-6 h-6" /> INICIAR
                    </button>
                ) : (
                    <div className="flex gap-4">
                        <button
                            onClick={resetTimer}
                            className="flex-1 py-4 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold uppercase tracking-widest flex items-center justify-center gap-2"
                        >
                            <RotateCcw className="w-5 h-5" /> Reset
                        </button>

                        <button
                            onClick={togglePause}
                            className="flex-[2] py-4 rounded-xl bg-white text-black font-black text-2xl uppercase tracking-widest shadow-lg hover:bg-gray-200 transition-all flex items-center justify-center gap-3"
                        >
                            {isPaused ? <Play className="fill-current w-6 h-6" /> : <Pause className="fill-current w-6 h-6" />}
                            {isPaused ? "REANUDAR" : "PAUSA"}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
