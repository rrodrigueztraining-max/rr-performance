import { useState, useEffect } from "react";

interface DebouncedInputProps {
    initialValue: string | number;
    onSave: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    type?: "text" | "number";
}

export default function DebouncedInput({ initialValue, onSave, placeholder, disabled, className, type = "text" }: DebouncedInputProps) {
    const [value, setValue] = useState(initialValue);

    useEffect(() => {
        setValue(initialValue);
    }, [initialValue]);

    const handleBlur = () => {
        if (String(value) !== String(initialValue)) {
            onSave(String(value));
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur();
        }
    };

    return (
        <input
            type={type}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={placeholder}
            className={className}
        />
    );
}
