import { useState, useEffect } from "react";

interface NoteInputProps {
    initialValue: string;
    onSave: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}

export default function NoteInput({ initialValue, onSave, placeholder, disabled, className }: NoteInputProps) {
    const [value, setValue] = useState(initialValue);

    useEffect(() => {
        setValue(initialValue);
    }, [initialValue]);

    const handleBlur = () => {
        if (value !== initialValue) {
            onSave(value);
        }
    };

    return (
        <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={handleBlur}
            disabled={disabled}
            placeholder={placeholder}
            rows={2}
            className={className}
        />
    );
}
