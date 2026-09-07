import { SHADOW_LINES } from '../../data/fallbackData';
import { cleanKo } from '../../services/audioService';

export const mapDatabaseGrammar = (grammar, index) => ({
  no: index + 1,
  id: grammar.id,
  lessonId: grammar.lessonId,
  textbookId: grammar.textbookId,
  lessonNo: grammar.lessonNo,
  pattern: grammar.pattern,
  color: ['#7C6FE4', '#E5566B', '#3FA95C', '#E8912E'][index % 4],
  img: null,
  context: grammar.context || grammar.usageVi || grammar.meaningVi,
  translation: grammar.translation || grammar.meaningVi,
  formula: grammar.conjugationVi
    ? String(grammar.conjugationVi).split(/\r?\n/).filter(Boolean).map((form) => ({ subject: '', condition: 'Cách dùng', form }))
    : [{ subject: '', condition: 'Cấu trúc', form: grammar.pattern }],
  examples: [],
  notes: grammar.notesVi ? String(grammar.notesVi).split(/\r?\n/).filter(Boolean) : [],
  tip: null,
});

export const mapDatabaseLines = (exercises, skillType) =>
  exercises
    .filter((exercise) => exercise.skillType === skillType)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((exercise, index) => {
      const ko = exercise.promptKo || String(exercise.answer?.correct || exercise.answer?.transcript || '');
      const fallback = SHADOW_LINES.find((line) => cleanKo(line.ko) === cleanKo(ko));
      return {
        id: exercise.id,
        no: index + 1,
        spk: fallback?.spk || (index % 2 === 0 ? 'A' : 'B'),
        ko,
        vi: exercise.promptVi
          || exercise.answer?.translation
          || exercise.answer?.translationVi
          || exercise.answer?.meaning
          || fallback?.vi
          || exercise.explanationVi
          || '',
        rhythmBreak: String(exercise.answer?.rhythmBreak || fallback?.rhythmBreak || ko),
        realPron: String(exercise.answer?.realPronunciation || fallback?.realPron || ''),
        tips: fallback?.tips || (exercise.explanationVi ? [exercise.explanationVi] : []),
        audio: exercise.audioUrl || exercise.mediaUrl || fallback?.audio || '',
      };
    })
    .filter((line) => line.ko);
