import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

/**
 * §11.4 RTL implementation rules. Physical-direction Tailwind utilities are a
 * build error, not a review comment — in an RTL-only product they are always a
 * bug, and they are invisible to anyone testing in English.
 */
const PHYSICAL_DIRECTION_CLASSES =
  '\\b(ml|mr|pl|pr|left|right|border-l|border-r|rounded-l|rounded-r|rounded-tl|rounded-tr|rounded-bl|rounded-br|text-left|text-right|inset-l|inset-r)(-[a-z0-9./[\\]]+)?\\b';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([
    '.next/**',
    'node_modules/**',
    'public/sw.js',
    'public/swe-worker-*.js',
    'next-env.d.ts',
  ]),
  {
    files: ['**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: `JSXAttribute[name.name='className'] Literal[value=/${PHYSICAL_DIRECTION_CLASSES}/]`,
          message:
            'Physical-direction Tailwind class detected. This app is RTL-only — use logical properties (ms-/me-/ps-/pe-/start-/end-/border-s-/border-e-/text-start/text-end).',
        },
        {
          selector: `JSXAttribute[name.name='className'] TemplateElement[value.raw=/${PHYSICAL_DIRECTION_CLASSES}/]`,
          message:
            'Physical-direction Tailwind class detected. This app is RTL-only — use logical properties (ms-/me-/ps-/pe-/start-/end-/border-s-/border-e-/text-start/text-end).',
        },
      ],
    },
  },
  {
    // §7: the service-role key must never be reachable from a client component.
    files: ['**/*.tsx', 'components/**/*.ts', 'app/**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/lib/supabase/admin',
              message:
                'The service-role Supabase client is server-only. Import it from a route handler or server action.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['tests/**/*.ts', 'scripts/**/*.mjs'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
]);

export default eslintConfig;
