import React, { useState } from 'react';
import { isMeaningMatch } from '../utils/meaningMatch';

interface SpellingGateProps {
  targets: string[];
  onPass: () => void;
}

const SpellingGate: React.FC<SpellingGateProps> = ({ targets, onPass }) => {
  const [value, setValue] = useState('');
  const [message, setMessage] = useState('');

  const checkAnswer = () => {
    if (isMeaningMatch(value, targets)) {
      setMessage('通过，可以进入下一题');
      onPass();
      return;
    }

    setMessage('还没有匹配到中文释义，可以只写一个核心意思，例如“安装”。');
  };

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="mb-2 text-sm font-medium text-amber-800">错题拼写模式</div>
      <div className="mb-3 text-sm text-amber-700">
        本题答错后，需要输入这个单词的一个中文核心释义才能继续。
      </div>
      <div className="flex flex-col gap-2 md:flex-row">
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              checkAnswer();
            }
          }}
          className="flex-1 rounded-lg border border-amber-300 px-3 py-2 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100"
          placeholder="输入中文释义"
          autoFocus
        />
        <button
          type="button"
          onClick={checkAnswer}
          className="rounded-lg bg-amber-600 px-4 py-2 text-white hover:bg-amber-700"
        >
          检查
        </button>
      </div>
      {message && <div className="mt-2 text-sm text-amber-700">{message}</div>}
    </div>
  );
};

export default SpellingGate;
