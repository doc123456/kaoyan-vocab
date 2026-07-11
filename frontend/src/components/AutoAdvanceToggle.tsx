import React from 'react';
import { useAutoAdvance } from '../hooks/useAutoAdvance';

interface AutoAdvanceToggleProps {
  showSpellingGate?: boolean;
}

const AutoAdvanceToggle: React.FC<AutoAdvanceToggleProps> = ({ showSpellingGate = true }) => {
  const {
    autoAdvanceCorrect,
    spellingGateWrongAnswers,
    toggleAutoAdvance,
    toggleSpellingGate
  } = useAutoAdvance();

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={toggleAutoAdvance}
        className={`inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition-colors ${
          autoAdvanceCorrect
            ? 'bg-green-100 text-green-800 hover:bg-green-200'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        答对自动跳转：{autoAdvanceCorrect ? '开' : '关'}
      </button>
      {showSpellingGate && (
        <button
          type="button"
          onClick={toggleSpellingGate}
          className={`inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition-colors ${
            spellingGateWrongAnswers
              ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          错题拼写模式：{spellingGateWrongAnswers ? '开' : '关'}
        </button>
      )}
    </div>
  );
};

export default AutoAdvanceToggle;
