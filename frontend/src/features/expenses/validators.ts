import { z } from 'zod';
import { CURRENCIES } from '@/core/constants/constants';

export const createExpenseSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(120, 'Title too long'),
  amount: z
    .string()
    .trim()
    .min(1, 'Amount is required')
    .regex(/^[0-9]+(\.[0-9]+)?$/, 'Amount must be a valid positive number')
    .refine((v) => Number(v) > 0, 'Amount must be greater than 0'),
  currency: z.enum(CURRENCIES as [string, ...string[]], 'Invalid currency'),
  description: z.string().trim().max(1000, 'Description too long').optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
  merchant: z.string().optional(),
  category: z.string().optional(),
});

export const updateExpenseStatusSchema = z.object({
  status: z.enum(['pending', 'awaiting_finance', 'approved', 'rejected']),
  comments: z.string().trim().max(500).optional(),
});

export type CreateExpenseFormValues = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseStatusValues = z.infer<typeof updateExpenseStatusSchema>;
