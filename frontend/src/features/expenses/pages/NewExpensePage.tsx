import { useEffect, useState, useRef, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Upload, X, FileText, Image, Tag, Sparkles, PenLine,
  CheckCircle2, AlertTriangle, Info, Loader2, ScanLine,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/shared/utils/cn';
import { AppShell } from '@/shared/components/layout/AppShell';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/Card';
import { Badge } from '@/shared/components/ui/Badge';
import { useCreateExpense, useScanReceipt, useSubmitDraft } from '../hooks/useExpenses';
import { createExpenseSchema, type CreateExpenseFormValues } from '../validators';
import { ROUTES } from '@/core/constants/constants';
import apiClient from '@/infrastructure/api/client';
import { EP } from '@/infrastructure/api/endpoints';
import { useAuthStore } from '@/features/auth/store/authStore';
import type { ApiResponse } from '@/core/types/api.types';
import type { ITicketData } from '@/core/types/ticket.types';

// ─── Shared helpers ────────────────────────────────────────────

type Mode = 'picker' | 'ai_upload' | 'ai_scanning' | 'ai_review' | 'manual';

const VALID_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_SIZE = 10 * 1024 * 1024;

function validateFile(file: File): string | null {
  if (!VALID_TYPES.includes(file.type)) return 'Only JPG, PNG, or PDF files are accepted.';
  if (file.size > MAX_SIZE) return 'File must be under 10 MB.';
  return null;
}

function FileIcon({ type }: { type: string }) {
  if (type === 'application/pdf') return <FileText className="w-5 h-5 text-danger-500" />;
  return <Image className="w-5 h-5 text-brand-500" />;
}

// ─── Mode picker ───────────────────────────────────────────────

function ModePicker({ onSelect }: { onSelect: (mode: 'ai' | 'manual') => void }) {
  return (
    <div className="space-y-4">
      <div className="text-center mb-2">
        <h2 className="text-xl font-bold text-[var(--foreground)]">New Expense</h2>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">How would you like to create this expense?</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* AI Scan Card */}
        <button
          type="button"
          onClick={() => onSelect('ai')}
          className="group relative text-left rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] p-6 transition-all hover:border-brand-500 hover:shadow-lg hover:shadow-brand-500/10 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          {/* shimmer bg on hover */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-500/5 via-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          <div className="relative">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 shadow-lg shadow-brand-500/30 mb-4">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-base font-bold text-[var(--foreground)]">AI Scan Receipt</h3>
              <Badge variant="default" className="text-[10px] px-1.5 py-0.5">SMART</Badge>
            </div>
            <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
              Snap or upload a photo. Our AI reads the receipt and fills in all the details automatically.
            </p>
            <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-brand-600 dark:text-brand-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Auto-fills amount, merchant &amp; date</span>
            </div>
          </div>
        </button>

        {/* Manual Card */}
        <button
          type="button"
          onClick={() => onSelect('manual')}
          className="group text-left rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] p-6 transition-all hover:border-[var(--foreground)]/30 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--muted)] mb-4">
            <PenLine className="w-6 h-6 text-[var(--muted-foreground)]" />
          </div>
          <h3 className="text-base font-bold text-[var(--foreground)] mb-2">Manual Entry</h3>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            Fill in the expense details yourself. Optionally attach a receipt for your records.
          </p>
          <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)]">
            <Info className="w-3.5 h-3.5" />
            <span>Full control over all fields</span>
          </div>
        </button>
      </div>
    </div>
  );
}

// ─── AI Upload Step ────────────────────────────────────────────

