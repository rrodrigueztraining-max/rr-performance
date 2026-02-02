"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Dumbbell, Calendar as CalendarIcon, ClipboardCheck } from "lucide-react";
import { db, auth } from "@/lib/firebase";
import { collection, query, onSnapshot } from "firebase/firestore";

export default function CalendarView() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [events, setEvents] = useState<any[]>([]);
    const [selectedDayEvents, setSelectedDayEvents] = useState<{ day: number, events: any[] } | null>(null);

    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;

        const q = query(collection(db, "users", user.uid, "calendar_events"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const evs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setEvents(evs);
        });

        return () => unsubscribe();
    }, []);

    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay(); // 0 is Sunday

    // Adjust for Monday start (Spanish format)
    const adjustedFirstDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const empties = Array.from({ length: adjustedFirstDay }, (_, i) => i);

    const changeMonth = (offset: number) => {
        const newDate = new Date(currentDate.setMonth(currentDate.getMonth() + offset));
        setCurrentDate(new Date(newDate));
    };

    const getEventsForDay = (day: number) => {
        // Construct date string YYYY-MM-DD manually to match simpler storage
        const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const daypad = String(d.getDate()).padStart(2, '0');
        const localDateStr = `${year}-${month}-${daypad}`;

        return events.filter((e: any) => e.date === localDateStr);
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="flex justify-between items-center bg-black/60 backdrop-blur-md border border-gray-800 p-6 rounded-xl">
                <div>
                    <h2 className="text-3xl font-bold text-white capitalize">
                        {currentDate.toLocaleDateString("es-ES", { month: 'long', year: 'numeric' })}
                    </h2>
                    <p className="text-gray-400">Planificación mensual de entrenamientos.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => changeMonth(-1)} className="p-2 border border-gray-700 rounded-lg hover:border-[#BC0000] hover:text-[#BC0000] transition-colors text-white">
                        <ChevronLeft />
                    </button>
                    <button onClick={() => changeMonth(1)} className="p-2 border border-gray-700 rounded-lg hover:border-[#BC0000] hover:text-[#BC0000] transition-colors text-white">
                        <ChevronRight />
                    </button>
                </div>
            </header>

            <div className="bg-black/60 backdrop-blur-md border border-gray-800 rounded-xl p-8">
                {/* Days Header */}
                <div className="grid grid-cols-7 mb-4">
                    {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(day => (
                        <div key={day} className="text-center text-gray-500 font-bold uppercase text-sm py-2">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-2 lg:gap-4">
                    {empties.map(empty => (
                        <div key={`empty-${empty}`} className="bg-transparent h-24 lg:h-32"></div>
                    ))}

                    {days.map(day => {
                        const dayEvents = getEventsForDay(day);
                        const isToday = day === new Date().getDate() &&
                            currentDate.getMonth() === new Date().getMonth() &&
                            currentDate.getFullYear() === new Date().getFullYear();

                        return (
                            <div
                                key={day}
                                className={`relative h-24 lg:h-32 bg-gray-900/50 border ${isToday ? 'border-[#BC0000]' : 'border-gray-800'} rounded-lg p-3 hover:bg-gray-800 transition-colors group cursor-pointer overflow-hidden`}
                            >
                                <span className={`text-sm font-bold ${isToday ? 'text-[#BC0000]' : 'text-gray-400'}`}>
                                    {day}
                                </span>

                                {/* Mobile Dot Indicator */}
                                <div className="md:hidden mt-2 flex justify-center gap-1">
                                    {dayEvents.length > 0 && (
                                        <div className="flex gap-1">
                                            {dayEvents.slice(0, 3).map((ev: any, i: number) => (
                                                <div key={i} className={`w-1.5 h-1.5 rounded-full ${ev.type === 'workout' ? 'bg-red-500' : ev.type === 'checkin' ? 'bg-yellow-500' : 'bg-blue-500'}`}></div>
                                            ))}
                                            {dayEvents.length > 3 && <div className="w-1.5 h-1.5 rounded-full bg-gray-500"></div>}
                                        </div>
                                    )}
                                </div>

                                {/* Desktop Text Events */}
                                <div className="hidden md:block mt-2 space-y-1 overflow-y-auto max-h-[80px]">
                                    {dayEvents.map((ev: any) => (
                                        <div key={ev.id} className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase truncate border ${ev.type === 'workout' ? 'bg-red-900/20 text-red-500 border-red-900/30' :
                                            ev.type === 'checkin' ? 'bg-yellow-900/20 text-yellow-500 border-yellow-900/30' :
                                                'bg-blue-900/20 text-blue-400 border-blue-900/30'
                                            }`}>
                                            {ev.type === 'workout' && <Dumbbell className="w-3 h-3 flex-shrink-0" />}
                                            {ev.type === 'checkin' && <ClipboardCheck className="w-3 h-3 flex-shrink-0" />}
                                            {ev.type === 'event' && <CalendarIcon className="w-3 h-3 flex-shrink-0" />}

                                            <div className="flex flex-col leading-tight">
                                                <span>{ev.title}</span>
                                                {ev.time && <span className="opacity-70 font-mono text-[9px]">{ev.time}</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>


                                {/* Mobile Click Handler Overlay */}
                                <div
                                    className="md:hidden absolute inset-0 z-10"
                                    onClick={() => setSelectedDayEvents({ day, events: dayEvents })}
                                ></div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Mobile Day Detail Modal */}
            {selectedDayEvents && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 p-4" onClick={() => setSelectedDayEvents(null)}>
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="bg-gray-900 border border-gray-800 w-full max-w-lg rounded-2xl p-6 animate-in zoom-in-95 duration-300 shadow-2xl relative flex flex-col max-h-[85vh]"
                    >
                        <div className="flex justify-between items-center mb-6 flex-shrink-0">
                            <div>
                                <h3 className="text-2xl font-bold text-white">
                                    {selectedDayEvents.day} de {currentDate.toLocaleDateString("es-ES", { month: 'long' })}
                                </h3>
                                <p className="text-gray-400 text-sm">Eventos del día</p>
                            </div>
                            <button onClick={() => setSelectedDayEvents(null)} className="p-2 bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors">✕</button>
                        </div>

                        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                            {selectedDayEvents.events.length === 0 ? (
                                <p className="text-gray-500 text-center py-4">No hay eventos para este día.</p>
                            ) : (
                                selectedDayEvents.events.map((ev: any) => (
                                    <div key={ev.id} className={`flex items-center gap-3 p-4 rounded-xl border ${ev.type === 'workout' ? 'bg-red-900/10 border-red-900/30' :
                                        ev.type === 'checkin' ? 'bg-yellow-900/10 border-yellow-900/30' :
                                            'bg-blue-900/10 border-blue-900/30'
                                        }`}>
                                        <div className={`p-3 rounded-full ${ev.type === 'workout' ? 'bg-red-900/20 text-red-500' :
                                            ev.type === 'checkin' ? 'bg-yellow-900/20 text-yellow-500' :
                                                'bg-blue-900/20 text-blue-400'
                                            }`}>
                                            {ev.type === 'workout' && <Dumbbell className="w-5 h-5" />}
                                            {ev.type === 'checkin' && <ClipboardCheck className="w-5 h-5" />}
                                            {ev.type === 'event' && <CalendarIcon className="w-5 h-5" />}
                                        </div>
                                        <div>
                                            <h4 className="text-white font-bold">{ev.title}</h4>
                                            {ev.time && <p className="text-sm text-gray-400 font-mono">{ev.time}</p>}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )
            }
        </div >
    );
}
