import correctSoundUrl from '../../Sound Effect/Correct.mp3';
import incorrectSoundUrl from '../../Sound Effect/Discorrect.mp3';
import completeLessonSoundUrl from '../../Sound Effect/Complete_Lesson.mp3';

export const cleanKo = (t) => (t || '').replace(/\*\*/g, '').replace(/[\[\]]/g, '');

export const pickKoVoice = () => {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const vs = window.speechSynthesis.getVoices?.() || [];
  return (
    vs.find((v) => v.lang === 'ko-KR' && /Yuna|Google|Heami|SunHi/i.test(v.name)) ||
    vs.find((v) => v.lang?.startsWith('ko')) ||
    null
  );
};

export const makeUtter = (text, { spk = 'A' } = {}) => {
  const u = new SpeechSynthesisUtterance(cleanKo(text));
  u.lang = 'ko-KR';
  const voice = pickKoVoice();
  if (voice) u.voice = voice;

  const isQuestion = /\?\s*$/.test(text);
  const isExclaim = /!\s*$/.test(text);

  if (spk === 'B') {
    u.pitch = 0.85;
    u.rate = 0.86;
  } else {
    u.pitch = 1.12;
    u.rate = 0.9;
  }

  if (isQuestion) u.pitch += 0.15;
  if (isExclaim) {
    u.pitch += 0.08;
    u.rate += 0.06;
    u.volume = 1;
  }

  return u;
};

export const speakKo = (text, opts = {}) => {
  try {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(makeUtter(text, opts));
  } catch (e) { }
};

export const speakDialogue = (lines) => {
  try {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    lines.forEach((d) => synth.speak(makeUtter(d.ko, { spk: d.spk })));
  } catch (e) { }
};

export const CELEBRATION_SOUND_KEY = 'kstudy:celebration-sound-enabled';
export const SOUND_VOLUME_KEY = 'kstudy:sound-volume';

export function isCelebrationSoundEnabled() {
  try {
    return localStorage.getItem(CELEBRATION_SOUND_KEY) !== 'false';
  } catch (e) {
    return true;
  }
}

export function getSoundVolume() {
  try {
    return Math.max(0, Math.min(1, Number(localStorage.getItem(SOUND_VOLUME_KEY) ?? 0.7)));
  } catch (e) {
    return 0.7;
  }
}

export function playEffect(url) {
  if (!isCelebrationSoundEnabled() || getSoundVolume() <= 0) return null;
  try {
    const audio = new Audio(url);
    audio.volume = getSoundVolume();
    audio.play().catch(() => { });
    return audio;
  } catch (e) {
    return null;
  }
}

export function playCorrectSound() {
  return playEffect(correctSoundUrl);
}

export function playIncorrectSound() {
  return playEffect(incorrectSoundUrl);
}

export function playCelebrationSound() {
  return playEffect(completeLessonSoundUrl);
}

export { correctSoundUrl };

export function playVocabularyAudio(word) {
  if (!word) return;
  if (word.audio) {
    try {
      const audio = new Audio(word.audio);
      audio.play().catch(() => speakKo(word.word || word));
      return;
    } catch (e) { }
  }
  speakKo(word.word || word);
}
