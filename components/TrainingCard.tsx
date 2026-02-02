
import { Calendar, CheckCircle, Circle, Clock, ChevronRight } from "lucide-react";

interface TrainingCardProps {
    workout: {
        id: string;
        title: string;
        date?: string; // Optional, for planned date
        status: 'pending' | 'in_progress' | 'completed';
        blocks?: any[]; // To count exercises/sets
    };
    onSelect: (workout: any) => void;
}

export default function TrainingCard({ workout, onSelect }: TrainingCardProps) {
    const statusConfig = {
        pending: {
            color: "text-gray-400",
            bg: "bg-gray-800/50",
            border: "border-gray-800",
            icon: Circle,
            label: "Pendiente"
        },
        in_progress: {
            color: "text-amber-400",
            bg: "bg-amber-900/10",
            border: "border-amber-500/50",
            icon: Clock,
            label: "En Curso"
        },
        completed: {
            color: "text-green-400",
            bg: "bg-green-900/10",
            border: "border-green-500/50",
            icon: CheckCircle,
            label: "Finalizado"
        }
    };

    const config = statusConfig[workout.status] || statusConfig.pending;
    const StatusIcon = config.icon;

    // Calculate total exercises for display
    const totalExercises = workout.blocks?.reduce((acc, block) => acc + (block.exercises?.length || 0), 0) || 0;

    return (
        <div
            onClick={() => onSelect(workout)}
            className={`group relative p-4 md:p-6 rounded-2xl border ${config.border} ${config.bg} backdrop-blur-sm 
            hover:border-[#BC0000] hover:shadow-[0_0_20px_rgba(188,0,0,0.15)] transition-all cursor-pointer overflow-hidden`}
        >
            {/* Hover Gradient Effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-[#BC0000]/5 opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="relative z-10 flex flex-col h-full justify-between gap-4">
                {/* Header */}
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="text-base md:text-lg font-bold text-white group-hover:text-[#BC0000] transition-colors leading-tight">
                            {workout.title}
                        </h3>
                        {workout.date && (
                            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                <Calendar className="w-3 h-3" />
                                <span>{new Date(workout.date).toLocaleDateString()}</span>
                            </div>
                        )}
                    </div>
                    {workout.status === 'completed' && (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                    )}
                </div>

                {/* Details */}
                <div className="flex items-center gap-4 text-sm text-gray-400">
                    <div className="flex flex-col">
                        <span className="text-xs text-gray-600 uppercase font-bold">Ejercicios</span>
                        <span className="font-mono text-white">{totalExercises}</span>
                    </div>
                    <div className="w-px h-8 bg-gray-800" />
                    <div className="flex flex-col">
                        <span className="text-xs text-gray-600 uppercase font-bold">Estado</span>
                        <div className={`flex items-center gap-1.5 ${config.color} text-xs font-bold mt-0.5`}>
                            <StatusIcon className="w-3 h-3" />
                            {config.label}
                        </div>
                    </div>
                </div>

                {/* Action CTA */}
                <div className="flex items-center text-xs font-bold text-[#BC0000] opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0">
                    VER ENTRENAMIENTO <ChevronRight className="w-3 h-3 ml-1" />
                </div>
            </div>
        </div>
    );
}
