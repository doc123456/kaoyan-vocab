import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getPhraseStudyData, updateProgress } from '../utils/api';
import { PhraseExercise } from '../types';
import { useStudyActivityTimer } from '../hooks/useStudyActivityTimer';
import { useAutoAdvance } from '../hooks/useAutoAdvance';
import AutoAdvanceToggle from '../components/AutoAdvanceToggle';
import SpellingGate from '../components/SpellingGate';

type PracticeMode = 'fill' | 'choice';

const normalizeAnswer = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, ' ');

const PhraseStudy: React.FC = () => {
  const storageKey = 'phraseStudySession';
  const batchSize = 20;

  const [items, setItems] = useState<PhraseExercise[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mode, setMode] = useState<PracticeMode>('fill');
  const [answer, setAnswer] = useState('');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [spellingPassed, setSpellingPassed] = useState(false);
  const { autoAdvanceCorrect, spellingGateWrongAnswers } = useAutoAdvance();

  useStudyActivityTimer(!loading && !finished && items.length > 0);

  const currentItem = items[currentIndex];
  const spellingGateActive = spellingGateWrongAnswers && showResult && !isCorrect && !spellingPassed;
  const normalizedCorrectAnswer = useMemo(
    () => normalizeAnswer(currentItem?.answer || ''),
    [currentItem]
  );

  const fetchStudyData = useCallback(async () => {
    try {
      const response = await getPhraseStudyData(batchSize);
      setItems(response.data);
      setCurrentIndex(0);
      setAnswer('');
      setSelectedOption(null);
      setShowResult(false);
      setIsCorrect(false);
      setSpellingPassed(false);
      setQuestionStartTime(Date.now());
      setFinished(response.data.length === 0);
    } catch (error) {
      console.error('获取词组练习数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchNextBatch = useCallback(async () => {
    const response = await getPhraseStudyData(batchSize);
    setItems(response.data);
    setCurrentIndex(0);
    setAnswer('');
    setSelectedOption(null);
    setShowResult(false);
    setIsCorrect(false);
    setSpellingPassed(false);
    setQuestionStartTime(Date.now());
    setFinished(response.data.length === 0);
    if (response.data.length === 0) {
      sessionStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  useEffect(() => {
    const savedSession = sessionStorage.getItem(storageKey);
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        if (Array.isArray(session.items) && session.items.length > 0) {
          setItems(session.items);
          setCurrentIndex(session.currentIndex || 0);
          setMode(session.mode || 'fill');
          setAnswer(session.answer || '');
          setSelectedOption(session.selectedOption ?? null);
          setShowResult(Boolean(session.showResult));
          setIsCorrect(Boolean(session.isCorrect));
          setSpellingPassed(Boolean(session.spellingPassed));
          setCompletedCount(session.completedCount || 0);
          setQuestionStartTime(Date.now());
          setFinished(false);
          setLoading(false);
          return;
        }
      } catch (error) {
        sessionStorage.removeItem(storageKey);
      }
    }

    fetchStudyData();
  }, [fetchStudyData, storageKey]);

  useEffect(() => {
    if (loading || finished || items.length === 0) return;
    sessionStorage.setItem(storageKey, JSON.stringify({
      items,
      currentIndex,
      mode,
      answer,
      selectedOption,
      showResult,
      isCorrect,
      spellingPassed,
      completedCount
    }));
  }, [answer, completedCount, currentIndex, finished, isCorrect, items, loading, mode, selectedOption, showResult, spellingPassed, storageKey]);

  const recordResult = useCallback(async (correct: boolean) => {
    if (!currentItem) return;

    try {
      await updateProgress(currentItem.meaning_id, {
        is_correct: correct,
        response_time: Date.now() - questionStartTime,
        study_mode: mode === 'fill' ? 'phrase-fill' : 'phrase-choice'
      });
    } catch (error) {
      console.error('更新进度失败:', error);
    }
  }, [currentItem, mode, questionStartTime]);

  const submitFillAnswer = useCallback(async () => {
    if (!currentItem || showResult) return;

    const correct = normalizeAnswer(answer) === normalizedCorrectAnswer;
    setIsCorrect(correct);
    setSpellingPassed(false);
    setShowResult(true);
    await recordResult(correct);
  }, [answer, currentItem, normalizedCorrectAnswer, recordResult, showResult]);

  const selectOption = useCallback(async (optionIndex: number) => {
    if (!currentItem || showResult || !currentItem.options?.[optionIndex]) return;

    const option = currentItem.options[optionIndex];
    setSelectedOption(optionIndex);
    setIsCorrect(option.is_correct);
    setSpellingPassed(false);
    setShowResult(true);
    await recordResult(option.is_correct);
  }, [currentItem, recordResult, showResult]);

  const revealAnswer = useCallback(async () => {
    if (!currentItem || showResult) return;

    setAnswer(currentItem.answer);
    setSelectedOption(null);
    setIsCorrect(false);
    setSpellingPassed(false);
    setShowResult(true);
    await recordResult(false);
  }, [currentItem, recordResult, showResult]);

  const goToNext = useCallback(async () => {
    setAnswer('');
    setSelectedOption(null);
    setShowResult(false);
    setIsCorrect(false);
    setSpellingPassed(false);
    setQuestionStartTime(Date.now());
    setCompletedCount((count) => count + 1);

    if (currentIndex < items.length - 1) {
      setCurrentIndex(currentIndex + 1);
      return;
    }

    try {
      await fetchNextBatch();
    } catch (error) {
      console.error('获取下一批词组练习失败:', error);
    }
  }, [currentIndex, fetchNextBatch, items.length]);

  const switchMode = (nextMode: PracticeMode) => {
    setMode(nextMode);
    setAnswer('');
    setSelectedOption(null);
    setShowResult(false);
    setIsCorrect(false);
    setSpellingPassed(false);
    setQuestionStartTime(Date.now());
  };

  useEffect(() => {
    if (!showResult || !isCorrect || !autoAdvanceCorrect) return;
    const timer = window.setTimeout(() => {
      goToNext();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [autoAdvanceCorrect, goToNext, isCorrect, showResult]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;

      const target = event.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      if (event.key === 'Enter') {
        event.preventDefault();
        if (showResult) {
          if (spellingGateActive) return;
          goToNext();
        } else if (mode === 'fill') {
          submitFillAnswer();
        }
        return;
      }

      if (mode === 'choice' && !showResult && !isTyping) {
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
          selectOption(optionIndex);
        }
        return;
      }

      if (mode === 'fill' && !showResult && !isTyping && event.key.toLowerCase() === 'h') {
        event.preventDefault();
        revealAnswer();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNext, mode, revealAnswer, selectOption, showResult, spellingGateActive, submitFillAnswer]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl text-gray-500">加载中...</div>
      </div>
    );
  }

  if (!currentItem || items.length === 0 || finished) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl text-gray-500">当前没有可练习的词组</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <AutoAdvanceToggle />
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-bold text-gray-800">词组练习</h1>
        <div className="inline-flex rounded-lg bg-gray-100 p-1">
          <button
            onClick={() => switchMode('fill')}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              mode === 'fill' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            填空模式
          </button>
          <button
            onClick={() => switchMode('choice')}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              mode === 'choice' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            选择题模式
          </button>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>进度</span>
          <span>本次已练 {completedCount} 个，当前单元 {currentIndex + 1} / {items.length}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-primary-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / items.length) * 100}%` }}
          ></div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
        <div className="mb-6">
          <div className="text-sm text-gray-500 mb-2">固定搭配 / 词组挖空</div>
          <div className="text-3xl font-bold text-gray-800">{currentItem.blank_phrase}</div>
        </div>

        <div className="bg-blue-50 rounded-lg p-5 mb-6">
          <p className="text-lg text-gray-800 leading-relaxed">{currentItem.blank_sentence}</p>
          <p className="text-gray-500 mt-2">{currentItem.sentence_cn}</p>
        </div>

        <div className="mb-6">
          <div className="text-sm text-gray-500 mb-1">目标释义</div>
          <div className="text-gray-800">
            <span className="mr-2 text-gray-500">{currentItem.part_of_speech}</span>
            {currentItem.meaning_cn}
          </div>
        </div>

        {mode === 'fill' ? (
          <div className="space-y-4">
            <input
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              disabled={showResult}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-lg focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:bg-gray-50"
              placeholder="输入空缺的单词"
              autoFocus
            />

            {!showResult ? (
              <div className="flex gap-3">
                <button
                  onClick={submitFillAnswer}
                  className="flex-1 rounded-lg bg-primary-600 py-3 text-white transition-colors hover:bg-primary-700"
                >
                  <span className="mr-2 rounded bg-white/20 px-2 py-0.5 text-xs">Enter</span>
                  检查答案
                </button>
                <button
                  onClick={revealAnswer}
                  className="rounded-lg bg-gray-100 px-5 py-3 text-gray-700 transition-colors hover:bg-gray-200"
                >
                  <span className="mr-2 rounded bg-gray-200 px-2 py-0.5 text-xs">H</span>
                  看答案
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            {currentItem.options?.map((option, index) => {
              let bgColor = 'bg-white';
              let borderColor = 'border-gray-200';
              let textColor = 'text-gray-800';

              if (showResult) {
                if (option.is_correct) {
                  bgColor = 'bg-green-100';
                  borderColor = 'border-green-500';
                  textColor = 'text-green-800';
                } else if (index === selectedOption) {
                  bgColor = 'bg-red-100';
                  borderColor = 'border-red-500';
                  textColor = 'text-red-800';
                }
              }

              return (
                <button
                  key={`${option.text}-${index}`}
                  onClick={() => selectOption(index)}
                  disabled={showResult}
                  className={`w-full rounded-lg border-2 p-4 text-left transition-all ${bgColor} ${borderColor} ${textColor} ${
                    !showResult ? 'hover:border-primary-300 hover:bg-primary-50' : ''
                  }`}
                >
                  <span className="mr-2 inline-flex min-w-[3rem] justify-center rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                    {index + 1} / {String.fromCharCode(65 + index)}
                  </span>
                  {option.text}
                </button>
              );
            })}
          </div>
        )}

        {showResult ? (
          <div className="mt-6 space-y-4">
            <div className={`rounded-lg p-4 text-center ${isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {isCorrect ? '回答正确' : `正确答案：${currentItem.answer}`}
            </div>
            {spellingGateActive && (
              <SpellingGate targets={[currentItem.meaning_cn]} onPass={() => setSpellingPassed(true)} />
            )}
            <button
              onClick={goToNext}
              disabled={spellingGateActive}
              className="w-full rounded-lg bg-primary-600 py-3 text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              <span className="mr-2 rounded bg-white/20 px-2 py-0.5 text-xs">Enter</span>
              下一题
            </button>
          </div>
        ) : null}
      </div>

      <div className="text-center text-sm text-gray-500">
        {mode === 'fill' ? (
          <p>输入答案后按 Enter 检查；输入框外按 H 可看答案</p>
        ) : (
          <p>按 1-4 或 A-D 选择答案</p>
        )}
        <p className="mt-1">出结果后按 Enter 进入下一题；离开页面再回来会继续当前词组练习进度</p>
      </div>
    </div>
  );
};

export default PhraseStudy;
