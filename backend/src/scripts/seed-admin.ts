import { supabaseAdmin } from '../lib/supabase.js'

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
const password = process.env.ADMIN_PASSWORD
const displayName = process.env.ADMIN_DISPLAY_NAME?.trim() || 'Quản trị viên'

if (!email || !password || password.length < 12) {
  throw new Error('Cần ADMIN_EMAIL và ADMIN_PASSWORD tối thiểu 12 ký tự trong backend/.env')
}

const { data: listed, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
if (listError) throw listError
let user = listed.users.find((item) => item.email?.toLowerCase() === email)
if (!user) {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: displayName } })
  if (error) throw error
  user = data.user
} else {
  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password, email_confirm: true, user_metadata: { ...user.user_metadata, display_name: displayName } })
  if (error) throw error
  user = data.user
}
if (!user) throw new Error('Không thể tạo tài khoản admin')
const { error: roleError } = await supabaseAdmin.from('user_roles').upsert({ user_id: user.id, role: 'admin' })
if (roleError) throw roleError
console.log(`Admin ready: ${email}`)
