import { Search, Filter, X } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/shared/components/ui/Select';
import type { TicketStatus } from '@/core/types/api.types';

const STATUS_OPTIONS: { label: string; value: TicketStatus | '' }[] = [
  { label: 'All statuses', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'Awaiting Finance', value: 'awaiting_finance' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
];

interface ExpenseFiltersBarProps {
  /** Raw value of the search input (not yet debounced). */
  searchInput: string;
  onSearchChange: (value: string) => void;
  status: TicketStatus | '';
  onStatusChange: (value: TicketStatus | '') => void;
  /** Whether any filter is currently active — shows the "Clear filters" button. */
  hasActiveFilters: boolean;
  onClear: () => void;
  placeholder?: string;
}

/**
 * Shared filter bar used in both ExpensesPage and AdminExpensesPage.
 * Debounce / commit logic lives in the parent so each page can control timing.
 */
export function ExpenseFiltersBar({
  searchInput,
  onSearchChange,
  status,
  onStatusChange,
  hasActiveFilters,
  onClear,
  placeholder = 'Search expenses…',
}: ExpenseFiltersBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {/* Search input */}
      <div className="relative flex-1 min-w-50 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--muted-foreground) pointer-events-none" />
        <input
          value={searchInput}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          className="w-full h-10 pl-9 pr-8 rounded-xl border border-(--input) bg-(--background) text-sm text-(--foreground) placeholder:text-(--muted-foreground) focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
        />
        {searchInput && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-(--accent) transition"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5 text-(--muted-foreground)" />
          </button>
        )}
      </div>

      {/* Status select */}
      <Select
        value={status || 'all'}
        onValueChange={(v) => {
          onStatusChange(v === 'all' ? '' : (v as TicketStatus));
        }}
      >
        <SelectTrigger className="w-45">
          <Filter className="w-3.5 h-3.5 mr-1.5 text-(--muted-foreground) shrink-0" />
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value || 'all'} value={opt.value || 'all'}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Clear all */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="text-(--muted-foreground) hover:text-(--foreground)"
        >
          <X className="w-3.5 h-3.5 mr-1.5" />
          Clear filters
        </Button>
      )}
    </div>
  );
}
