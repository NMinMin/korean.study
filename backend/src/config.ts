import 'dotenv/config'
import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  HOST: z.string().default('0.0.0.0'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  GROQ_API_KEY: z.string().min(1).optional(),
  GROQ_SPEECH_MODEL: z.string().min(1).default('whisper-large-v3-turbo'),
  SPEECH_TO_TEXT_URL: z.string().url().default('https://speech-to-text-hy3k.onrender.com/transcribe'),
  GROQ_GRADER_API_KEY: z.string().min(1).optional(),
  GROQ_GRADER_MODEL: z.string().min(1).default('openai/gpt-oss-20b'),
  SMTP_FROM_EMAIL: z.string().email().optional(),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.preprocess((value) => value === true || value === 'true' || value === '1', z.boolean()).default(false),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
  REMINDER_JOB_SECRET: z.string().min(24).optional(),
  CLOUDINARY_CLOUD_NAME: z.string().min(1).optional(),
  CLOUDINARY_API_KEY: z.string().min(1).optional(),
  CLOUDINARY_API_SECRET: z.string().min(1).optional(),
})

const result = schema.safeParse(process.env)
if (!result.success) {
  console.error('Invalid backend environment:', result.error.flatten().fieldErrors)
  throw new Error('Backend environment variables are invalid')
}
export const config = {
  ...result.data,
  allowedOrigins: Array.from(new Set([
    ...result.data.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim().replace(/\/$/, '')).filter(Boolean),
    'https://nminmin.github.io',
  ])),
}
