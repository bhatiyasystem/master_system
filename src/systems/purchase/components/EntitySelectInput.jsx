import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
;

/**
 * A free-text input that also offers a searchable dropdown of existing
 * records. Typing is always allowed (primary path); picking a suggestion
 * calls onSelectOption with the full record so the parent can autofill
 * other fields.
 */
export default function EntitySelectInput({
    value,
    onChange,
    options,
    onSelectOption,
    placeholder,
    className = 'form-input',
}) {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(e) {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const term = (value || '').toLowerCase().trim();
    const filtered = term
        ? options.filter((o) => (o.name || '').toLowerCase().includes(term))
        : options;

    return (
        <div className="relative" ref={wrapRef}>
            <div className="relative">
                <input
                    className={className}
                    value={value}
                    placeholder={placeholder}
                    onChange={(e) => {
                        onChange(e.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                />
                <button
                    type="button"
                    onClick={() => setOpen((o) => !o)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                >
                    <ChevronDown size={14} />
                </button>
            </div>

            {open && filtered.length > 0 && (
                <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                    {filtered.slice(0, 30).map((o) => (
                        <button
                            key={o.id}
                            type="button"
                            className="block w-full px-3.5 py-2 text-left text-[12.5px] hover:bg-gray-50"
                            onClick={() => {
                                onSelectOption(o);
                                setOpen(false);
                            }}
                        >
                            <div className="font-semibold text-gray-900">{o.name}</div>
                            {(o.contact || o.gstin) && (
                                <div className="text-[11px] text-gray-500">
                                    {[o.contact, o.gstin].filter(Boolean).join(' · ')}
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}