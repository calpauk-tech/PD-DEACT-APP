import React, { useState, useEffect, useRef } from 'react';

export interface FilterOption {
    id: number;
    name: string;
}

export interface MultiSelectMenuProps {
    label: string;
    options: FilterOption[];
    selectedIds: number[];
    onChange: (ids: number[]) => void;
    // Optional secondary toggle (used for Primary Department mode)
    toggleOptionLabel?: string;
    toggleOptionEnabled?: boolean;
    onToggleOption?: (enabled: boolean) => void;
    toggleTooltipText?: React.ReactNode;
}

export const MultiSelectMenu: React.FC<MultiSelectMenuProps> = ({
    label,
    options,
    selectedIds,
    onChange,
    toggleOptionLabel,
    toggleOptionEnabled,
    onToggleOption,
    toggleTooltipText
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const menuRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setSearchTerm('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const isAllSelected = selectedIds.length === 0 || (options.length > 0 && selectedIds.length === options.length);
    const isNoneSelected = selectedIds.length === 1 && selectedIds[0] === -1;

    const filteredOptions = options.filter(opt =>
        opt.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const isAllSearchFilteredSelected =
        filteredOptions.length > 0 &&
        filteredOptions.every(opt => isAllSelected || selectedIds.includes(opt.id));

    const handleSelectAll = (checked: boolean) => {
        onChange(checked ? [] : [-1]);
    };

    const handleSelectAllSearch = (checked: boolean) => {
        if (checked) {
            let newSelected = isAllSelected ? options.map(o => o.id) : [...selectedIds];
            filteredOptions.forEach(opt => {
                if (!newSelected.includes(opt.id)) newSelected.push(opt.id);
            });
            onChange(newSelected.length === options.length ? [] : newSelected);
        } else {
            let newSelected = isAllSelected ? options.map(o => o.id) : [...selectedIds];
            const filteredIds = filteredOptions.map(o => o.id);
            newSelected = newSelected.filter(id => !filteredIds.includes(id));
            onChange(newSelected.length === 0 ? [-1] : newSelected);
        }
    };

    const handleOptionToggle = (optId: number, checked: boolean) => {
        if (isAllSelected) {
            if (!checked) {
                onChange(options.filter(o => o.id !== optId).map(o => o.id));
            }
        } else if (isNoneSelected) {
            if (checked) onChange([optId]);
        } else {
            if (checked) {
                const next = [...selectedIds, optId];
                onChange(next.length === options.length ? [] : next);
            } else {
                const next = selectedIds.filter(id => id !== optId);
                onChange(next.length === 0 ? [-1] : next);
            }
        }
    };

    const buttonLabel = isAllSelected
        ? `All ${toggleOptionEnabled && toggleOptionLabel ? toggleOptionLabel : (label.endsWith('s') ? label : label + 's')}`
        : `${isNoneSelected ? 0 : selectedIds.length} selected`;

    return (
        <div className={`flex-1 min-w-[180px] relative ${isOpen ? 'z-50' : 'z-10'}`} ref={menuRef}>
            <div className="flex justify-between items-center mb-1 gap-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide truncate">
                    {toggleOptionEnabled && toggleOptionLabel ? toggleOptionLabel : label}
                </label>
                {onToggleOption && (
                    <div className="flex items-center gap-1.5 shrink-0" title={typeof toggleTooltipText === 'string' ? toggleTooltipText : undefined}>
                        {toggleTooltipText && (
                            <span className="text-amber-500 cursor-help text-xs select-none">
                                ℹ️
                            </span>
                        )}
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={!!toggleOptionEnabled}
                                onChange={(e) => onToggleOption(e.target.checked)}
                            />
                            <div className="w-7 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:bg-amber-500 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all"></div>
                        </label>
                    </div>
                )}
            </div>

            <button
                type="button"
                className={`w-full text-left text-xs sm:text-sm border bg-white rounded-xl shadow-xs px-3 py-2 flex items-center justify-between hover:bg-gray-50/80 focus:ring-2 focus:ring-blue-500 transition-colors cursor-pointer ${
                    !isAllSelected ? 'border-blue-400 bg-blue-50/30 font-medium text-blue-900' : 'border-gray-300 text-gray-700'
                }`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="truncate">{buttonLabel}</span>
                <span className="text-gray-400 ml-2 text-xs shrink-0">▼</span>
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-1.5 w-full min-w-[240px] max-w-sm left-0 bg-white border border-gray-200 rounded-xl shadow-2xl flex flex-col overflow-hidden">
                    <div className="p-2 border-b border-gray-100 bg-gray-50/70">
                        <input
                            type="text"
                            placeholder={`Search ${label.toLowerCase()}...`}
                            className="w-full text-xs sm:text-sm px-2.5 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                            value={searchTerm}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div className="max-h-60 overflow-y-auto divide-y divide-gray-50">
                        {options.length === 0 ? (
                            <div className="px-4 py-4 text-xs sm:text-sm text-gray-400 italic text-center">
                                No {label.toLowerCase()} available
                            </div>
                        ) : (
                            <>
                                {searchTerm.length === 0 ? (
                                    <label className="flex items-center gap-3 px-3.5 py-2 hover:bg-blue-50/50 cursor-pointer border-b border-gray-100 font-medium text-xs sm:text-sm text-gray-800">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 text-blue-600 rounded border-gray-300 cursor-pointer"
                                            checked={isAllSelected}
                                            onChange={(e) => handleSelectAll(e.target.checked)}
                                        />
                                        <span>All ({options.length})</span>
                                    </label>
                                ) : (
                                    <label className="flex items-center gap-3 px-3.5 py-2 hover:bg-blue-50/50 cursor-pointer border-b border-gray-100 font-medium text-xs sm:text-sm text-gray-800">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 text-blue-600 rounded border-gray-300 cursor-pointer"
                                            checked={isAllSearchFilteredSelected}
                                            onChange={(e) => handleSelectAllSearch(e.target.checked)}
                                        />
                                        <span>Select all matching ({filteredOptions.length})</span>
                                    </label>
                                )}

                                {filteredOptions.length === 0 ? (
                                    <div className="px-4 py-3 text-xs sm:text-sm text-gray-400 italic text-center">No matches found</div>
                                ) : (
                                    filteredOptions.map(opt => {
                                        const isChecked = isAllSelected || selectedIds.includes(opt.id);
                                        return (
                                            <label key={opt.id} className="flex items-center gap-3 px-3.5 py-2 hover:bg-gray-50 cursor-pointer text-xs sm:text-sm text-gray-700">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 text-blue-600 rounded border-gray-300 cursor-pointer"
                                                    checked={isChecked}
                                                    onChange={(e) => handleOptionToggle(opt.id, e.target.checked)}
                                                />
                                                <span className="truncate">{opt.name}</span>
                                            </label>
                                        );
                                    })
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
