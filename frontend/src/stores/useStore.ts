import { create } from 'zustand';
import { Stats, StudyMeaning } from '../types';

interface StoreState {
  // 统计数据
  stats: Stats | null;
  setStats: (stats: Stats) => void;
  
  // 学习数据
  currentStudyItems: StudyMeaning[];
  setCurrentStudyItems: (items: StudyMeaning[]) => void;
  
  // 当前学习索引
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
  
  // 学习模式
  studyMode: 'traditional' | 'sentence' | 'fill-blank';
  setStudyMode: (mode: 'traditional' | 'sentence' | 'fill-blank') => void;
  
  // 学习时间追踪
  studyStartTime: number | null;
  setStudyStartTime: (time: number | null) => void;
  
  // 重置学习状态
  resetStudyState: () => void;
}

const useStore = create<StoreState>((set) => ({
  stats: null,
  setStats: (stats) => set({ stats }),
  
  currentStudyItems: [],
  setCurrentStudyItems: (items) => set({ currentStudyItems: items }),
  
  currentIndex: 0,
  setCurrentIndex: (index) => set({ currentIndex: index }),
  
  studyMode: 'traditional',
  setStudyMode: (mode) => set({ studyMode: mode }),
  
  studyStartTime: null,
  setStudyStartTime: (time) => set({ studyStartTime: time }),
  
  resetStudyState: () => set({
    currentStudyItems: [],
    currentIndex: 0,
    studyStartTime: null,
  }),
}));

export default useStore;