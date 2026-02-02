"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Plus, X, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, Timestamp } from "firebase/firestore";

interface CoachClientCalendarProps {
    clientId: string;
}

export default function CoachClientCalendar({ clientId }: CoachClientCalendarProps) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [events, setEvents] = useState<any[]>([]);
    const [selectedDate, setSelectedDate] = useState<number | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form State
    const [newEventTitle, setNewEventTitle] = useState("");
    const [newEventTime, setNewEventTime] = useState("");
    const [eventType, setEventType] = useState<'workout' | 'event' | 'checkin'>('workout');

    // 1. Fetch Events for current month
    useEffect(() => {
        // Need to cover the whole month range. 
        // Ideally query ranges, but simplicity: fetch all for user or improved query
        // For now, let's fetch all and filter client side or basic query
        const q = query(collection(db, "users", clientId, "calendar_events"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const evs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setEvents(evs);
        });
        return () => unsubscribe();
    }, [clientId]);

    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
    const adjustedFirstDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; // Mon start
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const empties = Array.from({ length: adjustedFirstDay }, (_, i) => i);

    const changeMonth = (offset: number) => {
        const newDate = new Date(currentDate.setMonth(currentDate.getMonth() + offset));
        setCurrentDate(new Date(newDate));
    };

    const handleDayClick = (day: number) => {
        setSelectedDate(day);
        setIsModalOpen(true);
        setNewEventTitle("");
        setNewEventTime("");
        setEventType("workout");
    };

    const handleAddEvent = async () => {
        if (!selectedDate) return;

        // Fix: Use local date construction to avoid UTC shift
        const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), selectedDate);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const daypad = String(d.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${daypad}`;

        try {
            await addDoc(collection(db, "users", clientId, "calendar_events"), {
                date: dateStr,
                title: newEventTitle || (eventType === 'workout' ? 'Entrenamiento' : eventType === 'checkin' ? 'Revisión' : 'Evento'),
                time: newEventTime,
                type: eventType,
                createdAt: Timestamp.now()
            });
            setIsModalOpen(false);
        } catch (error) {
            console.error("Error adding event:", error);
            alert("Error al guardar evento");
        }
    };

    const handleDeleteEvent = async (eventId: string) => {
        if (confirm("¿Eliminar este evento?")) {
            await deleteDoc(doc(db, "users", clientId, "calendar_events", eventId));
        }
    };

    // Filter events for the rendered month mainly to avoid processing too much? 
    // Actually we iterate days and find matching events.

    const getEventsForDay = (day: number) => {
        // Fix: Ensure comparison uses same local date construction
        const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const daypad = String(d.getDate()).padStart(2, '0');
        const localDateStr = `${year}-${month}-${daypad}`;

        return events.filter((e: any) => e.date === localDateStr);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center bg-gray-900/50 p-4 rounded-xl border border-gray-800">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold text-white capitalize">
                        {currentDate.toLocaleDateString("es-ES", { month: 'long', year: 'numeric' })}
                    </h2>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => changeMonth(-1)} className="p-2 border border-gray-700 rounded hover:bg-white/5 text-white">
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button onClick={() => changeMonth(1)} className="p-2 border border-gray-700 rounded hover:bg-white/5 text-white">
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Grid */}
            <div className="bg-black/20 border border-gray-800 rounded-xl p-6">
                <div className="grid grid-cols-7 mb-4">
                    {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(day => (
                        <div key={day} className="text-center text-gray-500 font-bold uppercase text-xs py-2">
                            {day}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                    {empties.map(empty => <div key={`empty-${empty}`} className="h-24 lg:h-32"></div>)}
                    {days.map(day => {
                        const dayEvents = getEventsForDay(day);
                        const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();

                        return (
                            <div
                                key={day}
                                onClick={() => handleDayClick(day)}
                                className={`h-24 lg:h-32 border rounded-lg p-2 relative hover:bg-gray-800/50 transition-colors cursor-pointer group flex flex-col gap-1 overflow-hidden ${isToday ? 'border-[#BC0000]/50 bg-[#BC0000]/5' : 'border-gray-800 bg-gray-900/30'}`}
                            >
                                <span className={`text-xs font-bold ${isToday ? 'text-[#BC0000]' : 'text-gray-400'}`}>{day}</span>

                                {/* Events Stack */}
                                <div className="flex flex-col gap-1 overflow-y-auto max-h-full">
                                    {dayEvents.map((ev: any) => (
                                        <div key={ev.id} className={`text-[10px] px-1.5 py-0.5 rounded truncate font-bold flex justify-between items-center group-hover/event ${ev.type === 'workout' ? 'bg-red-900/30 text-red-400 border border-red-900/50' :
                                            ev.type === 'checkin' ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-900/50 checkin-stripe' :
                                                'bg-blue-900/30 text-blue-400 border border-blue-900/50'
                                            }`}>
                                            <span>
                                                {ev.time && <span className="mr-1 opacity-75">{ev.time}</span>}
                                                {ev.title}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                {/* Add Button Overlay */}
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                    <Plus className="w-6 h-6 text-white" />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && selectedDate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">
                                {selectedDate} {currentDate.toLocaleDateString("es-ES", { month: 'long' })}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Existing Events List for Deletion */}
                        <div className="space-y-2 mb-6">
                            {getEventsForDay(selectedDate).map((ev: any) => (
                                <div key={ev.id} className="flex justify-between items-center bg-black/40 p-3 rounded border border-gray-800">
                                    <div>
                                        <div className={`text-xs font-bold uppercase mb-1 ${ev.type === 'workout' ? 'text-red-400' :
                                            ev.type === 'checkin' ? 'text-yellow-400' :
                                                'text-blue-400'
                                            }`}>{ev.type}</div>
                                        <div className="text-white text-sm font-bold">{ev.title}</div>
                                        {ev.time && <div className="text-xs text-gray-500 mt-1">{ev.time}</div>}
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteEvent(ev.id); }} className="text-gray-500 hover:text-red-500 p-2">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <hr className="border-gray-800 mb-6" />

                        {/* Add New Event Form */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-bold text-gray-400 uppercase">Añadir Evento</h4>

                            <div className="grid grid-cols-3 gap-2">
                                {['workout', 'checkin', 'event'].map(t => (
                                    <button
                                        key={t}
                                        onClick={() => {
                                            setEventType(t as any);
                                            // Reset title default based on type
                                            if (!newEventTitle)
                                                setNewEventTitle(t === 'workout' ? 'Entrenamiento' : t === 'checkin' ? 'Revisión' : '');
                                        }}
                                        className={`py-2 text-xs font-bold uppercase rounded border transition-all ${eventType === t
                                            ? 'bg-white text-black border-white'
                                            : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700'
                                            }`}
                                    >
                                        {t === 'workout' ? 'Entreno' : t === 'checkin' ? 'Revisión' : 'Evento'}
                                    </button>
                                ))}
                            </div>

                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">Título</label>
                                <input
                                    type="text"
                                    className="w-full bg-gray-800 border-gray-700 rounded p-2 text-white text-sm focus:border-[#BC0000] outline-none"
                                    placeholder="Ej: Pierna Pesada, Videollamada..."
                                    value={newEventTitle}
                                    onChange={(e) => setNewEventTitle(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">Hora (Opcional)</label>
                                <input
                                    type="time"
                                    className="w-full bg-gray-800 border-gray-700 rounded p-2 text-white text-sm focus:border-[#BC0000] outline-none"
                                    value={newEventTime}
                                    onChange={(e) => setNewEventTime(e.target.value)}
                                />
                            </div>

                            <button
                                onClick={handleAddEvent}
                                className="w-full py-3 bg-[#BC0000] hover:bg-red-700 text-white font-bold rounded-lg uppercase tracking-wide text-sm transition-all"
                            >
                                Guardar en Agenda
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <style jsx>{`
                .checkin-stripe {
                    background-image: repeating-linear-gradient(45deg, rgba(234, 179, 8, 0.1), rgba(234, 179, 8, 0.1) 10px, rgba(234, 179, 8, 0.2) 10px, rgba(234, 179, 8, 0.2) 20px);
                }
            `}</style>
        </div>
    );
}
