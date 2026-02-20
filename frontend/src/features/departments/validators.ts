import { z } from 'zod';

export const departmentSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  budget: z
    .string()
    .refine(
      (v) => !isNaN(Number(v)) && Number(v) >= 0,
      'Must be a non-negative number',
    ),
  budgetResetPeriod: z.enum(['none', 'monthly', 'quarterly', 'yearly']).default('none'),
});

export type DepartmentFormValues = z.infer<typeof departmentSchema>;
