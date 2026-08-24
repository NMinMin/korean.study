const normalizeSpeech = (value) => String(value || '')
  .replace(/\*\*/g, '')
  .replace(/[^\p{L}\p{N}\s]/gu, ' ')
  .trim()
  .split(/\s+/)
  .filter(Boolean);

export function compareSpeech(target, said) {
  const targetWords = normalizeSpeech(target);
  const saidPool = normalizeSpeech(said);
  const wordResults = targetWords.map((word) => {
    const index = saidPool.indexOf(word);
    if (index !== -1) {
      saidPool.splice(index, 1);
      return { word, ok: true };
    }
    return { word, ok: false };
  });
  const correctCount = wordResults.filter((item) => item.ok).length;
  const score = targetWords.length ? Math.round((correctCount / targetWords.length) * 100) : 0;
  return { wordResults, score, extraWords: saidPool };
}

export function feedbackFor(score, hasSpeech) {
  if (!hasSpeech) return { tone: 'bad', msg: 'Chưa nhận diện được giọng nói. Nói to, rõ và gần micro hơn rồi thử lại.' };
  if (score === 100) return { tone: 'great', msg: 'Xuất sắc! Bạn đã nói đúng toàn bộ câu.' };
  if (score >= 70) return { tone: 'good', msg: 'Khá tốt! Chú ý đọc lại rõ hơn các từ chưa khớp.' };
  if (score >= 40) return { tone: 'mid', msg: 'Cần luyện thêm — nghe lại mẫu rồi thử nói chậm, rõ từng từ.' };
  return { tone: 'bad', msg: 'Câu nói còn khá khác câu gốc — nghe lại mẫu vài lần rồi thử lại nhé.' };
}

export const toneForScore = (score) => (score >= 80 ? 'good' : score >= 60 ? 'mid' : 'bad');

export async function gradeSpeechWithAI(requestAIJson, target, said, realPron, timing = {}) {
  const prompt = `Chấm phát âm tiếng Hàn dựa trên transcript.
Câu mẫu: "${target}"
Cách đọc tham khảo: "${realPron || ''}"
Transcript: "${said}"
Thời gian: ${timing.elapsed || 0}/${timing.limit || 0} giây.
Trả về JSON: {"score":0-100,"words":[{"word":"...","status":"ok|missing|wrong"}],"strength":"...","tip":"..."}`;
  const { value: parsed, model } = await requestAIJson(prompt);
  if (typeof parsed?.score !== 'number' || !Array.isArray(parsed?.words)) throw new Error('malformed AI response');
  const statuses = new Set(['ok', 'missing', 'wrong']);
  return {
    ...parsed,
    score: Math.max(0, Math.min(100, Math.round(parsed.score))),
    words: parsed.words.map((item) => ({ ...item, status: statuses.has(item.status) ? item.status : 'wrong' })),
    source: 'worker-ai',
    model,
  };
}

export function gradeSpeechLocally(target, said) {
  const comparison = compareSpeech(target, said);
  const feedback = feedbackFor(
    comparison.score,
    comparison.wordResults.some((item) => item.ok) || comparison.extraWords.length > 0,
  );
  return {
    score: comparison.score,
    words: comparison.wordResults.map((item) => ({ word: item.word, status: item.ok ? 'ok' : 'missing' })),
    strength: comparison.score >= 70
      ? 'Bạn nói đúng phần lớn từ trong câu.'
      : 'Bạn đã thử nói theo câu mẫu — cứ tiếp tục luyện tập nhé.',
    tip: feedback.msg,
    source: 'local',
  };
}
