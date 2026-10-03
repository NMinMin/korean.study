export function calculateReviewComposite(answers = [], writingResults = [], reflexResults = [], elapsedMs = 0) {
  const mcTotal = answers.length;
  const mcAccuracy = mcTotal ? answers.filter((answer) => answer.correct).length / mcTotal : 0;
  const normalizedScore = (score) => Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0;
  const writingScores = writingResults.map((item) => normalizedScore(item?.score));
  const writingAvg = writingScores.length ? Math.round(writingScores.reduce((sum, score) => sum + score, 0) / writingScores.length) : null;
  const reflexAccuracy = reflexResults.length ? Math.round(reflexResults.reduce((sum, item) => sum + (item?.timedOut ? 0 : normalizedScore(item?.score)), 0) / reflexResults.length) : null;
  if (!mcTotal && !writingResults.length && !reflexResults.length) return { composite: 0, writingAvg, reflexAccuracy };
  const expectedMs = mcTotal * 18000 + writingResults.length * 60000;
  const speedRatio = expectedMs > 0 ? Math.min(1.3, expectedMs / Math.max(elapsedMs, 1)) : 1;
  const speedFactor = Math.min(1, speedRatio * 0.85 + 0.15);
  const composite = writingAvg !== null && reflexAccuracy !== null
    ? mcAccuracy * 100 * 0.45 + writingAvg * 0.3 + reflexAccuracy * 0.2 + speedFactor * 100 * 0.05
    : writingAvg !== null
      ? mcAccuracy * 100 * 0.5 + writingAvg * 0.35 + speedFactor * 100 * 0.15
      : reflexAccuracy !== null
        ? mcAccuracy * 100 * 0.7 + reflexAccuracy * 0.25 + speedFactor * 100 * 0.05
        : mcAccuracy * 100 * 0.8 + speedFactor * 100 * 0.2;
  return { composite, writingAvg, reflexAccuracy };
}
