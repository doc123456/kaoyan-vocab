import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AutoAdvanceToggle from '../components/AutoAdvanceToggle';
import SpellingGate from '../components/SpellingGate';
import { useAutoAdvance } from '../hooks/useAutoAdvance';
import { useStudyActivityTimer } from '../hooks/useStudyActivityTimer';
import { TraditionalWordQuestion } from '../types';
import { getTraditionalStudyData, updateProgress } from '../utils/api';
import { extractMeaningText } from '../utils/meaningMatch';

type TranslationMode = 'en-to-cn' | 'cn-to-en' | 'mixed';

const arraysEqual = (a: number[], b: number[]) => {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort((x, y) => x - y);
  const sortedB = [...b].sort((x, y) => x - y);
  return sortedA.every((value, index) => value === sortedB[index]);
};

const translationModeLabels: Record<TranslationMode, string> = {
  'en-to-cn': '英译中',
  'cn-to-en': '中译英',
  mixed: '混合'
};

const TraditionalStudy: React.FC = () => {
  const storageKey = 'traditionalStudySession:v3';
  const batchSize = 20;
  const [searchParams] = useSearchParams();
  const reviewOnly = searchParams.get('review') === '1';
  const initialMistakesOnly = searchParams.get('mistakes') === '1';

  const [translationMode, setTranslationMode] = useState<TranslationMode>(() => {
    const saved = localStorage.getItem('traditionalTranslationMode');
    return saved === 'cn-to-en' || saved === 'mixed' ? saved : 'en-to-cn';
  });
  const [hardMode, setHardMode] = useState(() => localStorage.getItem('traditionalHardMode') === 'true');
  const [studyItems, setStudyItems] = useState<TraditionalWordQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<number[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [loading, setLoading] = useState(true);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [completedCount, setCompletedCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [mistakesOnly, setMistakesOnly] = useState(initialMistakesOnly);
  const [spellingPassed, setSpellingPassed] = useState(false);
  const { autoAdvanceCorrect, spellingGateWrongAnswers } = useAutoAdvance();

  useStudyActivityTimer(!loading && !finished && studyItems.length > 0);

  const currentItem = studyItems[currentIndex];
  const effectiveQuestionMode = currentItem?.question_mode || 'en-to-cn';
  const spellingGateActive = spellingGateWrongAnswers && showResult && !isCorrect && !spellingPassed;
  const spellingTargets = effectiveQuestionMode === 'cn-to-en'
    ? [currentItem?.meaning_cn || currentItem?.prompt_text || '']
    : currentItem?.options
      .filter(option => option.is_correct)
      .map(option => extractMeaningText(option.text)) || [];

  const getStorageKey = useCallback((modeMistakesOnly: boolean, mode = translationMode, hard = hardMode) =>
    `${storageKey}:${reviewOnly ? 'review' : modeMistakesOnly ? 'mistakes' : 'normal'}:${mode}:${hard ? 'hard' : 'normal'}`,
  [hardMode, reviewOnly, translationMode]);

  const resetQuestionState = () => {
    setCurrentIndex(0);
    setSelectedOptions([]);
    setShowResult(false);
    setIsCorrect(false);
    setSpellingPassed(false);
    setQuestionStartTime(Date.now());
  };

  const fetchStudyData = useCallback(async (nextMistakesOnly: boolean, mode = translationMode, hard = hardMode) => {
    try {
      const response = await getTraditionalStudyData(batchSize, nextMistakesOnly, reviewOnly, mode, hard);
      setStudyItems(response.data);
      resetQuestionState();
      setFinished(response.data.length === 0);
    } catch (error) {
      console.error('获取记背数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, [hardMode, reviewOnly, translationMode]);

  const saveSession = useCallback((modeMistakesOnly = mistakesOnly, mode = translationMode, hard = hardMode) => {
    if (loading || finished || studyItems.length === 0) return;
    sessionStorage.setItem(getStorageKey(modeMistakesOnly, mode, hard), JSON.stringify({
      studyItems,
      currentIndex,
      selectedOptions,
      showResult,
      isCorrect,
      spellingPassed,
      completedCount,
      mistakesOnly: modeMistakesOnly,
      translationMode: mode,
      hardMode: hard
    }));
  }, [completedCount, currentIndex, finished, getStorageKey, hardMode, isCorrect, loading, mistakesOnly, selectedOptions, showResult, spellingPassed, studyItems, translationMode]);

  const restoreSession = useCallback((modeMistakesOnly: boolean, mode: TranslationMode, hard = hardMode) => {
    const savedSession = sessionStorage.getItem(getStorageKey(modeMistakesOnly, mode, hard));
    if (!savedSession) return false;

    try {
      const session = JSON.parse(savedSession);
      if (!Array.isArray(session.studyItems) || session.studyItems.length === 0) return false;
      setStudyItems(session.studyItems);
      setCurrentIndex(session.currentIndex || 0);
      setSelectedOptions(session.selectedOptions || []);
      setShowResult(Boolean(session.showResult));
      setIsCorrect(Boolean(session.isCorrect));
      setSpellingPassed(Boolean(session.spellingPassed));
      setCompletedCount(session.completedCount || 0);
      setMistakesOnly(Boolean(session.mistakesOnly));
      setQuestionStartTime(Date.now());
      setFinished(false);
      setLoading(false);
      return true;
    } catch (error) {
      sessionStorage.removeItem(getStorageKey(modeMistakesOnly, mode, hard));
      return false;
    }
  }, [getStorageKey, hardMode]);

  const fetchNextBatch = useCallback(async () => {
    const response = await getTraditionalStudyData(batchSize, mistakesOnly, reviewOnly, translationMode, hardMode);
    setStudyItems(response.data);
    resetQuestionState();
    setFinished(response.data.length === 0);
    if (response.data.length === 0) {
      sessionStorage.removeItem(getStorageKey(mistakesOnly, translationMode, hardMode));
    }
  }, [getStorageKey, hardMode, mistakesOnly, reviewOnly, translationMode]);

  useEffect(() => {
    if (restoreSession(initialMistakesOnly, translationMode, hardMode)) return;
    fetchStudyData(initialMistakesOnly, translationMode, hardMode);
  }, [fetchStudyData, hardMode, initialMistakesOnly, restoreSession, translationMode]);

  useEffect(() => {
    saveSession();
  }, [saveSession]);

  const switchMistakeMode = (nextMistakesOnly: boolean) => {
    if (reviewOnly || nextMistakesOnly === mistakesOnly) return;
    saveSession();
    setMistakesOnly(nextMistakesOnly);
    if (restoreSession(nextMistakesOnly, translationMode, hardMode)) return;
    setStudyItems([]);
    setCompletedCount(0);
    setLoading(true);
    fetchStudyData(nextMistakesOnly, translationMode, hardMode);
  };

  const switchTranslationMode = (nextMode: TranslationMode) => {
    if (nextMode === translationMode) return;
    saveSession();
    localStorage.setItem('traditionalTranslationMode', nextMode);
    setTranslationMode(nextMode);
    if (restoreSession(mistakesOnly, nextMode, hardMode)) return;
    setStudyItems([]);
    setCompletedCount(0);
    setLoading(true);
    fetchStudyData(mistakesOnly, nextMode, hardMode);
  };

  const switchHardMode = (nextHardMode: boolean) => {
    if (nextHardMode === hardMode) return;
    saveSession();
    localStorage.setItem('traditionalHardMode', String(nextHardMode));
    setHardMode(nextHardMode);
    if (restoreSession(mistakesOnly, translationMode, nextHardMode)) return;
    setStudyItems([]);
    setCompletedCount(0);
    setLoading(true);
    fetchStudyData(mistakesOnly, translationMode, nextHardMode);
  };

  const toggleOption = useCallback((optionIndex: number) => {
    if (showResult || !currentItem?.options?.[optionIndex]) return;
    setSelectedOptions((selected) =>
      selected.includes(optionIndex)
        ? selected.filter((index) => index !== optionIndex)
        : [...selected, optionIndex]
    );
  }, [currentItem, showResult]);

  const submitAnswer = useCallback(async () => {
    if (!currentItem || showResult) return;

    const correctIndexes = currentItem.options
      .map((option, index) => option.is_correct ? index : -1)
      .filter(index => index >= 0);
    const correct = arraysEqual(selectedOptions, correctIndexes);
    const responseTime = Date.now() - questionStartTime;

    setIsCorrect(correct);
    setSpellingPassed(false);
    setShowResult(true);

    try {
      await Promise.all(
        currentItem.options
          .filter(option => option.is_correct && option.meaning_id)
          .map(option => updateProgress(option.meaning_id as number, {
            is_correct: correct,
            response_time: responseTime,
            study_mode: reviewOnly ? 'review-choice' : `traditional-${effectiveQuestionMode}`
          }))
      );
    } catch (error) {
      console.error('更新进度失败:', error);
    }
  }, [currentItem, effectiveQuestionMode, questionStartTime, reviewOnly, selectedOptions, showResult]);

  const goToNext = useCallback(async () => {
    setSelectedOptions([]);
    setShowResult(false);
    setIsCorrect(false);
    setSpellingPassed(false);
    setQuestionStartTime(Date.now());
    setCompletedCount((count) => count + 1);

    if (currentIndex < studyItems.length - 1) {
      setCurrentIndex(currentIndex + 1);
      return;
    }

    try {
      await fetchNextBatch();
    } catch (error) {
      console.error('获取下一批记背数据失败:', error);
    }
  }, [currentIndex, fetchNextBatch, studyItems.length]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;

      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (showResult && (event.key === ' ' || event.key === 'Enter')) {
        if (spellingGateActive) return;
        event.preventDefault();
        goToNext();
        return;
      }

      if (!showResult && event.key === 'Enter') {
        event.preventDefault();
        submitAnswer();
        return;
      }

      if (!showResult) {
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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNext, showResult, spellingGateActive, submitAnswer, toggleOption]);

  useEffect(() => {
    if (!showResult || !isCorrect || !autoAdvanceCorrect) return;
    const timer = window.setTimeout(() => {
      goToNext();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [autoAdvanceCorrect, goToNext, isCorrect, showResult]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-xl text-gray-500">加载中...</div>
      </div>
    );
  }

  if (!currentItem || studyItems.length === 0 || finished) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-xl text-gray-500">
          {reviewOnly ? '当前没有到期的复习单元' : mistakesOnly ? '当前错题本为空' : '当前没有需要学习或复习的单词'}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <AutoAdvanceToggle />
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-bold text-gray-800">{reviewOnly ? '待复习专练' : '记背模式'}</h1>
        <div className="flex flex-wrap gap-3">
          <div className="inline-flex rounded-lg bg-gray-100 p-1">
            {(Object.keys(translationModeLabels) as TranslationMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => switchTranslationMode(mode)}
                className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  translationMode === mode ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {translationModeLabels[mode]}
              </button>
            ))}
          </div>
          {translationMode !== 'en-to-cn' && (
            <div className="inline-flex rounded-lg bg-gray-100 p-1">
              <button
                onClick={() => switchHardMode(false)}
                className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  !hardMode ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                普通难度
              </button>
              <button
                onClick={() => switchHardMode(true)}
                className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  hardMode ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                高难度
              </button>
            </div>
          )}
          {!reviewOnly && (
            <div className="inline-flex rounded-lg bg-gray-100 p-1">
              <button
                onClick={() => switchMistakeMode(false)}
                className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  !mistakesOnly ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                普通练习
              </button>
              <button
                onClick={() => switchMistakeMode(true)}
                className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  mistakesOnly ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                错题专练
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mb-6">
        <div className="mb-1 flex justify-between text-sm text-gray-600">
          <span>进度</span>
          <span>本次已学 {completedCount} 个，当前单元 {currentIndex + 1} / {studyItems.length}</span>
        </div>
        <div className="h-2 w-full rounded-full bg-gray-200">
          <div
            className="h-2 rounded-full bg-primary-600 transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / studyItems.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="mb-6 rounded-lg bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <div className="mb-2 text-sm font-medium text-gray-500">
            {effectiveQuestionMode === 'cn-to-en' ? '中译英' : '英译中'}
          </div>
          {effectiveQuestionMode === 'cn-to-en' ? (
            <>
              <h2 className="text-3xl font-bold text-gray-800">{currentItem.prompt_text || currentItem.meaning_cn}</h2>
              <p className="mt-2 text-gray-500">{currentItem.prompt_hint || '选择这个中文释义对应的英文单词'}</p>
            </>
          ) : (
            <>
              <h2 className="mb-2 text-4xl font-bold text-gray-800">{currentItem.word}</h2>
              <div className="text-gray-500">
                {currentItem.phonetic_uk && <span className="mr-4">英 {currentItem.phonetic_uk}</span>}
                {currentItem.phonetic_us && <span>美 {currentItem.phonetic_us}</span>}
              </div>
              <p className="mt-3 text-sm text-gray-500">{currentItem.prompt_hint || '选择这个英文单词可能对应的所有中文释义'}</p>
            </>
          )}
        </div>

        <div className="space-y-3">
          {currentItem.options.map((option, index) => {
            const selected = selectedOptions.includes(index);
            let bgColor = selected ? 'bg-primary-100' : 'bg-white';
            let borderColor = selected ? 'border-primary-500' : 'border-gray-200';
            let textColor = selected ? 'text-primary-900' : 'text-gray-800';

            if (showResult) {
              if (option.is_correct) {
                bgColor = 'bg-green-100';
                borderColor = 'border-green-500';
                textColor = 'text-green-800';
              } else if (selected) {
                bgColor = 'bg-red-100';
                borderColor = 'border-red-500';
                textColor = 'text-red-800';
              }
            }

            return (
              <button
                key={`${option.text}-${index}`}
                onClick={() => toggleOption(index)}
                disabled={showResult}
                className={`w-full rounded-lg border-2 p-4 text-left transition-all ${bgColor} ${borderColor} ${textColor} ${
                  !showResult ? 'hover:border-primary-300 hover:bg-primary-50' : ''
                }`}
              >
                <span className="mr-2 inline-flex min-w-[3rem] justify-center rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                  {index + 1} / {String.fromCharCode(65 + index)}
                </span>
                <span>{option.text}</span>
                {effectiveQuestionMode === 'cn-to-en' && showResult && !isCorrect && option.meaning_text && (
                  <span className="ml-3 text-sm text-gray-500">
                    {option.meaning_text}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {!showResult ? (
          <button
            onClick={submitAnswer}
            className="mt-6 w-full rounded-lg bg-primary-600 py-3 text-white transition-colors hover:bg-primary-700"
          >
            <span className="mr-2 rounded bg-white/20 px-2 py-0.5 text-xs">Enter</span>
            提交答案
          </button>
        ) : (
          <div className="mt-6 space-y-4">
            <div className={`rounded-lg p-4 text-center ${isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {isCorrect ? '回答正确' : '回答不完整或包含错误选项'}
            </div>
            {spellingGateActive && (
              <SpellingGate targets={spellingTargets} onPass={() => setSpellingPassed(true)} />
            )}
            <button
              onClick={goToNext}
              disabled={spellingGateActive}
              className="w-full rounded-lg bg-primary-600 py-3 text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              <span className="mr-2 rounded bg-white/20 px-2 py-0.5 text-xs">Space / Enter</span>
              下一题
            </button>
          </div>
        )}
      </div>

      <div className="text-center text-sm text-gray-500">
        <p>按 1-4 或 A-D 切换选项，按 Enter 提交；出结果后按 Space 或 Enter 进入下一题</p>
        <p className="mt-1">英译中可能是不定项选择；中译英通常只有一个正确英文单词</p>
      </div>
    </div>
  );
};

export default TraditionalStudy;
