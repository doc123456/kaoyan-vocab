import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AutoAdvanceToggle from '../components/AutoAdvanceToggle';
import { useAutoAdvance } from '../hooks/useAutoAdvance';
import { useStudyActivityTimer } from '../hooks/useStudyActivityTimer';
import { TraditionalWordQuestion } from '../types';
import { getTestStudyData, saveTestResult, updateProgress } from '../utils/api';

const sessionKey = 'testStudyDraft';

const arraysEqual = (a: number[], b: number[]) => {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort((x, y) => x - y);
  const sortedB = [...b].sort((x, y) => x - y);
  return sortedA.every((value, index) => value === sortedB[index]);
};

const formatDuration = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const restSeconds = safeSeconds % 60;
  return `${minutes}:${String(restSeconds).padStart(2, '0')}`;
};

const TestStudy: React.FC = () => {
  const [items, setItems] = useState<TraditionalWordQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<number[]>([]);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [finished, setFinished] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeStartedAt, setActiveStartedAt] = useState<number | null>(null);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [savedScore, setSavedScore] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const { autoAdvanceCorrect } = useAutoAdvance();

  useStudyActivityTimer(started && !loading && !finished && items.length > 0);

  const currentItem = items[currentIndex];
  const correctCount = useMemo(() => answers.filter(Boolean).length, [answers]);
  const liveElapsedSeconds = started && activeStartedAt
    ? elapsedSeconds + Math.floor((Date.now() - activeStartedAt) / 1000)
    : elapsedSeconds;
  const score = items.length > 0 ? Math.round((correctCount / items.length) * 1000) / 10 : 0;

  const saveDraft = useCallback((overrides: Partial<{
    items: TraditionalWordQuestion[];
    currentIndex: number;
    selectedOptions: number[];
    answers: boolean[];
    showResult: boolean;
    isCorrect: boolean;
    elapsedSeconds: number;
    questionStartTime: number;
  }> = {}) => {
    const draft = {
      items: overrides.items ?? items,
      currentIndex: overrides.currentIndex ?? currentIndex,
      selectedOptions: overrides.selectedOptions ?? selectedOptions,
      answers: overrides.answers ?? answers,
      showResult: overrides.showResult ?? showResult,
      isCorrect: overrides.isCorrect ?? isCorrect,
      elapsedSeconds: overrides.elapsedSeconds ?? liveElapsedSeconds,
      questionStartTime: overrides.questionStartTime ?? questionStartTime
    };

    if (draft.items.length > 0 && !finished) {
      sessionStorage.setItem(sessionKey, JSON.stringify(draft));
    }
  }, [answers, currentIndex, finished, isCorrect, items, liveElapsedSeconds, questionStartTime, selectedOptions, showResult]);

  useEffect(() => {
    setHasDraft(Boolean(sessionStorage.getItem(sessionKey)));
  }, []);

  useEffect(() => {
    if (!started || finished || loading || items.length === 0) return;
    saveDraft();
  }, [started, finished, loading, items.length, saveDraft]);

  useEffect(() => {
    if (!started || finished) return;

    const timer = window.setInterval(() => {
      setElapsedSeconds((seconds) => {
        if (!activeStartedAt) return seconds;
        const nextSeconds = seconds + Math.floor((Date.now() - activeStartedAt) / 1000);
        setActiveStartedAt(Date.now());
        return nextSeconds;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [activeStartedAt, finished, started]);

  useEffect(() => {
    const pauseAndSave = () => {
      if (!started || finished) return;
      const nextElapsed = activeStartedAt
        ? elapsedSeconds + Math.floor((Date.now() - activeStartedAt) / 1000)
        : elapsedSeconds;
      setElapsedSeconds(nextElapsed);
      setActiveStartedAt(null);
      saveDraft({ elapsedSeconds: nextElapsed });
    };

    const resume = () => {
      if (!started || finished) return;
      setActiveStartedAt(Date.now());
    };

    const handleVisibility = () => {
      if (document.hidden) pauseAndSave();
      else resume();
    };

    window.addEventListener('beforeunload', pauseAndSave);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('beforeunload', pauseAndSave);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [activeStartedAt, elapsedSeconds, finished, saveDraft, started]);

  const loadDraft = () => {
    const saved = sessionStorage.getItem(sessionKey);
    if (!saved) return false;

    try {
      const draft = JSON.parse(saved);
      if (!Array.isArray(draft.items) || draft.items.length === 0) return false;
      setItems(draft.items);
      setCurrentIndex(draft.currentIndex || 0);
      setSelectedOptions(draft.selectedOptions || []);
      setAnswers(draft.answers || []);
      setShowResult(Boolean(draft.showResult));
      setIsCorrect(Boolean(draft.isCorrect));
      setElapsedSeconds(Math.max(0, Math.floor(draft.elapsedSeconds || 0)));
      setQuestionStartTime(Date.now());
      setSavedScore(null);
      setFinished(false);
      setStarted(true);
      setActiveStartedAt(Date.now());
      setHasDraft(false);
      return true;
    } catch (error) {
      sessionStorage.removeItem(sessionKey);
      setHasDraft(false);
      return false;
    }
  };

  const startNewTest = useCallback(async () => {
    setLoading(true);
    try {
      sessionStorage.removeItem(sessionKey);
      const response = await getTestStudyData(100);
      setItems(response.data);
      setCurrentIndex(0);
      setSelectedOptions([]);
      setAnswers([]);
      setShowResult(false);
      setIsCorrect(false);
      setFinished(false);
      setSavedScore(null);
      setElapsedSeconds(0);
      setActiveStartedAt(Date.now());
      setQuestionStartTime(Date.now());
      setStarted(true);
      setHasDraft(false);
    } catch (error) {
      console.error('获取测试数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleOption = useCallback((optionIndex: number) => {
    if (showResult || !currentItem?.options?.[optionIndex]) return;
    setSelectedOptions((selected) =>
      selected.includes(optionIndex)
        ? selected.filter(index => index !== optionIndex)
        : [...selected, optionIndex]
    );
  }, [currentItem, showResult]);

  const finishTest = useCallback(async (nextAnswers: boolean[]) => {
    const finalElapsed = activeStartedAt
      ? elapsedSeconds + Math.floor((Date.now() - activeStartedAt) / 1000)
      : elapsedSeconds;
    const finalCorrectCount = nextAnswers.filter(Boolean).length;
    const response = await saveTestResult({
      total_count: items.length,
      correct_count: finalCorrectCount,
      duration: finalElapsed
    });
    sessionStorage.removeItem(sessionKey);
    setElapsedSeconds(finalElapsed);
    setActiveStartedAt(null);
    setSavedScore(response.data.score);
    setFinished(true);
    setStarted(false);
  }, [activeStartedAt, elapsedSeconds, items.length]);

  const goToNext = useCallback(async (nextAnswers = answers) => {
    const nextIndex = currentIndex + 1;
    setSelectedOptions([]);
    setShowResult(false);
    setIsCorrect(false);

    if (currentIndex < items.length - 1) {
      setCurrentIndex(nextIndex);
      setQuestionStartTime(Date.now());
      saveDraft({
        currentIndex: nextIndex,
        selectedOptions: [],
        showResult: false,
        isCorrect: false,
        answers: nextAnswers,
        questionStartTime: Date.now()
      });
      return;
    }

    await finishTest(nextAnswers);
  }, [answers, currentIndex, finishTest, items.length, saveDraft]);

  const submitAnswer = useCallback(async () => {
    if (!currentItem || showResult) return;

    const correctIndexes = currentItem.options
      .map((option, index) => option.is_correct ? index : -1)
      .filter(index => index >= 0);
    const correct = arraysEqual(selectedOptions, correctIndexes);
    const nextAnswers = [...answers, correct];
    const responseTime = Date.now() - questionStartTime;

    setAnswers(nextAnswers);
    setIsCorrect(correct);

    try {
      await Promise.all(
        currentItem.options
          .filter(option => option.is_correct && option.meaning_id)
          .map(option => updateProgress(option.meaning_id as number, {
            is_correct: correct,
            response_time: responseTime,
            study_mode: 'test'
          }))
      );
    } catch (error) {
      console.error('更新测试进度失败:', error);
    }

    if (correct && autoAdvanceCorrect) {
      await goToNext(nextAnswers);
      return;
    }

    setShowResult(true);
    saveDraft({ answers: nextAnswers, showResult: true, isCorrect: correct });
  }, [answers, autoAdvanceCorrect, currentItem, goToNext, questionStartTime, saveDraft, selectedOptions, showResult]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || finished || !started) return;
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (event.key === 'Enter') {
        event.preventDefault();
        if (showResult) {
          goToNext();
          return;
        }
        submitAnswer();
        return;
      }

      const key = event.key.toLowerCase();
      const optionIndexByKey: Record<string, number> = {
        '1': 0,
        '2': 1,
        '3': 2,
        '4': 3,
        a: 0,
        b: 1,
        c: 2,
        d: 3
      };
      const optionIndex = optionIndexByKey[key];
      if (optionIndex !== undefined) {
        event.preventDefault();
        toggleOption(optionIndex);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [finished, goToNext, showResult, started, submitAnswer, toggleOption]);

  if (!started && !finished) {
    return (
      <div className="mx-auto max-w-2xl rounded-lg bg-white p-8 text-center shadow">
        <h1 className="text-3xl font-bold text-gray-800">测试模式</h1>
        <p className="mt-3 text-gray-600">本次测试共 100 个随机记忆单元，开始后会记录用时和答题进度。</p>
        {hasDraft && (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
            检测到上次未完成答题，是否继续上一次的进度？
            <div className="mt-4 flex justify-center gap-3">
              <button onClick={loadDraft} className="rounded-lg bg-amber-600 px-5 py-2 text-white hover:bg-amber-700">继续上次</button>
              <button onClick={startNewTest} className="rounded-lg bg-gray-100 px-5 py-2 text-gray-700 hover:bg-gray-200">重新开始</button>
            </div>
          </div>
        )}
        {!hasDraft && (
          <button
            onClick={startNewTest}
            disabled={loading}
            className="mt-8 rounded-lg bg-primary-600 px-6 py-3 text-white hover:bg-primary-700 disabled:bg-gray-300"
          >
            {loading ? '加载中...' : '开始答题'}
          </button>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-xl text-gray-500">加载中...</div>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="mx-auto max-w-2xl rounded-lg bg-white p-8 text-center shadow">
        <h1 className="text-3xl font-bold text-gray-800">测试完成</h1>
        <div className="mt-6 text-5xl font-bold text-primary-600">{savedScore ?? score}%</div>
        <p className="mt-3 text-gray-600">答对 {correctCount} / {items.length} 题</p>
        <p className="mt-1 text-gray-500">总用时 {formatDuration(elapsedSeconds)}</p>
        <button
          onClick={startNewTest}
          className="mt-8 rounded-lg bg-primary-600 px-6 py-3 text-white hover:bg-primary-700"
        >
          再测一次
        </button>
      </div>
    );
  }

  if (!currentItem) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-xl text-gray-500">暂无测试题</div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_220px]">
      <div>
        <AutoAdvanceToggle showSpellingGate={false} />

        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-800">测试模式</h1>
          <div className="text-sm text-gray-500">当前 {currentIndex + 1} / {items.length}</div>
        </div>

        <div className="mb-6 h-2 rounded-full bg-gray-200">
          <div
            className="h-2 rounded-full bg-primary-600 transition-all"
            style={{ width: `${((currentIndex + 1) / items.length) * 100}%` }}
          />
        </div>

        <div className="rounded-lg bg-white p-8 shadow-lg">
          <div className="mb-6 text-center">
            <h2 className="text-4xl font-bold text-gray-800">{currentItem.word}</h2>
            <div className="mt-2 text-gray-500">
              {currentItem.phonetic_uk && <span className="mr-4">英 {currentItem.phonetic_uk}</span>}
              {currentItem.phonetic_us && <span>美 {currentItem.phonetic_us}</span>}
            </div>
          </div>

          <div className="mb-4 text-sm text-gray-500">选择这个单词可能对应的所有释义</div>
          <div className="space-y-3">
            {currentItem.options.map((option, index) => {
              const selected = selectedOptions.includes(index);
              let optionClass = selected
                ? 'border-primary-500 bg-primary-100 text-primary-900'
                : 'border-gray-200 bg-white text-gray-800 hover:border-primary-300 hover:bg-primary-50';

              if (showResult) {
                if (option.is_correct) {
                  optionClass = 'border-green-500 bg-green-100 text-green-800';
                } else if (selected) {
                  optionClass = 'border-red-500 bg-red-100 text-red-800';
                } else {
                  optionClass = 'border-gray-200 bg-white text-gray-800';
                }
              }

              return (
                <button
                  key={`${option.text}-${index}`}
                  onClick={() => toggleOption(index)}
                  disabled={showResult}
                  className={`w-full rounded-lg border-2 p-4 text-left transition-all ${optionClass}`}
                >
                  <span className="mr-2 inline-flex min-w-[3rem] justify-center rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                    {index + 1} / {String.fromCharCode(65 + index)}
                  </span>
                  {option.text}
                </button>
              );
            })}
          </div>

          {showResult && (
            <div className={`mt-6 rounded-lg p-4 text-center ${isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {isCorrect ? '回答正确' : '回答错误'}
            </div>
          )}

          <button
            onClick={() => showResult ? goToNext() : submitAnswer()}
            className="mt-6 w-full rounded-lg bg-primary-600 py-3 text-white transition-colors hover:bg-primary-700"
          >
            <span className="mr-2 rounded bg-white/20 px-2 py-0.5 text-xs">Enter</span>
            {showResult ? '下一题' : '提交答案'}
          </button>
        </div>
      </div>

      <aside className="h-fit rounded-lg bg-white p-5 shadow">
        <div className="text-sm text-gray-500">总用时</div>
        <div className="mt-2 text-3xl font-bold text-primary-600">{formatDuration(liveElapsedSeconds)}</div>
        <div className="mt-5 border-t pt-4 text-sm text-gray-600">
          <div className="flex justify-between py-1">
            <span>已答</span>
            <span>{answers.length}</span>
          </div>
          <div className="flex justify-between py-1">
            <span>正确</span>
            <span>{correctCount}</span>
          </div>
          <div className="flex justify-between py-1">
            <span>当前分</span>
            <span>{score}%</span>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default TestStudy;
