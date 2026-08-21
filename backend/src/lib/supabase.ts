import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'
import { config } from '../config.js'

export const supabaseAdmin = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    realtime: {
      // `ws` implements the browser WebSocket contract at runtime. Its overloads
      // are slightly wider than Supabase's constructor type, so keep the cast at
      // this integration boundary instead of weakening types elsewhere.
      transport: WebSocket as unknown as typeof globalThis.WebSocket,
    },
  },
)

export async function userFromAccessToken(accessToken: string) {
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken)
  if (error || !data.user) return null
  return data.user
}
