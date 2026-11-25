export function buildProgressExportRows(progress, enrollments, learners) {
  const learnerIds = new Set(learners.map((learner) => learner.user_id))
  const seenPairs = new Set()
  const seenLearners = new Set()
  const rows = []
  for (const item of progress) {
    if (!learnerIds.has(item.user_id)) continue
    seenPairs.add(`${item.user_id}:${item.textbook_id}`)
    seenLearners.add(item.user_id)
    rows.push([item.user_id, item.profiles?.display_name || 'Học viên', item.textbooks?.title_ko || '', item.lessons?.lesson_number ?? '', item.lessons?.title_ko || '', Number(item.progress_percent), 'Đã có dữ liệu', item.last_activity || '', item.updated_at || ''])
  }
  for (const item of enrollments) {
    if (!learnerIds.has(item.user_id)) continue
    seenLearners.add(item.user_id)
    if (!seenPairs.has(`${item.user_id}:${item.textbook_id}`)) {
      rows.push([item.user_id, item.profiles?.display_name || 'Học viên', item.textbooks?.title_ko || '', '', '', '', 'Chưa có dữ liệu tiến độ', '', ''])
    }
  }
  for (const learner of learners) {
    if (!seenLearners.has(learner.user_id)) rows.push([learner.user_id, learner.profiles?.display_name || 'Học viên', '', '', '', '', 'Chưa có giáo trình hoặc tiến độ', '', ''])
  }
  return rows
}
