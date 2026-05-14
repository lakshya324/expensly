import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { ChevronDown, X, Check, Loader2 } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

export interface ComboboxOption {
  id: string;
  label: string;
  sublabel?: string;
}

interface SearchComboboxProps {
  /** Currently selected item id - empty string means nothing selected */
  value: string;
  /** Display label of the selected item - used when dropdown is closed */
  selectedLabel: string;
  placeholder: string;
  /** Message shown when search yields no results */
  emptyText?: string;
  disabled?: boolean;
  /** Icon rendered on the left side of the trigger */
  icon?: ReactNode;
  /**
   * Called every time the user types in the search box (debounced by the parent
   * or by the component itself via `debounceMs`).
   * Should return an array of options to display.
   */
  fetchOptions: (query: string) => Promise<ComboboxOption[]>;
  /** Debounce delay in ms (default: 300) */
  debounceMs?: number;
  onSelect: (id: string, label: string) => void;
  onClear: () => void;
  className?: string;
}

export function SearchCombobox({
  value,
  selectedLabel,
  placeholder,
  emptyText = 'No results found',
  disabled = false,
  icon,
  fetchOptions,
  debounceMs = 300,
  onSelect,
  onClear,
  className,
}: SearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<ComboboxOption[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Close on outside click ────────────────────────────────────────────────
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  // ── Debounced fetch ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const results = await fetchOptions(query);
        setOptions(results);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, debounceMs);
    return () => clearTimeout(t);
  }, [query, open, fetchOptions, debounceMs]);

  const openDropdown = useCallback(() => {
    if (disabled) return;
    setQuery('');
    setOptions([]);
    setOpen(true);
    // focus the input on next tick after render
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [disabled]);

  const handleSelect = (opt: ComboboxOption) => {
    onSelect(opt.id, opt.label);
    setOpen(false);
    setQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClear();
    setOpen(false);
  };

  const isSelected = !!value;

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* ── Trigger ─────────────────────────────────────────────────────── */}
      {open ? (
        // Search input shown when open
        <div className="flex h-10 items-center rounded-xl border border-brand-500 ring-2 ring-brand-500/25 bg-(--background) px-3 gap-2">
          {icon && <span className="shrink-0 text-(--muted-foreground)">{icon}</span>}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${placeholder.toLowerCase()}…`}
            className="flex-1 min-w-0 bg-transparent text-sm text-(--foreground) placeholder:text-(--muted-foreground) focus:outline-none"
          />
          {loading && <Loader2 className="w-3.5 h-3.5 text-(--muted-foreground) animate-spin shrink-0" />}
        </div>
      ) : (
        // Closed trigger - looks like a Select trigger
        <button
          type="button"
          disabled={disabled}
          onClick={openDropdown}
          className={cn(
            'flex h-10 w-full items-center gap-2 rounded-xl border bg-(--background) px-3 text-sm transition',
            'focus:outline-none focus:ring-2 focus:ring-brand-500',
            disabled
              ? 'cursor-not-allowed opacity-50 border-(--input)'
              : 'cursor-pointer hover:border-(--foreground)/30 border-(--input)',
          )}
        >
          {icon && <span className="shrink-0 text-(--muted-foreground)">{icon}</span>}
          <span className={cn('flex-1 truncate text-left', isSelected ? 'text-(--foreground)' : 'text-(--muted-foreground)')}>
            {isSelected ? selectedLabel : placeholder}
          </span>
          {isSelected ? (
            <span
              role="button"
              onClick={handleClear}
              className="shrink-0 p-0.5 rounded hover:bg-(--accent) transition"
              aria-label={`Clear ${placeholder}`}
            >
              <X className="w-3.5 h-3.5 text-(--muted-foreground)" />
            </span>
          ) : (
            <ChevronDown className="w-4 h-4 text-(--muted-foreground) shrink-0" />
          )}
        </button>
      )}

      {/* ── Dropdown ─────────────────────────────────────────────────────── */}
      {open && (
        <div className="absolute z-50 top-[calc(100%+4px)] left-0 w-full min-w-45 rounded-xl border border-(--border) bg-(--popover) shadow-lg overflow-hidden animate-in fade-in-0 zoom-in-95">
          {loading && options.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-(--muted-foreground)">
              <Loader2 className="w-4 h-4 animate-spin" />
              Searching…
            </div>
          ) : options.length === 0 ? (
            <p className="py-4 text-center text-sm text-(--muted-foreground)">{emptyText}</p>
          ) : (
            <ul className="max-h-56 overflow-y-auto p-1">
              {options.map((opt) => (
                <li key={opt.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); handleSelect(opt); }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-(--popover-foreground) hover:bg-(--accent) transition text-left"
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block truncate">{opt.label}</span>
                      {opt.sublabel && (
                        <span className="block truncate text-xs text-(--muted-foreground)">{opt.sublabel}</span>
                      )}
                    </span>
                    {value === opt.id && <Check className="w-3.5 h-3.5 text-brand-500 shrink-0" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
