import { useCallback, useEffect, useState } from 'react';

const storageKey = 'autoAdvanceCorrectAnswers';
const spellingGateStorageKey = 'spellingGateWrongAnswers';
const settingsChangedEvent = 'studySettingsChanged';

function readAutoAdvance() {
  const saved = localStorage.getItem(storageKey);
  return saved === null ? true : saved === 'true';
}

function readSpellingGate() {
  return localStorage.getItem(spellingGateStorageKey) === 'true';
}

export function useAutoAdvance() {
  const [autoAdvanceCorrect, setAutoAdvanceCorrect] = useState(readAutoAdvance);
  const [spellingGateWrongAnswers, setSpellingGateWrongAnswers] = useState(readSpellingGate);

  useEffect(() => {
    const syncSettings = () => {
      setAutoAdvanceCorrect(readAutoAdvance());
      setSpellingGateWrongAnswers(readSpellingGate());
    };

    window.addEventListener(settingsChangedEvent, syncSettings);
    window.addEventListener('storage', syncSettings);
    return () => {
      window.removeEventListener(settingsChangedEvent, syncSettings);
      window.removeEventListener('storage', syncSettings);
    };
  }, []);

  const toggleAutoAdvance = useCallback(() => {
    const nextValue = !readAutoAdvance();
    localStorage.setItem(storageKey, String(nextValue));
    window.dispatchEvent(new Event(settingsChangedEvent));
  }, []);

  const toggleSpellingGate = useCallback(() => {
    const nextValue = !readSpellingGate();
    localStorage.setItem(spellingGateStorageKey, String(nextValue));
    window.dispatchEvent(new Event(settingsChangedEvent));
  }, []);

  return {
    autoAdvanceCorrect,
    spellingGateWrongAnswers,
    toggleAutoAdvance,
    toggleSpellingGate
  };
}
