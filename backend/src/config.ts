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
  GOOGLE_CLOUD_PROJECT_ID: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS_JSON: z.string().optional(),
  SMTP_FROM_EMAIL: z.string().email().optional(),
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
  allowedOrigins: result.data.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
}
