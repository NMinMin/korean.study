export function preferSelectedLesson(catalog, selection, userId) {
  if (!catalog || !selection || selection.userId !== userId
    || selection.textbookId !== catalog.activeTextbook?.id) return catalog;
  const selected = catalog.lessons.find((lesson) => lesson.id === selection.lessonId);
  if (!selected || selected.status !== 'current' || selected.progressPercent >= 100) return catalog;
  return { ...catalog, hasStarted: true, continueLesson: selected, continueCompletedToday: false };
}
