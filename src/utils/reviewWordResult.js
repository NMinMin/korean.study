export function getReviewWordResult(evaluation, wordId, wordCount) {
  const result = evaluation?.wordResults?.[wordId];
  if (typeof result === 'boolean') return result;
  if (evaluation?.wordResults) return null;
  // Legacy summaries have no per-word answers. Only uniform results are certain.
  if (!evaluation || evaluation.totalCount !== wordCount || wordCount <= 0) return null;
  if (evaluation.correctCount === evaluation.totalCount) return true;
  if (evaluation.correctCount === 0) return false;
  return null;
}
