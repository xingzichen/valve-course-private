import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  APP_BASE_URL: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  FILE_STORAGE_ROOT: z.string().min(1).default('./local-data/medical'),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(104_857_600),
  SESSION_COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  OMLX_BASE_URL: z.string().url().default('http://localhost:5008/v1'),
  OMLX_API_KEY: z.string().default(''),
  OMLX_CHAT_MODEL: z.string().default('Qwen3.8-27B-6bit'),
  OMLX_TIMEOUT_MS: z.coerce.number().int().positive().default(1_200_000)
});

export type AppEnv = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): AppEnv {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Invalid environment configuration: ${result.error.message}`);
  }
  return result.data;
}
