import { useEffect, useState, useRef, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, X, FileText, Image, Tag } from 'lucide-react';
import { AppShell } from '@/shared/components/layout/AppShell';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/Card';
import { useCreateExpense } from '../hooks/useExpenses';
import { createExpenseSchema, type CreateExpenseFormValues } from '../validators';
import { ROUTES } from '@/core/constants/constants';
import apiClient from '@/infrastructure/api/client';
import { EP } from '@/infrastructure/api/endpoints';
import { useAuthStore } from '@/features/auth/store/authStore';
import type { ApiResponse } from '@/core/types/api.types';

export function NewExpensePage() {
  const navigate = useNavigate();
  const { createExpense, loading } = useCreateExpense();
  const { user } = useAuthStore();
  const [deptTags, setDeptTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
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

  const addTagFromInput = useCallback(() => {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !selectedTags.includes(trimmed) && selectedTags.length < 5) {
      setSelectedTags((prev) => [...prev, trimmed]);
    }
    setTagInput('');
    setTagDropdownOpen(false);
  }, [tagInput, selectedTags]);

  const filteredSuggestions = deptTags.filter(
    (t) => t.toLowerCase().includes(tagInput.toLowerCase()) && !selectedTags.includes(t),
  );

  const handleFile = (file: File) => {
    const valid = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!valid.includes(file.type)) { return; }
    if (file.size > 10 * 1024 * 1024) { return; }
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
    <AppShell title="New Expense">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" onClick={() => navigate(ROUTES.EXPENSES)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-xl font-bold text-[var(--foreground)]">Submit Expense</h2>
            <p className="text-sm text-[var(--muted-foreground)]">Fill in the details below</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

                {/* Selected tags */}
                {selectedTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {selectedTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-brand-600 dark:bg-brand-500 text-white"
                      >
                        <Tag className="w-3 h-3" />
                        {tag}
                        <button
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className="ml-0.5 hover:opacity-70 transition"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Input + suggestions */}
                {selectedTags.length < 5 && (
                  <div className="relative">
                    <input
                      ref={tagInputRef}
                      type="text"
                      value={tagInput}
                      onChange={(e) => { setTagInput(e.target.value); setTagDropdownOpen(true); }}
                      onFocus={() => setTagDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setTagDropdownOpen(false), 150)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); addTagFromInput(); }
                        if (e.key === 'Escape') setTagDropdownOpen(false);
                      }}
                      placeholder={deptTags.length > 0 ? 'Type or pick a suggestion…' : 'Type a tag and press Enter'}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--input)] bg-[var(--background)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    {tagDropdownOpen && filteredSuggestions.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] shadow-lg overflow-hidden">
                        {filteredSuggestions.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); toggleTag(tag); setTagInput(''); setTagDropdownOpen(false); }}
                            className="w-full text-left px-3.5 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--accent)] flex items-center gap-2 transition"
                          >
                            <Tag className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                            {tag}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Recommendations strip */}
                {deptTags.filter((t) => !selectedTags.includes(t)).length > 0 && selectedTags.length < 5 && tagInput === '' && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {deptTags
                      .filter((t) => !selectedTags.includes(t))
                      .map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className="px-3 py-1 rounded-full text-xs font-medium bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--accent)] transition"
                        >
                          + {tag}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Receipt Upload */}
          <Card>
            <CardHeader><CardTitle>Receipt (Optional)</CardTitle></CardHeader>
            <CardContent>
              {receipt ? (
                <div className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--muted)]/30">
                  {receipt.type.startsWith('image/') ? (
                    <Image className="w-5 h-5 text-brand-500" />
                  ) : (
                    <FileText className="w-5 h-5 text-brand-500" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--foreground)] truncate">{receipt.name}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {(receipt.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReceipt(null)}
                    className="p-1.5 rounded-lg hover:bg-[var(--accent)] transition"
                  >
                    <X className="w-4 h-4 text-[var(--muted-foreground)]" />
                  </button>
                </div>
              ) : (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const file = e.dataTransfer.files[0];
                    if (file) handleFile(file);
                  }}
                  onClick={() => fileRef.current?.click()}
                  className={`flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed cursor-pointer transition ${
                    dragOver
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/30'
                      : 'border-[var(--border)] hover:border-brand-400 hover:bg-[var(--muted)]/30'
                  }`}
                >
                  <Upload className="w-8 h-8 text-[var(--muted-foreground)] mb-2" />
                  <p className="text-sm font-medium text-[var(--foreground)]">Drop a file or click to upload</p>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">PNG, JPG, PDF up to 10MB</p>
                  <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    accept="image/jpeg,image/png,application/pdf"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" type="button" onClick={() => navigate(ROUTES.EXPENSES)}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              Submit Expense
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
