import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

interface SortableItemProps {
    id: string;
    children: React.ReactNode;
    handle?: boolean;
    className?: string;
}

export function SortableItem({ id, children, handle = true, className = "" }: SortableItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 50 : "auto",
        position: 'relative' as 'relative', // Explicitly cast
    };

    return (
        <div ref={setNodeRef} style={style} className={`${className} bg-inherit`}>
            {handle ? (
                <div className="flex items-center w-full">
                    {/* Drag Handle Wrapper */}
                    <div {...attributes} {...listeners} className="cursor-grab p-2 hover:bg-white/5 rounded touch-none">
                        <GripVertical className="text-gray-500 w-5 h-5" />
                    </div>
                    {/* Content */}
                    <div className="flex-1">
                        {children}
                    </div>
                </div>
            ) : (
                <div {...attributes} {...listeners} className="w-full">
                    {children}
                </div>
            )}
        </div>
    );
}
