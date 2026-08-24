import React, { useState, useEffect } from 'react';
import {
  Sparkles, BookOpen, Headphones, Mic, Target, Trophy, Settings
} from 'lucide-react';

import './styles/dashboard.css';

import {
  FALLBACK_LESSONS,
  VOCAB_SAMPLE,
  GRAMMAR_SAMPLE,
  SHADOW_LINES,
  GemBalanceContext,
  UserStatsContext,
  DiamondIcon,
} from './data/fallbackData';

import {
  loadLearningCatalog,
  addUserTextbook,
  markLessonStarted,
  syncLessonProgress,
} from './lib/learningContent';
import { awardLessonGems, loadShopState, purchasePlant, selectPlant } from './lib/gemStore';
import { markRemoteActivityCompleted } from './lib/activityProgress';

import {
  isCelebrationSoundEnabled,
  playCelebrationSound,
} from './services/audioService';

import { computeAndSyncUserStats } from './features/dashboard/progressService';
import { supabase } from './lib/supabase';
import notificationSoundUrl from '../Sound Effect/Notification.mp3';
import { playEffect } from './services/audioService';
import { getDailyGoal, saveDailyGoal, markNotifSeen } from './features/settings/studyPlanService';
import { mapDatabaseGrammar, mapDatabaseLines } from './features/curriculum/curriculumMappers';
import {
  ACTIVITIES,
  activityCompletionKey,
  isActivityMarkedCompleted,
  markActivityCompleted,
  loadActivityProgress,
} from './features/study/activityHelpers';

// Layout & Common Components
import Sidebar from './components/common/Sidebar';
import Header from './components/common/Header';
import ComingSoonView from './components/common/ComingSoonView';
import {
  ConfettiBurst,
  DailyGoalRing,
  QuickAccessMenu,
  RankPreviewCard,
  RecentActivityCard,
  ContinueLearning,
  PersonalProgressSection,
  ReviewSchedule,
} from './features/dashboard/DashboardCards';

// Feature Views
import PlantShopView from './features/shop/PlantShopView';
import SettingsView, { ReminderBanner } from './features/settings/SettingsView';
import RankingCommunityView from './features/leaderboard/RankingCommunityView';
import MyTextbooks from './features/curriculum/MyTextbooks';
import CurriculumHubView from './features/curriculum/CurriculumHubView';
import LessonsView, { ActivityLessonSelectView } from './features/curriculum/LessonsView';
import { GrammarHubView, GrammarBookView } from './features/curriculum/GrammarViews';
import TopicsView from './features/curriculum/TopicsView';
import AIQuizView from './features/practice/AIQuizView';
import { CustomLessonStudyView, CustomLessonTestView } from './features/community/CustomLessons';

// Study & Review Views
import {
  LessonDetailView,
  VocabListView,
  VocabNotebookView,
  FlashcardView,
  VocabTestSelectView,
  WordOfDayWidget,
} from './features/study/VocabViews';
import DictationView, {
  FillBlankListenView,
  MatchPairsView,
  ChooseImageView,
} from './features/study/DictationView';
import ShadowingView, { DictationModeSelectView } from './features/study/ShadowingView';
import {
  ReviewHubView,
  ReviewIntroView,
  ReviewQuizView,
  ReviewResultView,
  ReviewLessonSelectView,
} from './features/review/ReviewViews';

// Auth
import AuthView, { profileStorageKey } from './features/auth/AuthView';

const IMMERSIVE_VIEWS = [
  'lesson-detail', 'vocab-list', 'vocab-notebook', 'flashcards', 'flashcards-notebook', 'flashcards-schedule',
  'flashcards-grammar', 'shadowing', 'dictation', 'review-hub', 'review-lesson-select',
  'review-intro', 'review-quiz', 'review-result', 'aiquiz', 'study-custom-lesson', 'test-custom-lesson',
  'vocab-test-select', 'vocab-test-fillblank', 'vocab-test-match', 'vocab-test-image',
  'dictation-mode-select', 'tuvung-bai', 'tuvung-chude', 'nguphap-hub', 'nguphap-book',
  'cuahang', 'caidat', 'curriculum-hub', 'mock-exam',
];

const ACTIVE_STUDY_VIEWS = new Set([
  'lesson-detail', 'vocab-list', 'vocab-notebook', 'flashcards', 'flashcards-notebook', 'flashcards-schedule',
  'flashcards-grammar', 'nguphap-book', 'shadowing', 'dictation', 'review-quiz',
  'study-custom-lesson', 'test-custom-lesson', 'aiquiz', 'vocab-test-fillblank',
  'vocab-test-match', 'vocab-test-image',
]);

