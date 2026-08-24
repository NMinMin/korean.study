const apiUrl = String(process.env.REMINDER_API_URL || '').replace(/\/$/, '')
const secret = process.env.REMINDER_JOB_SECRET

if (!apiUrl || !secret) {
  throw new Error('REMINDER_API_URL and REMINDER_JOB_SECRET are required')
}

const response = await fetch(`${apiUrl}/v1/jobs/study-reminders`, {
  method: 'POST',
  headers: { 'x-job-secret': secret },
  signal: AbortSignal.timeout(50_000),
})
const body = await response.text()
if (!response.ok && response.status !== 503) {
  throw new Error(`Reminder job failed (${response.status}): ${body}`)
}
console.log(body)