function AiUploadStep({
  onFileSelected,
  onBack,
}: {
  onFileSelected: (file: File) => void;
  onBack: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    const err = validateFile(file);
    if (err) { toast.error(err); return; }
    onFileSelected(file);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="text-xl font-bold text-[var(--foreground)]">Scan Receipt</h2>
          <p className="text-sm text-[var(--muted-foreground)]">Upload your receipt and AI will extract all details</p>
        </div>
      </div>

      {/* Drop zone */}
      <button
        type="button"
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
        onClick={() => fileRef.current?.click()}
        className={cn(
          'relative w-full rounded-2xl border-2 border-dashed p-12 text-center transition-all cursor-pointer group',
          dragOver
            ? 'border-brand-500 bg-brand-500/5'
            : 'border-[var(--border)] hover:border-brand-400 hover:bg-brand-500/3',
        )}
      >
        {/* Gradient glow */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-500/5 via-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

        <div className="relative flex flex-col items-center gap-4">
          <div className={cn(
            'flex items-center justify-center w-20 h-20 rounded-2xl transition-all',
            dragOver
              ? 'bg-gradient-to-br from-brand-500 to-purple-600 shadow-lg shadow-brand-500/30'
              : 'bg-gradient-to-br from-brand-100 to-purple-100 dark:from-brand-900/50 dark:to-purple-900/30 group-hover:from-brand-500 group-hover:to-purple-600 group-hover:shadow-lg group-hover:shadow-brand-500/30',
          )}>
            <Sparkles className={cn(
              'w-9 h-9 transition-all',
              dragOver
                ? 'text-white'
                : 'text-brand-600 dark:text-brand-400 group-hover:text-white',
            )} />
          </div>
          <div>
            <p className="text-base font-semibold text-[var(--foreground)]">
              {dragOver ? 'Drop to scan' : 'Drop receipt here'}
            </p>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              or <span className="text-brand-600 dark:text-brand-400 font-medium">browse files</span>
            </p>
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">JPG, PNG or PDF · max 10 MB</p>
        </div>
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />

      {/* Feature hints */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: '🔍', label: 'Reads amounts' },
          { icon: '🏪', label: 'Detects merchant' },
          { icon: '📅', label: 'Extracts date' },
        ].map(({ icon, label }) => (
          <div key={label} className="flex flex-col items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 text-center">
            <span className="text-xl">{icon}</span>
            <span className="text-xs text-[var(--muted-foreground)]">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── AI Scanning Animation ─────────────────────────────────────

const SCAN_STEPS = [
  'Reading receipt image…',
  'Detecting merchant & amounts…',
  'Validating expense details…',
  'Finalising AI suggestions…',
];

function AiScanningStep({ file }: { file: File }) {
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIdx((i) => Math.min(i + 1, SCAN_STEPS.length - 1));
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;

  return (
    <div className="space-y-6 text-center py-4">
      {/* Receipt preview */}
      {previewUrl ? (
        <div className="relative mx-auto w-32 h-40 rounded-xl overflow-hidden border border-[var(--border)] shadow-md">
          <img src={previewUrl} alt="Receipt" className="w-full h-full object-cover" />
          {/* scan line animation */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-brand-400 to-transparent animate-scan-line" />
          </div>
          {/* overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-brand-500/10 to-transparent" />
        </div>
      ) : (
        <div className="relative mx-auto w-32 h-40 rounded-xl border border-[var(--border)] bg-[var(--muted)] flex items-center justify-center shadow-md">
          <FileText className="w-10 h-10 text-[var(--muted-foreground)]" />
          <div className="absolute inset-0 overflow-hidden rounded-xl">
            <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-brand-400 to-transparent animate-scan-line" />
          </div>
        </div>
      )}

      {/* Animated icon */}
      <div className="flex items-center justify-center">
        <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 shadow-lg shadow-brand-500/30">
          <ScanLine className="w-7 h-7 text-white" />
          {/* pulse rings */}
          <span className="absolute inset-0 rounded-full border-2 border-brand-400 animate-ping opacity-40" />
        </div>
      </div>

      <div>
        <p className="text-lg font-bold text-[var(--foreground)]">AI is analysing your receipt</p>
        <p className="text-sm text-[var(--muted-foreground)] mt-1 h-5 transition-all">
          {SCAN_STEPS[stepIdx]}
        </p>
      </div>

      {/* Step indicators */}
      <div className="flex justify-center gap-1.5">
        {SCAN_STEPS.map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-1.5 rounded-full transition-all duration-500',
              i < stepIdx ? 'w-4 bg-brand-500' :
              i === stepIdx ? 'w-6 bg-brand-500 animate-pulse' :
              'w-1.5 bg-[var(--muted)]',
            )}
          />
        ))}
      </div>
    </div>
  );
}

// ─── AI Review form ────────────────────────────────────────────

interface AiReviewStepProps {
  draft: ITicketData;
  onSubmit: (fd: FormData) => void;
  onBack: () => void;
  loading: boolean;
  activeCurrencies: string[];
}

function AiReviewStep({ draft, onSubmit, onBack, loading, activeCurrencies }: AiReviewStepProps) {
  const [title, setTitle] = useState(draft.title ?? '');
  const [amount, setAmount] = useState(draft.amount?.toString() ?? '');
  const [currency, setCurrency] = useState(draft.currency ?? activeCurrencies[0] ?? 'USD');
  const [description, setDescription] = useState(draft.description ?? '');

  const ocr = draft.ocrData;
  const ai = draft.aiValidation;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { toast.error('Title is required'); return; }
    if (!amount || Number(amount) <= 0) { toast.error('Enter a valid amount'); return; }
    const fd = new FormData();
    fd.append('title', title.trim());
    fd.append('amount', amount);
    fd.append('currency', currency);
    if (description.trim()) fd.append('description', description.trim());
    onSubmit(fd);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="icon-sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[var(--foreground)]">Review AI Results</h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-brand-500 to-purple-600 text-white">
              <Sparkles className="w-3 h-3" /> AI
            </span>
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">Review and confirm the extracted details</p>
        </div>
      </div>

      {/* AI Validation banner */}
      {ai && ai.overallStatus !== 'ok' && (
        <div className={cn(
          'flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm',
          ai.overallStatus === 'error'
            ? 'border-danger-200 dark:border-danger-500/30 bg-danger-50 dark:bg-danger-500/10 text-danger-700 dark:text-danger-400'
            : 'border-warning-200 dark:border-warning-500/30 bg-warning-50 dark:bg-warning-500/10 text-warning-700 dark:text-warning-400',
        )}>
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">
              {ai.overallStatus === 'error' ? 'Some fields need attention' : 'Review suggested changes'}
            </p>
            <ul className="mt-1 space-y-0.5 text-xs">
              {ai.checks.filter((c) => c.status !== 'ok').map((c) => (
                <li key={c.field}>• {c.message}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Expense Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Input
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Team lunch, Flight to NYC"
            />
            {ocr && (
              <span className="absolute right-3 top-8 flex items-center gap-1 text-[10px] text-brand-500 dark:text-brand-400">
                <Sparkles className="w-2.5 h-2.5" /> AI filled
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <Input
                label="Amount"
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
              {ocr?.total && (
                <span className="absolute right-3 top-8 flex items-center gap-1 text-[10px] text-brand-500 dark:text-brand-400">
                  <Sparkles className="w-2.5 h-2.5" /> {Math.round(ocr.total.confidence * 100)}%
                </span>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--input)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {activeCurrencies.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional details..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--input)] bg-[var(--background)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>

          {/* OCR confidence bar */}
          {ocr && (
            <div className="flex items-center gap-2.5 rounded-xl bg-[var(--muted)] px-3.5 py-2.5">
              <Sparkles className="w-4 h-4 text-brand-500 dark:text-brand-400 shrink-0" />
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[var(--muted-foreground)]">AI confidence</span>
                  <span className="font-semibold text-[var(--foreground)]">{Math.round(ocr.confidence * 100)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--background)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-500 to-purple-500 transition-all"
                    style={{ width: `${Math.round(ocr.confidence * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onBack} className="flex-1">
          Re-scan
        </Button>
        <Button type="submit" loading={loading} className="flex-1">
          <CheckCircle2 className="w-4 h-4" />
          Submit Expense
        </Button>
      </div>
    </form>
  );
}

// ─── Manual Form ───────────────────────────────────────────────

interface ManualFormProps {
  onBack: () => void;
}

function ManualForm({ onBack }: ManualFormProps) {
  const navigate = useNavigate();
  const { createExpense, loading } = useCreateExpense();
  const { user } = useAuthStore();
  const [deptTags, setDeptTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [tagHighlight, setTagHighlight] = useState(-1);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CreateExpenseFormValues>({ resolver: zodResolver(createExpenseSchema) });

  useEffect(() => {
    const deptId = user?.department?._id;
    if (!deptId) return;
    apiClient
      .get<ApiResponse<string[]>>(EP.USER_DEPT_TAGS(deptId))
      .then((res) => setDeptTags(res.data.data))
      .catch(() => {});
  }, [user?.department?._id]);

  const toggleTag = (tag: string) => {
    const trimmed = tag.trim().toLowerCase();
    if (!trimmed) return;
    if (selectedTags.includes(trimmed)) {
      setSelectedTags((prev) => prev.filter((t) => t !== trimmed));
    } else if (selectedTags.length < 5) {
      setSelectedTags((prev) => [...prev, trimmed]);
    }
  };

  const closeTagDropdown = useCallback(() => {
    setTagDropdownOpen(false);
    setTagHighlight(-1);
  }, []);

  const addTagsFromString = useCallback((raw: string) => {
    const parts = raw.split(/[,\s]+/).map((t) => t.trim().toLowerCase()).filter(Boolean);
    setSelectedTags((prev) => {
      const merged = [...prev];
      for (const part of parts) {
        if (merged.length >= 5) break;
        if (!merged.includes(part)) merged.push(part);
      }
      return merged;
    });
    setTagInput('');
    setTagDropdownOpen(false);
    setTagHighlight(-1);
  }, []);

  const addTagFromInput = useCallback(() => {
    addTagsFromString(tagInput);
  }, [tagInput, addTagsFromString]);

  const filteredSuggestions = deptTags
    .filter((t) => t.toLowerCase().includes(tagInput.toLowerCase()) && !selectedTags.includes(t))
    .slice(0, 6);

  const handleFile = (file: File) => {
    const err = validateFile(file);
    if (err) { toast.error(err); return; }
    setReceipt(file);
  };

  const onSubmit = async (values: CreateExpenseFormValues) => {
    const fd = new FormData();
    fd.append('title', values.title);
    fd.append('amount', values.amount);
    fd.append('currency', values.currency);
    if (user?.department?._id) fd.append('department', user.department._id);
    if (values.description) fd.append('description', values.description);
    selectedTags.forEach((t) => fd.append('tags[]', t));
    if (receipt) fd.append('receipt', receipt);
    const result = await createExpense(fd);
    if (result) navigate(ROUTES.EXPENSES);
  };

  const activeCurrencies = user?.org?.activeCurrencies ?? [];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="icon-sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="text-xl font-bold text-[var(--foreground)]">Manual Entry</h2>
          <p className="text-sm text-[var(--muted-foreground)]">Fill in the expense details below</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Expense Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Input
            {...register('title')}
            label="Title"
            placeholder="e.g. Team lunch, Flight to NYC"
            error={errors.title?.message}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              {...register('amount')}
              label="Amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              error={errors.amount?.message}
            />
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Currency</label>
              <Controller
                name="currency"
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--input)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="">Select currency</option>
                    {activeCurrencies.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
              />
              {errors.currency && <p className="mt-1.5 text-xs text-danger-500">{errors.currency.message}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Description</label>
            <textarea
              {...register('description')}
              rows={3}
              placeholder="Optional details about this expense..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--input)] bg-[var(--background)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
              Tags <span className="text-[var(--muted-foreground)] font-normal">({selectedTags.length}/5)</span>
            </label>
            {selectedTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-brand-600 dark:bg-brand-500 text-white"
                  >
                    <Tag className="w-3 h-3" />
                    {tag}
                    <button type="button" onClick={() => toggleTag(tag)} className="ml-0.5 hover:opacity-70 transition">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {selectedTags.length < 5 && (
              <div className="relative">
                <input
                  ref={tagInputRef}
                  type="text"
                  value={tagInput}
                  onChange={(e) => { setTagInput(e.target.value); setTagDropdownOpen(true); setTagHighlight(-1); }}
                  onFocus={() => setTagDropdownOpen(true)}
                  onBlur={() => setTimeout(() => closeTagDropdown(), 150)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') { e.preventDefault(); setTagDropdownOpen(true); setTagHighlight((i) => Math.min(i + 1, filteredSuggestions.length - 1)); }
                    else if (e.key === 'ArrowUp') { e.preventDefault(); setTagHighlight((i) => Math.max(i - 1, -1)); }
                    else if (e.key === 'Enter') {
                      e.preventDefault();
                      if (tagHighlight >= 0 && filteredSuggestions[tagHighlight]) { toggleTag(filteredSuggestions[tagHighlight]); setTagInput(''); closeTagDropdown(); }
                      else { addTagFromInput(); }
                    } else if (e.key === 'Escape') { closeTagDropdown(); }
                  }}
                  onPaste={(e) => { e.preventDefault(); addTagsFromString(tagInput + e.clipboardData.getData('text')); }}
                  placeholder="Add tags…"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--input)] bg-[var(--background)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                {tagDropdownOpen && filteredSuggestions.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] shadow-lg overflow-hidden">
                    {filteredSuggestions.map((tag, i) => (
                      <button
                        key={tag}
                        type="button"
                        onMouseEnter={() => setTagHighlight(i)}
                        onMouseDown={(e) => { e.preventDefault(); toggleTag(tag); setTagInput(''); closeTagDropdown(); }}
                        className={`w-full text-left px-3.5 py-2 text-sm text-[var(--foreground)] flex items-center gap-2 transition ${i === tagHighlight ? 'bg-[var(--accent)]' : 'hover:bg-[var(--accent)]'}`}
                      >
                        <Tag className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                        {tag}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Receipt */}
      <Card>
        <CardHeader><CardTitle>Receipt <span className="text-sm font-normal text-[var(--muted-foreground)]">(optional)</span></CardTitle></CardHeader>
        <CardContent>
          {receipt ? (
            <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3.5 py-3">
              <div className="flex items-center gap-2.5">
                <FileIcon type={receipt.type} />
                <div>
                  <p className="text-sm font-medium text-[var(--foreground)] truncate max-w-52">{receipt.name}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">{(receipt.size / 1024).toFixed(0)} KB</p>
                </div>
              </div>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => setReceipt(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              onClick={() => fileRef.current?.click()}
              className={cn(
                'w-full rounded-xl border-2 border-dashed p-6 text-center transition-all cursor-pointer',
                dragOver ? 'border-brand-500 bg-brand-500/5' : 'border-[var(--border)] hover:border-brand-400',
              )}
            >
              <Upload className="w-6 h-6 mx-auto text-[var(--muted-foreground)] mb-2" />
              <p className="text-sm text-[var(--muted-foreground)]">Drop file or <span className="text-brand-600 dark:text-brand-400">browse</span></p>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">JPG, PNG or PDF · max 10 MB</p>
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          type="button"
          variant="ghost"
          className="flex-1 border border-dashed border-[var(--border)] opacity-50 cursor-not-allowed"
          onClick={() => toast.info('Save as Draft is coming soon')}
          title="Save as Draft (coming soon)"
        >
          Save as Draft
        </Button>
        <Button type="submit" loading={loading} className="flex-1">
          Submit Expense
        </Button>
      </div>
    </form>
  );
}

// ─── Page ──────────────────────────────────────────────────────

export function NewExpensePage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [mode, setMode] = useState<Mode>('picker');
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [draftTicket, setDraftTicket] = useState<ITicketData | null>(null);
  const { scanReceipt, loading: scanLoading } = useScanReceipt();
  const { submitDraft, loading: submitLoading } = useSubmitDraft();

  const activeCurrencies = user?.org?.activeCurrencies ?? [];

  const handleFileSelected = async (file: File) => {
    setScanFile(file);
    setMode('ai_scanning');
    const ticket = await scanReceipt(file);
    if (ticket) {
      setDraftTicket(ticket);
      setMode('ai_review');
    } else {
      // On scan failure, drop back to upload
      setMode('ai_upload');
    }
  };

  const handleDraftSubmit = async (fd: FormData) => {
    if (!draftTicket) return;
    const result = await submitDraft(draftTicket._id, fd);
    if (result) navigate(ROUTES.EXPENSES);
  };

  return (
    <AppShell title="New Expense">
      {/* scan-line keyframe */}
      <style>{`
        @keyframes scan-line {
          from { top: 0%; }
          to { top: 100%; }
        }
        .animate-scan-line {
          animation: scan-line 2s linear infinite;
        }
      `}</style>

      <div className="max-w-2xl mx-auto space-y-4">
        {/* Global back to expenses link (always visible) */}
        {mode === 'picker' && (
          <Button variant="ghost" size="icon-sm" onClick={() => navigate(ROUTES.EXPENSES)} className="mb-1">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        )}

        {mode === 'picker' && (
          <ModePicker
            onSelect={(m) => setMode(m === 'ai' ? 'ai_upload' : 'manual')}
          />
        )}

        {mode === 'ai_upload' && (
          <AiUploadStep
            onFileSelected={handleFileSelected}
            onBack={() => setMode('picker')}
          />
        )}

        {mode === 'ai_scanning' && scanFile && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
            {scanLoading && <AiScanningStep file={scanFile} />}
            {!scanLoading && (
              <div className="text-center py-4">
                <Loader2 className="w-8 h-8 mx-auto animate-spin text-brand-500 mb-4" />
                <p className="text-sm text-[var(--muted-foreground)]">Processing…</p>
              </div>
            )}
          </div>
        )}

        {mode === 'ai_review' && draftTicket && (
          <AiReviewStep
            draft={draftTicket}
            onSubmit={handleDraftSubmit}
            onBack={() => { setDraftTicket(null); setScanFile(null); setMode('ai_upload'); }}
            loading={submitLoading}
            activeCurrencies={activeCurrencies}
          />
        )}

        {mode === 'manual' && (
          <ManualForm onBack={() => setMode('picker')} />
        )}
      </div>
    </AppShell>
  );
}