export default function KoreanStudyDashboard({ authenticatedProfile = null, onSignOut = null }) {
  const [profile, setProfile] = useState(authenticatedProfile || undefined);
  const [active, setActive] = useState('home');
  const [view, setView] = useState('home');
  const [lesson, setLesson] = useState(null);
  const [reviewAnswers, setReviewAnswers] = useState([]);
  const [reviewWriting, setReviewWriting] = useState([]);
  const [reviewReflex, setReviewReflex] = useState([]);
  const [reviewDifficulty, setReviewDifficulty] = useState(null);
  const [reviewElapsed, setReviewElapsed] = useState(0);
  const [reviewMode, setReviewMode] = useState('bylesson');
  const [reviewSelectedLessons, setReviewSelectedLessons] = useState([]);
  const [reviewSeed, setReviewSeed] = useState(null);
  const [reviewIsRecheck, setReviewIsRecheck] = useState(false);
  const [rankTab, setRankTab] = useState('xephang');
  const [customLessonData, setCustomLessonData] = useState(null);
  const [reviewDeck, setReviewDeck] = useState(null);
  const [vocabBackView, setVocabBackView] = useState('vocab-lessons');
  const [lessonListBackView, setLessonListBackView] = useState('curriculum-hub');
  const [lessonDetailBackView, setLessonDetailBackView] = useState('tuvung-bai');
  const [activitySelectBackView, setActivitySelectBackView] = useState('home');
  const [activityRunBackView, setActivityRunBackView] = useState('lesson-detail');
  const [dictationMode, setDictationMode] = useState('practice');
  const [dictationEntryBackView, setDictationEntryBackView] = useState('lesson-detail');
  const [reviewHubBackView, setReviewHubBackView] = useState('home');
  const [reviewIntroBackView, setReviewIntroBackView] = useState('home');
  const [learningCatalog, setLearningCatalog] = useState(null);
  const [addingTextbookId, setAddingTextbookId] = useState(null);
  const [catalogNotice, setCatalogNotice] = useState(null);
  const [lessonCelebration, setLessonCelebration] = useState(false);
  const [reviewAllFlashcards, setReviewAllFlashcards] = useState(false);
  const [shop, setShop] = useState({ balance: 0, selectedPlant: 'mugunghwa', plants: [] });
  const [shopLoading, setShopLoading] = useState(false);
  const [shopNotice, setShopNotice] = useState(null);
  const [userStats, setUserStats] = useState({ xp: 0, streak: 0 });

  const refreshUserStats = async () => {
    if (!profile) return;
    try {
      const targetLesson = lesson || learningCatalog?.lessons?.[0] || FALLBACK_LESSONS[0];
      const s = await computeAndSyncUserStats(profile, targetLesson);
      if (s) setUserStats({ xp: s.xp || 0, streak: s.streak || 0 });
    } catch (e) { }
  };

  useEffect(() => {
    refreshUserStats();
  }, [profile, lesson, learningCatalog]);

  useEffect(() => {
    if (!supabase || !profile?.id) return undefined;
    const channel = supabase
      .channel(`dashboard-snapshot:${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_dashboard_snapshots',
          filter: `user_id=eq.${profile.id}`,
        },
        (change) => {
          const snapshot = change.new;
          if (!snapshot || snapshot.user_id !== profile.id) return;
          setUserStats({
            xp: Number(snapshot.xp || 0),
            streak: Number(snapshot.streak || 0),
          });
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [profile?.id]);

  useEffect(() => {
    if (!supabase || !profile?.id) return undefined;
    const channel = supabase.channel(`notifications:${profile.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}`,
      }, () => {
        playEffect(notificationSoundUrl);
        window.dispatchEvent(new CustomEvent('kstudy:notification-received'));
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [profile?.id]);

  const goHome = () => {
    setView('home');
    setActive('home');
  };

  const openLesson = (l, backView = 'tuvung-bai') => {
    if (l?.textbookId && l?.id) markLessonStarted(l.textbookId, l.id).catch(() => { });
    if (l?.textbookId === learningCatalog?.activeTextbook?.id) {
      setLearningCatalog((current) => current ? { ...current, hasStarted: true, continueLesson: l } : current);
    }
    setLesson(l);
    setLessonDetailBackView(backView);
    setView('lesson-detail');
  };

  const openVocabulary = (l, backView) => {
    setLesson(l);
    setVocabBackView(backView);
    setView('vocab-list');
  };

  const immersive = IMMERSIVE_VIEWS.includes(view);

  const refreshShop = async () => {
    try {
      const state = await loadShopState();
      setShop(state);
      return state;
    } catch (error) {
      setShopNotice({ type: 'error', message: 'Chưa tải được cửa hàng. Hãy chạy migration mới rồi thử lại.' });
      return null;
    }
  };

  const handleBuyPlant = async (plantId) => {
    setShopLoading(true);
    setShopNotice(null);
    try {
      await purchasePlant(plantId);
      await refreshShop();
      setShopNotice({ type: 'success', message: 'Đã đổi cây thành công. Bạn có thể chọn cây để sử dụng.' });
    } catch (error) {
      setShopNotice({ type: 'error', message: error?.message?.includes('Not enough') ? 'Bạn chưa đủ kim cương để đổi cây này.' : 'Không thể đổi cây lúc này.' });
    } finally {
      setShopLoading(false);
    }
  };

  const handleSelectPlant = async (plantId) => {
    setShopLoading(true);
    setShopNotice(null);
    try {
      await selectPlant(plantId);
      await refreshShop();
      setShopNotice({ type: 'success', message: 'Đã đổi cây tiến độ giáo trình.' });
    } catch (error) {
      setShopNotice({ type: 'error', message: 'Không thể chọn cây này.' });
    } finally {
      setShopLoading(false);
    }
  };

  const prepareLearningCatalog = (catalog) => {
    if (!catalog) return null;
    const vocabulary = catalog.vocabulary.map((remoteWord) => {
      const fallback = VOCAB_SAMPLE.find((word) => word.word === remoteWord.word) || {};
      return { ...fallback, ...remoteWord, img: remoteWord.img || fallback.img, audio: remoteWord.audio || fallback.audio };
    });
    const grammar = (catalog.grammar || []).map(mapDatabaseGrammar);
    return { ...catalog, vocabulary, grammar, exercises: catalog.exercises || [] };
  };

  const openLearningBook = async (book, backView = 'curriculum-hub') => {
    const catalog = prepareLearningCatalog(await loadLearningCatalog(book.id));
    if (catalog) setLearningCatalog(catalog);
    setLessonListBackView(backView);
    setView('tuvung-bai');
  };

  const openGrammarBook = async (book) => {
    const catalog = prepareLearningCatalog(await loadLearningCatalog(book.id));
    if (catalog) setLearningCatalog(catalog);
    setView('nguphap-book');
  };

  const switchLessonTextbook = async (textbookId) => {
    if (!textbookId || textbookId === learningCatalog?.activeTextbook?.id) return;
    const catalog = prepareLearningCatalog(await loadLearningCatalog(textbookId));
    if (catalog) {
      setLearningCatalog(catalog);
      setLesson(catalog.continueLesson || catalog.lessons?.[0] || null);
    }
  };

  const handleAddTextbook = async (book) => {
    setAddingTextbookId(book.id);
    setCatalogNotice(null);
    try {
      await addUserTextbook(book.id);
      const catalog = prepareLearningCatalog(await loadLearningCatalog(book.id));
      if (catalog) setLearningCatalog(catalog);
      setCatalogNotice({ type: 'success', message: `Đã thêm “${book.title}” vào giáo trình của bạn.` });
    } catch (error) {
      setCatalogNotice({ type: 'error', message: error?.message || 'Không thể thêm giáo trình. Vui lòng thử lại.' });
    } finally {
      setAddingTextbookId(null);
    }
  };

  const handleLessonProgressChange = async (lessonProgress, activities) => {
    if (!lesson?.id || !lesson?.textbookId) return;
    const lastActivity = Object.entries(activities).sort((a, b) => b[1] - a[1])[0]?.[0] || 'lesson';
    setLearningCatalog((current) => {
      if (!current) return current;
      const updatedLessons = current.lessons.map((item) => item.id === lesson.id ? { ...item, progressPercent: lessonProgress } : item);
      const updatedContinueLesson = current.continueLesson?.id === lesson.id ? { ...current.continueLesson, progressPercent: lessonProgress } : current.continueLesson;
      return { ...current, hasStarted: true, lessons: updatedLessons, continueLesson: updatedContinueLesson };
    });
    try {
      await syncLessonProgress(lesson.textbookId, lesson.id, lessonProgress, lastActivity);
      const catalog = prepareLearningCatalog(await loadLearningCatalog(lesson.textbookId));
      if (catalog) setLearningCatalog(catalog);
    } catch (error) { }
  };

  const handlePartialActivityProgress = async (activityId, progressPercent) => {
    if (!lesson) return;
    const activities = await loadActivityProgress(lesson, profile?.id);
    activities[activityId] = Math.max(activities[activityId] || 0, progressPercent || 0);
    const lessonProgress = Math.round(Object.values(activities).reduce((sum, value) => sum + value, 0) / ACTIVITIES.length);
    await handleLessonProgressChange(lessonProgress, activities);
  };

  const handleActivityFinish = async (activityId) => {
    if (!lesson) return;
    try {
      const previousActivities = await loadActivityProgress(lesson, profile?.id);
      if (await isActivityMarkedCompleted(lesson, profile?.id, activityId)) {
        await markRemoteActivityCompleted(lesson?.textbookId, lesson?.id, activityId);
        const lessonProgress = Math.round(Object.values(previousActivities).reduce((sum, value) => sum + value, 0) / ACTIVITIES.length);
        await handleLessonProgressChange(lessonProgress, previousActivities);
        setView('lesson-detail');
        return;
      }
      await markActivityCompleted(lesson, profile?.id, activityId);
      const activities = await loadActivityProgress(lesson, profile?.id);
      const lessonProgress = Math.round(Object.values(activities).reduce((sum, value) => sum + value, 0) / ACTIVITIES.length);
      await handleLessonProgressChange(lessonProgress, activities);
      const lessonDone = ACTIVITIES.every((activity) => (activities[activity.id] || 0) >= 100);
      if (lessonDone) {
        let gemReward = null;
        try {
          gemReward = await awardLessonGems(lesson.textbookId || '2-1', lesson.id || lesson.no);
          if (gemReward?.balance != null) setShop((current) => ({ ...current, balance: gemReward.balance }));
        } catch (error) { }
        goHome();
        setLessonCelebration({
          title: `Bài ${lesson.no}${lesson.title ? ` · ${lesson.title}` : ''}`,
          gems: gemReward?.awarded ? 25 : 0,
        });
        if (isCelebrationSoundEnabled()) playCelebrationSound();
        window.setTimeout(() => setLessonCelebration(false), 4500);
      } else {
        setView('lesson-detail');
      }
    } catch (error) {
      setView('lesson-detail');
    }
  };

  useEffect(() => {
    if (authenticatedProfile) {
      setProfile(authenticatedProfile);
      return undefined;
    }
    let alive = true;
    window.storage.get(profileStorageKey('demo')).then((res) => {
      if (!alive) return;
      setProfile(res?.value ? JSON.parse(res.value) : null);
    }).catch(() => { if (alive) setProfile(null); });
    return () => { alive = false; };
  }, [authenticatedProfile]);

  useEffect(() => {
    if (!profile) return undefined;
    let alive = true;
    (async () => {
      let catalog = await loadLearningCatalog();
      if (!catalog || !alive) return;
      for (const item of catalog.lessons || []) {
        try {
          const saved = await window.storage.get(activityCompletionKey(item, profile.id));
          const completed = saved?.value ? JSON.parse(saved.value) : {};
          for (const activity of ACTIVITIES) {
            if (completed[activity.id]) await markRemoteActivityCompleted(item.textbookId, item.id, activity.id);
          }
        } catch (error) { }
      }
      catalog = await loadLearningCatalog(catalog.activeTextbook?.id) || catalog;
      if (alive) setLearningCatalog(prepareLearningCatalog(catalog));
    })();
    return () => { alive = false; };
  }, [profile]);

  useEffect(() => {
    if (!profile?.id) return;
    refreshShop();
  }, [profile?.id]);

  useEffect(() => {
    if (!profile || !ACTIVE_STUDY_VIEWS.has(view)) return;
    const id = setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      const g = await getDailyGoal(profile.id);
      g.todayMinutes = (g.todayMinutes || 0) + 0.5;
      await saveDailyGoal(g, profile.id);
    }, 30000);
    return () => clearInterval(id);
  }, [profile, view]);

  if (profile === undefined) {
    return <div className="app"><div className="auth-loading"><Sparkles size={22} color="#7C6FE4" /></div></div>;
  }
  if (profile === null) {
    return (
      <div className="app">
        <AuthView onDone={(p) => setProfile(p)} />
      </div>
    );
  }

  const openNotif = async () => {
    await markNotifSeen(profile.id);
    setRankTab('congdong');
    setView('xephang');
    setActive('xephanghub');
  };
  const openLeaderboard = () => {
    setRankTab('xephang');
    setView('xephang');
    setActive('xephanghub');
  };
  const goDictation = () => { setActivitySelectBackView('home'); setView('dictation-select'); };
  const goShadowing = () => { setActivitySelectBackView('home'); setView('shadowing-select'); };
  const goReview = () => {
    setReviewMode('random');
    setReviewSelectedLessons([]);
    setReviewSeed(null);
    setLesson(primaryLesson);
    setReviewIntroBackView('home');
    setView('review-intro');
    setActive('thithu');
  };

  const catalogLessons = learningCatalog?.lessons?.length ? learningCatalog.lessons : FALLBACK_LESSONS;
  const catalogVocabulary = learningCatalog?.vocabulary?.length ? learningCatalog.vocabulary : VOCAB_SAMPLE;
  const catalogGrammar = learningCatalog?.grammar?.length ? learningCatalog.grammar : GRAMMAR_SAMPLE;
  const primaryLesson = catalogLessons[0] || FALLBACK_LESSONS[0];
  const selectedLesson = lesson || primaryLesson;
  const lessonVocabularyFromDatabase = learningCatalog?.vocabulary?.filter((word) => word.lessonId === selectedLesson?.id) || [];
  const lessonGrammarFromDatabase = learningCatalog?.grammar?.filter((item) => item.lessonId === selectedLesson?.id) || [];
  const lessonExercises = learningCatalog?.exercises?.filter((exercise) => exercise.lessonId === selectedLesson?.id) || [];
  const lessonVocabulary = lessonVocabularyFromDatabase.length ? lessonVocabularyFromDatabase : VOCAB_SAMPLE;
  const lessonGrammar = lessonGrammarFromDatabase.length ? lessonGrammarFromDatabase : GRAMMAR_SAMPLE;
  const databaseShadowLines = mapDatabaseLines(lessonExercises, 'shadowing');
  const databaseDictationLines = mapDatabaseLines(lessonExercises, 'dictation');
  const lessonShadowLines = databaseShadowLines.length ? databaseShadowLines : SHADOW_LINES;
  const lessonDictationLines = databaseDictationLines.length ? databaseDictationLines : SHADOW_LINES;
  const reviewLessons = reviewMode === 'bylesson' && reviewSelectedLessons.length
    ? catalogLessons.filter((item) => reviewSelectedLessons.includes(item.no))
    : catalogLessons;
  const reviewLessonIds = new Set(reviewLessons.map((item) => item.id));
  const reviewVocabularyFromDatabase = learningCatalog?.vocabulary?.filter((word) => reviewLessonIds.has(word.lessonId)) || [];
  const reviewGrammarFromDatabase = learningCatalog?.grammar?.filter((item) => reviewLessonIds.has(item.lessonId)) || [];
  const reviewExercises = learningCatalog?.exercises?.filter((exercise) => reviewLessonIds.has(exercise.lessonId)) || [];
  const reviewVocabulary = reviewVocabularyFromDatabase.length ? reviewVocabularyFromDatabase : lessonVocabulary;
  const reviewGrammar = reviewGrammarFromDatabase.length ? reviewGrammarFromDatabase : lessonGrammar;
  const reviewLinesFromDatabase = mapDatabaseLines(reviewExercises, 'shadowing');
  const reviewLines = reviewLinesFromDatabase.length ? reviewLinesFromDatabase : lessonShadowLines;
  const activeTextbookTitle = learningCatalog?.activeTextbook?.title || 'Giáo trình tiếng Hàn';
  const continueTextbook = learningCatalog?.activeTextbook?.isAdded ? learningCatalog.activeTextbook : null;
  const continueLesson = continueTextbook ? (learningCatalog?.continueLesson || null) : null;

  return (
    <UserStatsContext.Provider value={userStats}>
      <GemBalanceContext.Provider value={shop.balance}>
        <div className={`app ${immersive ? 'no-sidebar' : ''}`}>
          {lessonCelebration && (
            <div className="lesson-celebration" role="status" aria-live="polite">
              <ConfettiBurst />
              <div className="lesson-celebration-card">
                <div className="lesson-celebration-book"><BookOpen size={64} /></div>
                <span className="lesson-celebration-kicker">TUYỆT VỜI!</span>
                <strong>Bạn đã hoàn thành bài học</strong>
                <p>{lessonCelebration.title}</p>
                {lessonCelebration.gems > 0 && <div className="lesson-gem-reward"><DiamondIcon size={21} /> +25 kim cương</div>}
              </div>
            </div>
          )}
          {!immersive && (
            <Sidebar
              active={active}
              setActive={setActive}
              setView={setView}
              goHome={goHome}
              onSignOut={onSignOut}
              isAdmin={profile?.role === 'admin'}
              gems={shop.balance}
              onOpenShop={refreshShop}
            />
          )}
          <main className="main">
            {view === 'home' && (
              <div className="dashboard-grid">
                <Header profile={profile} stats={userStats} onOpenNotif={openNotif} />
                <ReminderBanner userId={profile.id} onGoStudy={() => openLesson(primaryLesson, 'home')} />
                <div className="dashboard-overview">
                  <ContinueLearning
                    textbook={continueTextbook}
                    lesson={continueLesson}
                    hasStarted={learningCatalog?.hasStarted || false}
                    plantVariant={shop.selectedPlant}
                    onGo={() => continueLesson
                      ? openLesson(continueLesson, 'home')
                      : (setCatalogNotice(null), setView('curriculum-hub'), setActive('curriculum'))}
                  />
                  <WordOfDayWidget vocabulary={catalogVocabulary} onOpen={() => openVocabulary(primaryLesson, 'home')} />
                  <RecentActivityCard profile={profile} lesson={primaryLesson} vocabulary={catalogVocabulary} />
                  <DailyGoalRing userId={profile.id} onChangeGoal={() => { setActive('caidat'); setView('caidat'); }} />
                  <QuickAccessMenu onDictation={goDictation} onShadowing={goShadowing} onReview={goReview} />
                  <RankPreviewCard profile={profile} onOpen={openLeaderboard} />
                </div>
                <PersonalProgressSection profile={profile} lesson={primaryLesson} vocabulary={catalogVocabulary} />
                <div className="mid-row">
                  <ReviewSchedule
                    userId={profile.id}
                    onReview={(words) => { setLesson(primaryLesson); setReviewDeck(words); setView('flashcards-schedule'); }}
                  />
                  <MyTextbooks
                    books={learningCatalog?.myTextbooks || []}
                    onOpenBook={(book) => openLearningBook(book, 'home')}
                    onAddBook={() => { setCatalogNotice(null); setView('curriculum-hub'); setActive('curriculum'); }}
                  />
                </div>
              </div>
            )}
            {view === 'xephang' && (
              <RankingCommunityView
                profile={profile}
                onBack={goHome}
                initialTab={rankTab}
                textbooks={learningCatalog?.textbooks || learningCatalog?.myTextbooks || []}
                onStudyCustomLesson={(l) => { setCustomLessonData(l); setView('study-custom-lesson'); }}
              />
            )}
            {view === 'tuvung-chude' && <TopicsView onBack={goHome} />}
            {view === 'nguphap-hub' && (
              <GrammarHubView
                books={learningCatalog?.myTextbooks || []}
                onBack={goHome}
                onOpenBook={openGrammarBook}
                onAddBook={() => { setCatalogNotice(null); setView('curriculum-hub'); setActive('giaotrinh'); }}
              />
            )}
            {view === 'cuahang' && (
              <PlantShopView
                shop={shop}
                loading={shopLoading}
                notice={shopNotice}
                onBack={goHome}
                onBuy={handleBuyPlant}
                onSelect={handleSelectPlant}
              />
            )}
            {view === 'mock-exam' && (
              <ReviewIntroView
                lesson={primaryLesson}
                userId={profile.id}
                vocabulary={reviewVocabulary}
                grammar={reviewGrammar}
                lines={reviewLines}
                exercises={reviewExercises}
                mode="random"
                selectedLessons={[]}
                onBack={goHome}
                onStart={(diff, useSeed) => {
                  setLesson(primaryLesson);
                  setReviewMode('random');
                  setReviewIntroBackView('mock-exam');
                  setReviewDifficulty(diff);
                  setReviewSeed(useSeed ? diff.stars * 97 + 13 : null);
                  setView('review-quiz');
                }}
              />
            )}
            {view === 'nguphap-book' && (
              <GrammarBookView
                lessons={catalogLessons}
                grammar={catalogGrammar}
                textbookTitle={activeTextbookTitle}
                onBack={() => setView('nguphap-hub')}
                onSelectLesson={(idx) => {
                  const selectedLessonItem = catalogLessons[idx];
                  if (selectedLessonItem?.textbookId && selectedLessonItem?.id) markLessonStarted(selectedLessonItem.textbookId, selectedLessonItem.id).catch(() => { });
                  setLesson(selectedLessonItem);
                  setView('flashcards-grammar');
                }}
              />
            )}
            {view === 'flashcards-grammar' && lesson && (
              <FlashcardView
                lesson={lesson}
                userId={profile.id}
                vocabulary={lessonVocabulary}
                grammar={lessonGrammar}
                initialTab="grammar"
                onBack={() => setView('nguphap-book')}
                onFinish={() => setView('nguphap-book')}
              />
            )}
            {view === 'study-custom-lesson' && customLessonData && (
              <CustomLessonStudyView
                lessonData={customLessonData}
                onBack={() => { setRankTab('congdong'); setView('xephang'); }}
                onStartQuiz={(l) => { setCustomLessonData(l); setView('test-custom-lesson'); }}
              />
            )}
            {view === 'test-custom-lesson' && customLessonData && (
              <CustomLessonTestView lessonData={customLessonData} onBack={() => setView('study-custom-lesson')} />
            )}
            {view === 'aiquiz' && <AIQuizView onBack={goHome} />}
            {view === 'review-hub' && (
              <ReviewHubView
                onBack={() => setView(reviewHubBackView)}
                onPickByLesson={() => { setReviewMode('bylesson'); setReviewSeed(null); setView('review-lesson-select'); }}
                onPickRandom={() => { setReviewMode('random'); setLesson(primaryLesson); setView('review-intro'); }}
              />
            )}
            {view === 'review-lesson-select' && (
              <ReviewLessonSelectView
                lessons={catalogLessons}
                onBack={() => setView('review-hub')}
                onNext={(lessonNos) => {
                  setReviewSelectedLessons(lessonNos);
                  setLesson(catalogLessons.find((item) => lessonNos.includes(item.no)) || primaryLesson);
                  setView('review-intro');
                }}
              />
            )}
            {view === 'review-intro' && lesson && (
              <ReviewIntroView
                lesson={lesson}
                userId={profile.id}
                vocabulary={reviewVocabulary}
                grammar={reviewGrammar}
                lines={reviewLines}
                exercises={reviewExercises}
                mode={reviewMode}
                selectedLessons={reviewSelectedLessons}
                onBack={() => setView(reviewIntroBackView)}
                onStart={(diff, useSeed) => {
                  setReviewDifficulty(diff);
                  setReviewSeed(useSeed ? diff.stars * 97 + 13 : null);
                  setReviewIsRecheck(false);
                  setView('review-quiz');
                }}
              />
            )}
            {view === 'review-quiz' && lesson && reviewDifficulty && (
              <ReviewQuizView
                lesson={lesson}
                userId={profile.id}
                vocabulary={reviewVocabulary}
                grammar={reviewGrammar}
                lines={reviewLines}
                exercises={reviewExercises}
                difficulty={reviewDifficulty}
                mode={reviewMode}
                seed={reviewSeed}
                isRecheck={reviewIsRecheck}
                onBack={() => setView('review-intro')}
                onChangeSet={() => setReviewSeed(null)}
                onFinish={(answers, writing, elapsedMs, reflex) => {
                  setReviewAnswers(answers);
                  setReviewWriting(writing);
                  setReviewElapsed(elapsedMs);
                  setReviewReflex(reflex || []);
                  setView('review-result');
                }}
              />
            )}
            {view === 'review-result' && reviewDifficulty && (
              <ReviewResultView
                answers={reviewAnswers}
                writingResults={reviewWriting}
                reflexResults={reviewReflex}
                elapsedMs={reviewElapsed}
                difficulty={reviewDifficulty}
                mode={reviewMode}
                onRetry={() => { setReviewIsRecheck(true); setView('review-quiz'); }}
                onChangeSet={reviewMode === 'random' ? () => { setReviewSeed(null); setReviewIsRecheck(true); setView('review-quiz'); } : undefined}
                onHome={() => reviewMode === 'bylesson' ? handleActivityFinish('ontap') : goHome()}
              />
            )}
            {view.startsWith('soon-') && (
              <ComingSoonView modeId={view.replace('soon-', '')} onBack={goHome} />
            )}
            {view === 'caidat' && (
              <SettingsView
                onBack={goHome}
                onSignOut={onSignOut}
                userId={profile.id}
                lesson={primaryLesson}
                vocabulary={catalogVocabulary}
                textbookTitle={activeTextbookTitle}
              />
            )}
            {view === 'curriculum-hub' && (
              <CurriculumHubView
                myBooks={learningCatalog?.myTextbooks || []}
                availableBooks={learningCatalog?.availableTextbooks || []}
                addingBookId={addingTextbookId}
                notice={catalogNotice}
                onBack={goHome}
                onOpenBook={(book) => openLearningBook(book, 'curriculum-hub')}
                onAddBook={handleAddTextbook}
              />
            )}
            {view === 'tuvung-bai' && (
              <LessonsView
                lessons={catalogLessons}
                textbooks={learningCatalog?.myTextbooks || []}
                activeTextbookId={learningCatalog?.activeTextbook?.id}
                continueLesson={learningCatalog?.hasStarted ? learningCatalog?.continueLesson : null}
                onChangeTextbook={switchLessonTextbook}
                textbookTitle={activeTextbookTitle}
                title="Giáo trình · Danh sách bài"
                backLabel={lessonListBackView === 'home' ? 'Trang chủ' : 'Giáo trình'}
                onBack={() => setView(lessonListBackView)}
                onSelect={(selectedLessonItem) => openLesson(selectedLessonItem, 'tuvung-bai')}
              />
            )}
            {view === 'lesson-detail' && lesson && (
              <LessonDetailView
                lesson={lesson}
                userId={profile.id}
                textbookTitle={activeTextbookTitle}
                onProgressChange={handleLessonProgressChange}
                onBack={() => setView(lessonDetailBackView)}
                onStartActivity={(actId) => {
                  if (actId === 'tuvung') { setVocabBackView('lesson-detail'); setView('vocab-list'); }
                  if (actId === 'shadowing') { setActivityRunBackView('lesson-detail'); setView('shadowing'); }
                  if (actId === 'nghechep') { setDictationEntryBackView('lesson-detail'); setView('dictation-mode-select'); }
                  if (actId === 'ontap') {
                    setReviewMode('bylesson');
                    setReviewSelectedLessons([lesson]);
                    setReviewSeed(null);
                    setReviewIntroBackView('lesson-detail');
                    setView('review-intro');
                  }
                  if (actId === 'aiquiz') setView('aiquiz');
                }}
              />
            )}
            {view === 'vocab-list' && lesson && (
              <VocabListView
                lesson={lesson}
                userId={profile.id}
                vocabulary={lessonVocabulary}
                grammar={lessonGrammar}
                reviewingSession={reviewAllFlashcards}
                onBack={() => { setReviewAllFlashcards(false); setView(vocabBackView); }}
                onReviewStart={() => setReviewAllFlashcards(true)}
                onStudy={(reviewing) => { setReviewAllFlashcards(Boolean(reviewing)); setView('flashcards'); }}
              />
            )}
            {view === 'vocab-notebook' && lesson && (
              <VocabNotebookView
                lesson={lesson}
                userId={profile.id}
                vocabulary={catalogVocabulary}
                onBack={goHome}
                onReview={(words) => { setReviewDeck(words); setView('flashcards-notebook'); }}
              />
            )}
            {view === 'flashcards-notebook' && lesson && reviewDeck && (
              <FlashcardView
                lesson={lesson}
                userId={profile.id}
                vocabulary={catalogVocabulary}
                deckWords={reviewDeck}
                deckTitle="Sổ tay từ vựng"
                onBack={() => setView('vocab-notebook')}
                onFinish={() => setView('vocab-notebook')}
              />
            )}
            {view === 'flashcards-schedule' && lesson && reviewDeck && (
              <FlashcardView
                lesson={lesson}
                userId={profile.id}
                vocabulary={catalogVocabulary}
                deckWords={reviewDeck}
                deckTitle="Lịch ôn từ vựng"
                includeMastered
                onBack={goHome}
                onFinish={goHome}
              />
            )}
            {view === 'flashcards' && lesson && (
              <FlashcardView
                lesson={lesson}
                userId={profile.id}
                vocabulary={lessonVocabulary}
                grammar={lessonGrammar}
                includeMastered={reviewAllFlashcards}
                onBack={() => setView('vocab-list')}
                onFinish={() => { setReviewAllFlashcards(false); handleActivityFinish('tuvung'); }}
              />
            )}
            {view === 'vocab-test-select' && lesson && (
              <VocabTestSelectView
                lesson={lesson}
                onBack={() => setView('flashcards')}
                onPick={(mode) => setView(`vocab-test-${mode}`)}
              />
            )}
            {view === 'vocab-test-fillblank' && (
              <FillBlankListenView onBack={() => setView('vocab-test-select')} />
            )}
            {view === 'vocab-test-match' && (
              <MatchPairsView onBack={() => setView('vocab-test-select')} />
            )}
            {view === 'vocab-test-image' && (
              <ChooseImageView onBack={() => setView('vocab-test-select')} />
            )}
            {view === 'shadowing-select' && (
              <ActivityLessonSelectView
                lessons={catalogLessons}
                textbookTitle={activeTextbookTitle}
                title="Shadowing"
                icon={Mic}
                color="#7C6FE4"
                onBack={() => setView(activitySelectBackView)}
                backLabel={activitySelectBackView === 'study-hub' ? 'Từ vựng & bài học' : activitySelectBackView === 'lesson-detail' ? `Bài ${lesson?.no || 1}` : 'Trang chủ'}
                onSelect={(l) => { setLesson(l); setActivityRunBackView('shadowing-select'); setView('shadowing'); }}
              />
            )}
            {view === 'shadowing' && lesson && (
              <ShadowingView
                lesson={lesson}
                userId={profile.id}
                lines={lessonShadowLines}
                onBack={() => setView(activityRunBackView)}
                onFinish={() => handleActivityFinish('shadowing')}
                onProgress={handlePartialActivityProgress}
              />
            )}
            {view === 'dictation-select' && (
              <ActivityLessonSelectView
                lessons={catalogLessons}
                textbookTitle={activeTextbookTitle}
                title="Nghe chép chính tả"
                icon={Headphones}
                color="#3FA95C"
                onBack={() => setView(activitySelectBackView)}
                backLabel={activitySelectBackView === 'study-hub' ? 'Từ vựng & bài học' : activitySelectBackView === 'lesson-detail' ? `Bài ${lesson?.no || 1}` : 'Trang chủ'}
                onSelect={(l) => { setLesson(l); setDictationEntryBackView('dictation-select'); setView('dictation-mode-select'); }}
              />
            )}
            {view === 'dictation-mode-select' && lesson && (
              <DictationModeSelectView
                lesson={lesson}
                onBack={() => setView(dictationEntryBackView)}
                onSelect={(selectedMode) => { setDictationMode(selectedMode); setView('dictation'); }}
              />
            )}
            {view === 'dictation' && lesson && (
              <DictationView
                lesson={lesson}
                userId={profile.id}
                lines={lessonDictationLines}
                vocabulary={lessonVocabulary}
                initialMode={dictationMode}
                onBack={() => setView('dictation-mode-select')}
                onFinish={() => handleActivityFinish('nghechep')}
                onGoVocab={() => setView('flashcards')}
                onProgress={handlePartialActivityProgress}
              />
            )}
          </main>
        </div>
      </GemBalanceContext.Provider>
    </UserStatsContext.Provider>
  );
}
