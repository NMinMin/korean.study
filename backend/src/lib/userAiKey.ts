import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { config } from '../config.js'
import { supabaseAdmin } from './supabase.js'

const KEY_DOMAIN_SALT = 'korean-study:user-ai-key:v1'

function deriveAesKey(): Buffer {
  const material = config.AI_KEY_ENCRYPTION_SECRET || config.SUPABASE_SERVICE_ROLE_KEY
  return createHash('sha256').update(`${KEY_DOMAIN_SALT}:${material}`).digest()
}

export function maskApiKey(plainKey: string): string {
  const trimmed = plainKey.trim()
  if (trimmed.length <= 8) return '••••'
  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`
}

export function encryptApiKey(plainKey: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', deriveAesKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plainKey, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`
}

export function decryptApiKey(payload: string): string {
  const parts = payload.split(':')
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Invalid encrypted API key format')
  }
  const [, ivB64, tagB64, dataB64] = parts
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Invalid encrypted API key format')
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    deriveAesKey(),
    Buffer.from(ivB64, 'base64'),
  )
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ])
  return decrypted.toString('utf8')
}

export type UserAiKeyStatus = {
  hasKey: boolean
  maskedKey: string | null
  updatedAt: string | null
}

export async function getUserGeminiKeyStatus(userId: string): Promise<UserAiKeyStatus> {
  const { data, error } = await supabaseAdmin
    .from('user_ai_keys')
    .select('key_hint, updated_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to read user AI key status: ${error.message}`)
  }

  if (!data) {
    return { hasKey: false, maskedKey: null, updatedAt: null }
  }

  return {
    hasKey: true,
    maskedKey: data.key_hint,
    updatedAt: data.updated_at,
  }
}

export async function getUserGeminiKey(userId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('user_ai_keys')
    .select('gemini_key_encrypted')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to read user AI key: ${error.message}`)
  }

  if (!data?.gemini_key_encrypted) return null
  return decryptApiKey(data.gemini_key_encrypted)
}

export async function saveUserGeminiKey(userId: string, plainKey: string): Promise<{
  hasKey: true
  maskedKey: string
  updatedAt: string
}> {
  const trimmed = plainKey.trim()
  const encrypted = encryptApiKey(trimmed)
  const maskedKey = maskApiKey(trimmed)
  const updatedAt = new Date().toISOString()

  const { error } = await supabaseAdmin
    .from('user_ai_keys')
    .upsert({
      user_id: userId,
      gemini_key_encrypted: encrypted,
      key_hint: maskedKey,
      updated_at: updatedAt,
    }, { onConflict: 'user_id' })

  if (error) {
    throw new Error(`Failed to save user AI key: ${error.message}`)
  }

  return { hasKey: true, maskedKey, updatedAt }
}

export async function deleteUserGeminiKey(userId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('user_ai_keys')
    .delete()
    .eq('user_id', userId)

  if (error) {
    throw new Error(`Failed to delete user AI key: ${error.message}`)
  }
}
