export interface Example {
  id: number;
  meaning_id: number;
  sentence_en: string;
  sentence_cn: string;
  blank_sentence?: string;
  original_word?: string;
}

export interface Meaning {
  id: number;
  word_id: number;
  meaning_index: number;
  part_of_speech: string;
  meaning_cn: string;
  examples: Example[];
}

export interface Word {
  id: number;
  word: string;
  phonetic_uk: string;
  phonetic_us: string;
  meanings: Meaning[];
}

export interface UserProgress {
  id: number;
  meaning_id: number;
  mastery_level: number;
  correct_count: number;
  incorrect_count: number;
  correct_streak?: number;
  review_graduated?: number;
  avg_response_time: number;
  last_reviewed_at: string;
  next_review_at: string;
  part_of_speech: string;
  meaning_cn: string;
  word: string;
  examples: Example[];
}

export interface StudyMeaning {
  meaning_id: number;
  part_of_speech: string;
  meaning_cn: string;
  word_id: number;
  word: string;
  phonetic_uk: string;
  phonetic_us: string;
  mastery_level: number;
  correct_count: number;
  incorrect_count: number;
  examples: Example[];
  options?: Option[];
}

export interface Option {
  meaning_id?: number;
  text: string;
  meaning_text?: string;
  is_correct: boolean;
}

export interface TraditionalWordQuestion {
  word_id: number;
  word: string;
  phonetic_uk: string;
  phonetic_us: string;
  question_mode?: 'en-to-cn' | 'cn-to-en';
  difficulty?: 'normal' | 'hard-shape';
  prompt_text?: string;
  prompt_hint?: string;
  meaning_cn?: string;
  part_of_speech?: string;
  meaning_ids: number[];
  options: Option[];
}

export interface PhraseExercise {
  meaning_id: number;
  word_id: number;
  word: string;
  phonetic_uk: string;
  phonetic_us: string;
  part_of_speech: string;
  meaning_cn: string;
  sentence_en: string;
  sentence_cn: string;
  phrase: string;
  blank_phrase: string;
  blank_sentence: string;
  answer: string;
  options?: Option[];
}

export interface Stats {
  totalWords: number;
  totalMeanings: number;
  learnedMeanings: number;
  masteredMeanings: number;
  reviewDueCount: number;
  mistakeBookCount: number;
  todayLearned: number;
  totalStudyTime: number;
  todayStudyTime: number;
  studyDays: number;
  avgDailyStudyTime: number;
  estimatedDays: number | null;
  progressPercentage: number;
  masteryDistribution: { mastery_level: number; label: string; count: number }[];
  recentStudyData: {
    date: string;
    wordCount: number;
    meaningCount: number;
    studyTime: number;
  }[];
  reviewForecast: {
    minutesFromNow?: number;
    hoursFromNow: number;
    label: string;
    time: string;
    dueCount: number;
  }[];
  nextReviewAt?: string | null;
  recentTestAverage: number;
  learningSummary: string;
}

export interface StatsItem {
  meaning_id: number;
  word: string;
  part_of_speech: string;
  meaning_cn: string;
  mastery_level: number;
  next_review_at?: string;
}

export interface TestSession {
  id: number;
  total_count: number;
  correct_count: number;
  score: number;
  duration: number;
  created_at: string;
}
