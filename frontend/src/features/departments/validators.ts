import { z } from 'zod';

const approvalThresholdEntrySchema = z.object({
  currency: z.string().trim().min(1, 'Select a currency'),
  amount: z
    .string()
    .trim()
    .min(1, 'Amount is required')
    .regex(/^[0-9]+(\.[0-9]+)?$/, 'Must be a valid non-negative number'),
});

export const departmentSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  budget: z
    .string()
    .trim()
    .min(1, 'Budget is required')
    .regex(/^[0-9]+(\.[0-9]+)?$/, 'Must be a valid non-negative number'),
  budgetResetPeriod: z.enum(['none', 'monthly', 'quarterly', 'yearly']),
  policyId: z.string().nullable().optional(),
  permissions: z.object({
    view_all_tickets: z.boolean(),
    approve_finance: z.boolean(),
    export_reports: z.boolean(),
    view_analytics: z.boolean(),
  }),
  approvalThresholds: z.array(approvalThresholdEntrySchema),
});

export type DepartmentFormValues = z.infer<typeof departmentSchema>;
