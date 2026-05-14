import { useState } from 'react';
import { Search, SlidersHorizontal, X, Flag, Building2, Users, CalendarDays } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/shared/components/ui/Select';
import { SearchCombobox, type ComboboxOption } from '@/shared/components/ui/SearchCombobox';
import type { TicketStatus } from '@/core/types/api.types';

const STATUS_OPTIONS: { label: string; value: TicketStatus | '' }[] = [
  { label: 'All statuses', value: '' },
  { label: 'Draft', value: 'draft' },
  { label: 'Scanning', value: 'scanning' },
  { label: 'Scan Failed', value: 'ocr_failed' },
  { label: 'Pending', value: 'pending' },
  { label: 'Awaiting Finance', value: 'awaiting_finance' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
];

// ── Compact styled date input ────────────────────────────────────────────────
function DateInput({
  value,
  onChange,
  min,
  max,
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
  'aria-label': string;
}) {
  return (
    <div className="relative">
      <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-(--muted-foreground) pointer-events-none z-10" />
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 pl-8 pr-7 w-38 rounded-xl border border-(--input) bg-(--background) text-sm text-(--foreground) focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-(--accent) transition z-10"
          aria-label={`Clear ${ariaLabel}`}
        >
          <X className="w-3 h-3 text-(--muted-foreground)" />
        </button>
      )}
    </div>
  );
}

// ── Props ────────────────────────────────────────────────────────────────────
interface ExpenseFiltersBarProps {
  // Core (used by every view)
  searchInput: string;
  onSearchChange: (value: string) => void;
  status: TicketStatus | '';
  onStatusChange: (value: TicketStatus | '') => void;
  hasActiveFilters: boolean;
  onClear: () => void;
  placeholder?: string;

  // ── Admin-only (omit entirely for non-admin views) ─────────────────────
  fetchDepartments?: (query: string) => Promise<ComboboxOption[]>;
  departmentId?: string;
  departmentLabel?: string;
  onDepartmentChange?: (id: string, label: string) => void;

  fetchUsers?: (query: string) => Promise<ComboboxOption[]>;
  userId?: string;
  userLabel?: string;
  onUserChange?: (id: string, label: string) => void;

  dateFrom?: string;
  dateTo?: string;
  onDateFromChange?: (v: string) => void;
  onDateToChange?: (v: string) => void;

  flagged?: boolean;
  onFlaggedChange?: (v: boolean) => void;
}

export function ExpenseFiltersBar({
  searchInput,
  onSearchChange,
  status,
  onStatusChange,
  hasActiveFilters,
  onClear,
  placeholder = 'Search expenses…',
  fetchDepartments,
  departmentId = '',
  departmentLabel = '',
  onDepartmentChange,
  fetchUsers,
  userId = '',
  userLabel = '',
  onUserChange,
  dateFrom = '',
  dateTo = '',
  onDateFromChange,
  onDateToChange,
  flagged = false,
  onFlaggedChange,
}: ExpenseFiltersBarProps) {
  const isAdminView = fetchDepartments !== undefined;
  // Show advanced filters toggle whenever any advanced capability is wired up
  const hasAdvancedFilters =
    isAdminView || !!onDateFromChange || !!onDateToChange || !!onFlaggedChange;
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Count how many advanced filters are active (for the badge)
  const advancedCount = [
    !!departmentId,
    !!userId,
    !!dateFrom,
    !!dateTo,
    flagged,
  ].filter(Boolean).length;

  return (
    <div className="space-y-2">
      {/* ── Row 1: always-visible controls ─────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-52 max-w-sm">
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

        {/* Status */}
        <Select
          value={status || 'all'}
          onValueChange={(v) => onStatusChange(v === 'all' ? '' : (v as TicketStatus))}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value || 'all'} value={opt.value || 'all'}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Advanced filters toggle */}
        {hasAdvancedFilters && (
          <button
            type="button"
            onClick={() => setAdvancedOpen((o) => !o)}
            className={`relative inline-flex items-center gap-2 h-10 px-3.5 rounded-xl border text-sm font-medium transition select-none
              ${advancedOpen || advancedCount > 0
                ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:border-brand-500/60 dark:text-brand-400'
                : 'border-(--input) bg-(--background) text-(--muted-foreground) hover:text-(--foreground) hover:border-(--foreground)/30'
              }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
            Filters
            {advancedCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 text-[10px] font-bold text-white px-1 leading-none">
                {advancedCount}
              </span>
            )}
          </button>
        )}

        {/* Clear - right-aligned */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="text-(--muted-foreground) hover:text-(--foreground) ml-auto"
          >
            <X className="w-3.5 h-3.5 mr-1.5" />
            Clear
          </Button>
        )}
      </div>

      {/* ── Advanced filters panel (collapsible) ────────────────────────── */}
      {hasAdvancedFilters && advancedOpen && (
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl border border-(--border) bg-(--muted)/30">
          {/* Department combobox */}
          {fetchDepartments && onDepartmentChange && (
            <SearchCombobox
              value={departmentId}
              selectedLabel={departmentLabel}
              placeholder="All departments"
              emptyText="No departments found"
              icon={<Building2 className="w-3.5 h-3.5" />}
              fetchOptions={fetchDepartments}
              onSelect={(id, label) => { onDepartmentChange(id, label); }}
              onClear={() => onDepartmentChange('', '')}
              className="w-48"
            />
          )}

          {/* User combobox - disabled until a dept is picked */}
          {fetchUsers && onUserChange && (
            <SearchCombobox
              value={userId}
              selectedLabel={userLabel}
              placeholder="All users"
              emptyText={departmentId ? 'No users found' : 'Select a department first'}
              icon={<Users className="w-3.5 h-3.5" />}
              fetchOptions={departmentId ? fetchUsers : async () => []}
              disabled={!departmentId}
              onSelect={(id, label) => onUserChange(id, label)}
              onClear={() => onUserChange('', '')}
              className="w-48"
            />
          )}

          {/* Date range */}
          {(onDateFromChange || onDateToChange) && (
            <div className="flex items-center gap-1.5">
              <DateInput
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(v) => onDateFromChange?.(v)}
                aria-label="From date"
              />
              <span className="text-(--muted-foreground) text-sm select-none">–</span>
              <DateInput
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(v) => onDateToChange?.(v)}
                aria-label="To date"
              />
            </div>
          )}

          {/* Flagged toggle */}
          {onFlaggedChange && (
            <button
              type="button"
              onClick={() => onFlaggedChange(!flagged)}
              aria-pressed={flagged}
              className={`inline-flex items-center gap-1.5 h-10 px-3 rounded-xl border text-sm font-medium transition select-none
                ${flagged
                  ? 'border-yellow-400 bg-yellow-50 text-yellow-700 dark:bg-yellow-500/15 dark:border-yellow-500/60 dark:text-yellow-400'
                  : 'border-(--input) bg-(--background) text-(--muted-foreground) hover:text-(--foreground) hover:border-(--foreground)/30'}`}
            >
              <Flag className={`w-3.5 h-3.5 transition ${flagged ? 'fill-yellow-400 text-yellow-500' : ''}`} />
              Flagged only
            </button>
          )}
        </div>
      )}
    </div>
  );
}

