import React, { useCallback, useEffect, useState } from 'react';
import { getSentenceStudyData, updateProgress } from '../utils/api';
import { StudyMeaning } from '../types';
import { useStudyActivityTimer } from '../hooks/useStudyActivityTimer';
import { useAutoAdvance } from '../hooks/useAutoAdvance';
import AutoAdvanceToggle from '../components/AutoAdvanceToggle';
import SpellingGate from '../components/SpellingGate';

const SentenceStudy: React.FC = () => {
  const storageKey = 'sentenceStudySession';
  const batchSize = 20;

  const [studyItems, setStudyItems] = useState<StudyMeaning[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  const [completedCount, setCompletedCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [mistakesOnly, setMistakesOnly] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [spellingPassed, setSpellingPassed] = useState(false);
  const { autoAdvanceCorrect, spellingGateWrongAnswers } = useAutoAdvance();

  useStudyActivityTimer(!loading && !finished && studyItems.length > 0);
  const currentItem = studyItems[currentIndex];
  const spellingGateActive = spellingGateWrongAnswers && showResult && !isCorrect && !spellingPassed;

  const getStorageKey = (modeMistakesOnly: boolean) =>
    `${storageKey}:${modeMistakesOnly ? 'mistakes' : 'normal'}`;

  const saveSession = (modeMistakesOnly = mistakesOnly) => {
    if (loading || finished || studyItems.length === 0) return;
    sessionStorage.setItem(getStorageKey(modeMistakesOnly), JSON.stringify({
      studyItems,
      currentIndex,
      selectedOption,
      showResult,
      isCorrect,
      spellingPassed,
      completedCount,
      mistakesOnly: modeMistakesOnly
    }));
  };

  const fetchStudyData = useCallback(async (nextMistakesOnly: boolean) => {
    try {
      const response = await getSentenceStudyData(batchSize, nextMistakesOnly);
      setStudyItems(response.data);
      setCurrentIndex(0);
      setSelectedOption(null);
      setShowResult(false);
      setIsCorrect(false);
      setSpellingPassed(false);
      setQuestionStartTime(Date.now());
      setFinished(response.data.length === 0);
    } catch (error) {
      console.error('获取学习数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchNextBatch = useCallback(async () => {
    const response = await getSentenceStudyData(batchSize, mistakesOnly);
    setStudyItems(response.data);
    setCurrentIndex(0);
    setSelectedOption(null);
    setShowResult(false);
    setIsCorrect(false);
    setSpellingPassed(false);
    setQuestionStartTime(Date.now());
    setFinished(response.data.length === 0);
    if (response.data.length === 0) {
      sessionStorage.removeItem(storageKey);
    }
  }, [mistakesOnly, storageKey]);

  useEffect(() => {
    const savedSession = sessionStorage.getItem(getStorageKey(false));
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        if (Array.isArray(session.studyItems) && session.studyItems.length > 0) {
          setStudyItems(session.studyItems);
          setCurrentIndex(session.currentIndex || 0);
          setSelectedOption(session.selectedOption ?? null);
          setShowResult(Boolean(session.showResult));
          setIsCorrect(Boolean(session.isCorrect));
          setSpellingPassed(Boolean(session.spellingPassed));
          setCompletedCount(session.completedCount || 0);
          setMistakesOnly(Boolean(session.mistakesOnly));
          setQuestionStartTime(Date.now());
          setFinished(false);
          setLoading(false);
          return;
        }
      } catch (error) {
        sessionStorage.removeItem(getStorageKey(false));
      }
    }

    fetchStudyData(false);
  }, [fetchStudyData]);

  useEffect(() => {
    if (loading || finished || studyItems.length === 0) return;
    saveSession();
  }, [completedCount, currentIndex, finished, isCorrect, loading, mistakesOnly, selectedOption, showResult, spellingPassed, studyItems]);

  const switchMistakeMode = (nextMistakesOnly: boolean) => {
    if (nextMistakesOnly === mistakesOnly) return;
    saveSession();
    setMistakesOnly(nextMistakesOnly);
    const savedSession = sessionStorage.getItem(getStorageKey(nextMistakesOnly));
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        if (Array.isArray(session.studyItems) && session.studyItems.length > 0) {
          setStudyItems(session.studyItems);
          setCurrentIndex(session.currentIndex || 0);
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
        sessionStorage.removeItem(getStorageKey(nextMistakesOnly));
      }
    }
    setStudyItems([]);
    setCurrentIndex(0);
    setSelectedOption(null);
    setShowResult(false);
    setIsCorrect(false);
    setSpellingPassed(false);
    setCompletedCount(0);
    setLoading(true);
    fetchStudyData(nextMistakesOnly);
  };

  const handleOptionSelect = useCallback(async (optionIndex: number) => {
    if (showResult) return;

    setSelectedOption(optionIndex);
    setShowResult(true);

    const responseTime = Date.now() - questionStartTime;
    const currentItem = studyItems[currentIndex];
    const isCorrect = currentItem.options && currentItem.options[optionIndex].is_correct;
    setIsCorrect(Boolean(isCorrect));
    setSpellingPassed(false);

    try {
      await updateProgress(currentItem.meaning_id, {
        is_correct: isCorrect || false,
        response_time: responseTime,
        study_mode: 'sentence'
      });
    } catch (error) {
      console.error('更新进度失败:', error);
    }
  }, [currentIndex, questionStartTime, showResult, studyItems]);

  const handleNext = useCallback(async () => {
    setSelectedOption(null);
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
      console.error('获取下一批学习数据失败:', error);
    }
  }, [currentIndex, fetchNextBatch, studyItems.length]);

  useEffect(() => {
    if (!showResult || !isCorrect || !autoAdvanceCorrect) return;
    const timer = window.setTimeout(() => {
      handleNext();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [autoAdvanceCorrect, handleNext, isCorrect, showResult]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;

      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (showResult && (event.key === ' ' || event.key === 'Enter')) {
        if (spellingGateActive) return;
        event.preventDefault();
        handleNext();
        return;
      }

      if (showResult) return;

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
      if (optionIndex !== undefined && studyItems[currentIndex]?.options?.[optionIndex]) {
        event.preventDefault();
        handleOptionSelect(optionIndex);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, handleNext, handleOptionSelect, showResult, spellingGateActive, studyItems]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl text-gray-500">加载中...</div>
      </div>
    );
  }

  if (studyItems.length === 0 || finished) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl text-gray-500">
          {mistakesOnly ? '当前错题本为空' : '当前没有需要学习或复习的单词'}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <AutoAdvanceToggle />
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-bold text-gray-800">例句模式</h1>
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
      </div>

      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>进度</span>
          <span>本次已学 {completedCount} 个，当前单元 {currentIndex + 1} / {studyItems.length}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-primary-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / studyItems.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">选择正确的释义</h2>
          <p className="text-gray-500">根据例句选择单词的正确意思</p>
        </div>

        {currentItem.examples && currentItem.examples.length > 0 && (
          <div className="bg-blue-50 rounded-lg p-6 mb-6">
            <p className="text-lg text-gray-800 leading-relaxed">
              {currentItem.examples[0].sentence_en}
            </p>
            <p className="text-gray-500 mt-2">
              {currentItem.examples[0].sentence_cn}
            </p>
          </div>
        )}

        <div className="text-center mb-6">
          <span className="text-sm text-gray-500">目标单词：</span>
          <span className="text-xl font-bold text-primary-600">{currentItem.word}</span>
          {currentItem.phonetic_uk && (
            <span className="text-gray-400 ml-2">{currentItem.phonetic_uk}</span>
          )}
        </div>

        <div className="space-y-3">
          {currentItem.options && currentItem.options.map((option, index) => {
            let bgColor = 'bg-white';
            let borderColor = 'border-gray-200';
            let textColor = 'text-gray-800';

            if (showResult) {
              if (option.is_correct) {
                bgColor = 'bg-green-100';
                borderColor = 'border-green-500';
                textColor = 'text-green-800';
              } else if (index === selectedOption && !option.is_correct) {
                bgColor = 'bg-red-100';
                borderColor = 'border-red-500';
                textColor = 'text-red-800';
              }
            } else if (index === selectedOption) {
              bgColor = 'bg-primary-100';
              borderColor = 'border-primary-500';
              textColor = 'text-primary-800';
            }

            return (
              <button
                key={index}
                onClick={() => handleOptionSelect(index)}
                disabled={showResult}
                className={`w-full p-4 rounded-lg border-2 text-left transition-all ${bgColor} ${borderColor} ${textColor} ${
                  !showResult ? 'hover:border-primary-300 hover:bg-primary-50 cursor-pointer' : 'cursor-default'
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

        {showResult && (
          <div className="mt-6">
            <div className={`text-center p-4 rounded-lg mb-4 ${
              selectedOption !== null && currentItem.options && currentItem.options[selectedOption].is_correct
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}>
              {selectedOption !== null && currentItem.options && currentItem.options[selectedOption].is_correct
                ? '回答正确'
                : '回答错误'
              }
            </div>

            {spellingGateActive && (
              <SpellingGate targets={[currentItem.meaning_cn]} onPass={() => setSpellingPassed(true)} />
            )}

            <button
              onClick={handleNext}
              disabled={spellingGateActive}
              className="w-full py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              <span className="mr-2 rounded bg-white/20 px-2 py-0.5 text-xs">Space / Enter</span>
              下一题
            </button>
          </div>
        )}
      </div>

      <div className="text-center text-sm text-gray-500">
        <p>按 1-4 或 A-D 选择答案，出结果后按 Space 或 Enter 进入下一题</p>
        <p className="mt-1">离开页面再回来会继续当前学习进度</p>
      </div>
    </div>
  );
};

export default SentenceStudy;
