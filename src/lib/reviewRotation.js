// One group per seven-day cycle, reviewed on days 1, 3, 5 and 7.
export function buildReviewRotation(words, numberOfDays = 14, dailyLimit = 10, elapsedDays = 0) {
  const uniqueWords = [...new Map(words.map((word) => [word.id, word])).values()];
  const groups = [];
  for (let index = 0; index < uniqueWords.length; index += dailyLimit) groups.push(uniqueWords.slice(index, index + dailyLimit));
  return Array.from({ length: numberOfDays }, (_, index) => {
    const day = Math.max(0, elapsedDays) + index;
    if (!groups.length || ![0, 2, 4, 6].includes(day % 7)) return [];
    return groups[Math.floor(day / 7) % groups.length];
  });
}
