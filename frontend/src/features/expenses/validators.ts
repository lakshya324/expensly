import { z } from 'zod';
import { CURRENCIES } from '@/core/constants/constants';

export const createExpenseSchema = z.object({
  title: z.string().min(1, 'Title is required').max(120, 'Title too long'),
  amount: z
    .string()
    .min(1, 'Amount is required')
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, 'Amount must be a positive number'),
  currency: z.enum(CURRENCIES as [string, ...string[]], { required_error: 'Currency is required' }),
  department: z.string().min(1, 'Department is required'),
  description: z.string().max(1000, 'Description too long').optional(),
  tags: z.array(z.string()).optional(),
});

export const updateExpenseStatusSchema = z.object({
  status: z.enum(['pending', 'awaiting_finance', 'approved', 'rejected']),
  comments: z.string().max(500).optional(),
});

export type CreateExpenseFormValues = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseStatusValues = z.infer<typeof updateExpenseStatusSchema>;
