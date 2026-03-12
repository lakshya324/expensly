import { z } from 'zod';

export const createUserSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  department: z.string().trim().optional(),
  managerId: z.string().trim().optional(),
  role: z.enum(['user', 'admin']).default('user'),
  policyId: z.string().nullable().optional(),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  department: z.string().trim().optional(),
  managerId: z.string().trim().optional(),
});

export type CreateUserFormValues = z.input<typeof createUserSchema>;
export type UpdateUserFormValues = z.infer<typeof updateUserSchema>;
