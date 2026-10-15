// Lowest review count first: finish every word in a round before repeating.
export function buildReviewRotation(words, counts = {}, numberOfDays = 14, dailyLimit = 10) {
  const uniqueWords = [...new Map(words.map((word) => [word.id, word])).values()];
  const plannedCounts = new Map(uniqueWords.map((word) => [word.id, Math.max(0, Number(counts[word.id]) || 0)]));
  return Array.from({ length: numberOfDays }, () => {
    if (!uniqueWords.length) return [];
    const round = Math.min(...plannedCounts.values());
    const batch = uniqueWords.filter((word) => plannedCounts.get(word.id) === round).slice(0, dailyLimit);
    batch.forEach((word) => plannedCounts.set(word.id, round + 1));
    return batch;
  });
}
