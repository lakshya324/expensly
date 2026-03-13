import { useEffect, useState, useRef, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Upload, X, FileText, Image, Sparkles, PenLine,
  CheckCircle2, AlertTriangle, ScanLine, XCircle,
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
import { useSocket } from '@/shared/hooks/useSocket';
import type { ApiResponse } from '@/core/types/api.types';
import type { ITicketData, IMerchantData, ICategoryData } from '@/core/types/ticket.types';
import type { SocketEnvelope } from '@/core/types/socket.types';

// ─── Shared helpers ────────────────────────────────────────────

type Mode = 'ai_upload' | 'ai_scanning' | 'ai_review' | 'ai_failed' | 'manual';

const SCAN_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 3_000;

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

// ─── AI Upload Step ────────────────────────────────────────────

function AiUploadStep({
  onFileSelected,
  onManualEntry,
}: {
  onFileSelected: (file: File) => void;
  onManualEntry: () => void;
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
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-[var(--foreground)]">New Expense</h2>
          <Badge variant="default" className="text-[10px] px-1.5 py-0.5">AI FIRST</Badge>
        </div>
        <p className="text-sm text-[var(--muted-foreground)]">Upload a receipt to auto-create your expense, or switch to manual entry.</p>
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

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[var(--foreground)]">Prefer entering details yourself?</p>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">Use manual entry with merchant, category, and draft save support.</p>
        </div>
        <Button type="button" variant="outline" onClick={onManualEntry}>
          <PenLine className="w-4 h-4" />
          Manual Entry
        </Button>
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
  onSubmit: (payload: {
    title: string;
    amount: string;
    currency: string;
    description?: string;
    merchant?: string;
    category?: string;
  }) => void;
  onBack: () => void;
  loading: boolean;
  activeCurrencies: string[];
  merchants: Array<Pick<IMerchantData, '_id' | 'name'>>;
  categories: Array<Pick<ICategoryData, '_id' | 'name'>>;
}

function AiReviewStep({
  draft,
  onSubmit,
  onBack,
  loading,
  activeCurrencies,
  merchants,
  categories,
}: AiReviewStepProps) {
  const [title, setTitle] = useState(draft.title ?? '');
  const [amount, setAmount] = useState(draft.amount?.toString() ?? '');
  const [currency, setCurrency] = useState(draft.currency ?? activeCurrencies[0] ?? 'USD');
  const [description, setDescription] = useState(draft.description ?? '');
  const [merchant, setMerchant] = useState(draft.merchant?._id ?? '');
  const [category, setCategory] = useState(draft.category?._id ?? '');

  const ocr = draft.ocrData;
  const ai = draft.aiValidation;
  const failedChecks = ai?.checks?.filter((check) => !check.passed) ?? [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { toast.error('Title is required'); return; }
    if (!amount || Number(amount) <= 0) { toast.error('Enter a valid amount'); return; }
    onSubmit({
      title: title.trim(),
      amount,
      currency,
      description: description.trim() || undefined,
      merchant,
      category,
    });
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
      {ai && (ai.status !== 'passed' || failedChecks.length > 0 || !!ai.summary) && (
        <div className={cn(
          'flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm',
          ai.status === 'error'
            ? 'border-danger-200 dark:border-danger-500/30 bg-danger-50 dark:bg-danger-500/10 text-danger-700 dark:text-danger-400'
            : 'border-warning-200 dark:border-warning-500/30 bg-warning-50 dark:bg-warning-500/10 text-warning-700 dark:text-warning-400',
        )}>
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">
              {ai.status === 'error' ? 'Some fields need attention' : 'Review suggested changes'}
            </p>
            <ul className="mt-1 space-y-0.5 text-xs">
              {failedChecks.map((check, index) => (
                <li key={`${check.label}-${index}`}>• {check.detail ?? `${check.label} needs review`}</li>
              ))}
              {failedChecks.length === 0 && ai.summary && <li>• {ai.summary}</li>}
              {failedChecks.length === 0 && !ai.summary && <li>• No actionable issues were returned by AI.</li>}
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
            {ai?.suggestedTitle && (
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">AI suggested: {ai.suggestedTitle}</p>
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
              {ocr?.amount != null && ocr.confidence != null && (
                <span className="absolute right-3 top-8 flex items-center gap-1 text-[10px] text-brand-500 dark:text-brand-400">
                  <Sparkles className="w-2.5 h-2.5" /> {Math.round(ocr.confidence * 100)}%
                </span>
              )}
              {ai?.suggestedAmount != null && (
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">AI suggested: {ai.suggestedAmount}</p>
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
              {ai?.suggestedCurrency && (
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">AI suggested: {ai.suggestedCurrency}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Merchant</label>
              <select
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--input)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Select merchant</option>
                {merchants.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
              </select>
              {ai?.suggestedMerchantName && (
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">AI suggested: {ai.suggestedMerchantName}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--input)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Select category</option>
                {categories.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
              </select>
              {ocr?.suggestedCategory && (
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">AI suggested: {ocr.suggestedCategory}</p>
              )}
            </div>
          </div>

          {ai?.suggestedDate && (
            <p className="text-xs text-[var(--muted-foreground)]">AI suggested transaction date: {ai.suggestedDate}</p>
          )}

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
          {ocr && ocr.confidence != null && (
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
  merchants: Array<Pick<IMerchantData, '_id' | 'name'>>;
  categories: Array<Pick<ICategoryData, '_id' | 'name'>>;
}

function ManualForm({ onBack, merchants, categories }: ManualFormProps) {
  const navigate = useNavigate();
  const { createExpense, loading } = useCreateExpense();
  const { user } = useAuthStore();
  const [activeAction, setActiveAction] = useState<'submit' | 'draft' | null>(null);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    control,
    getValues,
    formState: { errors },
  } = useForm<CreateExpenseFormValues>({ resolver: zodResolver(createExpenseSchema) });

  const handleFile = (file: File) => {
    const err = validateFile(file);
    if (err) { toast.error(err); return; }
    setReceipt(file);
  };

  const submitManual = async (
    values: Partial<CreateExpenseFormValues>,
    statusIntent: 'pending' | 'draft',
  ) => {
    const fd = new FormData();
    if (values.title?.trim()) fd.append('title', values.title.trim());
    if (values.amount?.trim()) fd.append('amount', values.amount.trim());
    if (values.currency?.trim()) fd.append('currency', values.currency);
    if (values.description?.trim()) fd.append('description', values.description.trim());
    if (values.merchant) fd.append('merchant', values.merchant);
    if (values.category) fd.append('category', values.category);
    if (user?.department?._id) fd.append('department', user.department._id);
    if (statusIntent === 'draft') fd.append('statusIntent', 'draft');
    if (receipt) fd.append('receipt', receipt);
    const result = await createExpense(fd, statusIntent);
    setActiveAction(null);
    if (result) navigate(ROUTES.EXPENSES);
  };

  const onSubmit = async (values: CreateExpenseFormValues) => {
    setActiveAction('submit');
    await submitManual(values, 'pending');
  };

  const onSaveDraft = async () => {
    setActiveAction('draft');
    await submitManual(getValues(), 'draft');
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Merchant</label>
              <Controller
                name="merchant"
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    value={field.value ?? ''}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--input)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="">Select merchant</option>
                    {merchants.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
                  </select>
                )}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Category</label>
              <Controller
                name="category"
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    value={field.value ?? ''}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--input)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="">Select category</option>
                    {categories.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
                  </select>
                )}
              />
            </div>
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
          variant="outline"
          className="flex-1"
          onClick={onSaveDraft}
          loading={loading && activeAction === 'draft'}
          disabled={loading}
        >
          Save as Draft
        </Button>
        <Button type="submit" loading={loading && activeAction === 'submit'} disabled={loading} className="flex-1">
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
  const [mode, setMode] = useState<Mode>('ai_upload');
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [draftTicket, setDraftTicket] = useState<ITicketData | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [merchantOptions, setMerchantOptions] = useState<Array<Pick<IMerchantData, '_id' | 'name'>>>([]);
  const [categoryOptions, setCategoryOptions] = useState<Array<Pick<ICategoryData, '_id' | 'name'>>>([]);
  const { scanReceipt } = useScanReceipt();
  const { submitDraft, loading: submitLoading } = useSubmitDraft();

  // Tracks which ticket is currently being scanned
  const pendingTicketId = useRef<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Prevents WS and poll from both resolving
  const resolvedRef = useRef(false);

  const activeCurrencies = user?.org?.activeCurrencies ?? [];

  // ── Cleanup ──────────────────────────────────────────────────

  const clearTimers = useCallback(() => {
    if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  useEffect(() => {
    apiClient
      .get<ApiResponse<Array<Pick<IMerchantData, '_id' | 'name'>>>>(EP.USER_MERCHANTS)
      .then((res) => setMerchantOptions(res.data.data.map((item) => ({ _id: item._id, name: item.name }))))
      .catch(() => {
        setMerchantOptions([]);
      });

    apiClient
      .get<ApiResponse<Array<Pick<ICategoryData, '_id' | 'name'>>>>(EP.USER_CATEGORIES)
      .then((res) => setCategoryOptions(res.data.data.map((item) => ({ _id: item._id, name: item.name }))))
      .catch(() => {
        setCategoryOptions([]);
      });
  }, []);

  // ── Resolve / reject helpers ──────────────────────────────────

  const resolveWithTicket = useCallback((ticket: ITicketData) => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    clearTimers();
    setDraftTicket(ticket);
    setMode('ai_review');
  }, [clearTimers]);

  const rejectScan = useCallback((message: string) => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    clearTimers();
    setScanError(message);
    setMode('ai_failed');
  }, [clearTimers]);

  // ── WebSocket listeners ───────────────────────────────────────

  const handleAiValidated = useCallback(
    (payload: SocketEnvelope<{ ticket: ITicketData }>) => {
      const ticket = payload?.data?.ticket;
      if (!ticket || ticket._id !== pendingTicketId.current) return;
      resolveWithTicket(ticket);
    },
    [resolveWithTicket],
  );

  const handleOcrFailed = useCallback(
    (payload: SocketEnvelope<{ ticketId: string; error: string }>) => {
      if (payload?.data?.ticketId !== pendingTicketId.current) return;
      rejectScan(payload.data?.error ?? 'Receipt scanning failed. Please try again.');
    },
    [rejectScan],
  );

  useSocket('ticket:ai_validated', handleAiValidated);
  useSocket('ticket:ocr_failed', handleOcrFailed);

  // ── Start scan flow ───────────────────────────────────────────

  const handleFileSelected = async (file: File) => {
    setScanFile(file);
    setScanError(null);
    resolvedRef.current = false;
    pendingTicketId.current = null;
    clearTimers();
    setMode('ai_scanning');

    const ticket = await scanReceipt(file);
    if (!ticket) {
      // HTTP upload itself failed — back to upload screen
      setMode('ai_upload');
      return;
    }

    pendingTicketId.current = ticket._id;

    // Backend completed synchronously (shouldn't happen but handle gracefully)
    if (ticket.status === 'draft') {
      resolveWithTicket(ticket);
      return;
    }

    // Polling fallback — runs alongside WS; first one wins
    pollTimerRef.current = setInterval(async () => {
      if (resolvedRef.current || !pendingTicketId.current) return;
      try {
        const res = await apiClient.get<ApiResponse<ITicketData>>(EP.EXPENSE(pendingTicketId.current));
        if (res.data.data.status === 'draft') resolveWithTicket(res.data.data);
      } catch {
        // Non-fatal; keep polling
      }
    }, POLL_INTERVAL_MS);

    // Hard timeout
    timeoutRef.current = setTimeout(() => {
      rejectScan('Scanning took too long. Please try again or enter the details manually.');
    }, SCAN_TIMEOUT_MS);
  };

  // ── Submit reviewed draft ─────────────────────────────────────

  const handleDraftSubmit = async (payload: {
    title: string;
    amount: string;
    currency: string;
    description?: string;
    merchant?: string;
    category?: string;
  }) => {
    if (!draftTicket) return;
    const result = await submitDraft(draftTicket._id, payload);
    if (result) navigate(ROUTES.EXPENSES);
  };

  // ── Reset AI flow (used by failure screen) ────────────────────

  const resetAiFlow = useCallback(() => {
    clearTimers();
    resolvedRef.current = false;
    pendingTicketId.current = null;
    setScanFile(null);
    setDraftTicket(null);
    setScanError(null);
  }, [clearTimers]);

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
        {mode === 'ai_upload' && (
          <Button variant="ghost" size="icon-sm" onClick={() => navigate(ROUTES.EXPENSES)} className="mb-1">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        )}

        {mode === 'ai_upload' && (
          <AiUploadStep
            onFileSelected={handleFileSelected}
            onManualEntry={() => setMode('manual')}
          />
        )}

        {/* Scanning — always show the animated step; never replace with a plain spinner */}
        {mode === 'ai_scanning' && scanFile && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
            <AiScanningStep file={scanFile} />
          </div>
        )}

        {/* Failure recovery */}
        {mode === 'ai_failed' && (
          <div className="rounded-2xl border border-danger-200 dark:border-danger-500/30 bg-[var(--card)] p-8 text-center space-y-4">
            <div className="flex items-center justify-center">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-danger-100 dark:bg-danger-500/10">
                <XCircle className="w-8 h-8 text-danger-500" />
              </div>
            </div>
            <div>
              <p className="text-base font-bold text-[var(--foreground)]">Couldn't read receipt</p>
              <p className="text-sm text-[var(--muted-foreground)] mt-1 max-w-sm mx-auto">
                {scanError ?? 'An error occurred while scanning your receipt.'}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="outline" onClick={() => { resetAiFlow(); setMode('ai_upload'); }}>
                Try Again
              </Button>
              <Button onClick={() => { resetAiFlow(); setMode('manual'); }}>
                Enter Manually
              </Button>
            </div>
          </div>
        )}

        {mode === 'ai_review' && draftTicket && (
          <AiReviewStep
            draft={draftTicket}
            onSubmit={handleDraftSubmit}
            onBack={() => { resetAiFlow(); setMode('ai_upload'); }}
            loading={submitLoading}
            activeCurrencies={activeCurrencies}
            merchants={merchantOptions}
            categories={categoryOptions}
          />
        )}

        {mode === 'manual' && (
          <ManualForm
            onBack={() => setMode('ai_upload')}
            merchants={merchantOptions}
            categories={categoryOptions}
          />
        )}
      </div>
    </AppShell>
  );
}
