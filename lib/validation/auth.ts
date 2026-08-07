import { z } from 'zod';

/**
 * §7 input: the auth routes validate like every other write surface.
 *
 * The password floor is 8 characters and nothing else. Composition rules
 * (a digit, a symbol, a capital) push people towards `Passw0rd!` and are not
 * what NIST 800-63B asks for; length is. Supabase enforces its own project
 * minimum on top of this, and the real gate here is the admin approval, not
 * the password.
 */
export const signUpInput = z
  .object({
    email: z.email().max(254),
    password: z.string().min(8).max(72),
    fullName: z.string().trim().min(2).max(80),
  })
  .strict();

export const signInInput = z
  .object({
    email: z.email().max(254),
    password: z.string().min(1).max(72),
  })
  .strict();

export const accessDecisionInput = z
  .object({
    approve: z.boolean(),
    role: z.enum(['admin', 'super_admin']).default('admin'),
    note: z.string().trim().max(500).optional(),
  })
  .strict();
