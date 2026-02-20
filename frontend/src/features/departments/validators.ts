import { z } from 'zod';

const approvalThresholdEntrySchema = z.object({
  currency: z.string().min(1, 'Select a currency'),
  amount: z
    .string()
    .refine((v) => !isNaN(Number(v)) && Number(v) >= 0, 'Must be ≥ 0'),
});

export const departmentSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  budget: z
    .string()
    .refine(
      (v) => !isNaN(Number(v)) && Number(v) >= 0,
      'Must be a non-negative number',
    ),
  budgetResetPeriod: z.enum(['none', 'monthly', 'quarterly', 'yearly']),
  permissions: z.object({
    canViewAllTickets: z.boolean(),
    canApprove: z.boolean(),
  }),
  approvalThresholds: z.array(approvalThresholdEntrySchema),
});

export type DepartmentFormValues = z.infer<typeof departmentSchema>;
