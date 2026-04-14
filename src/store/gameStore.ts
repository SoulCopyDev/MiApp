import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ---------- Tipos ----------
export type LevelStatus = 'locked' | 'current' | 'completed';

export interface LevelProgress {
  id: number;
  name: string;
  icon: string;
  status: LevelStatus;
  stars: number;
}

export interface Badge {
  id: number;
  name: string;
  icon: string;
  unlocked: boolean;
  color: string;
  bgColor: string;
}

export interface UserProfile {
  name: string;
  avatar: 'robot' | 'kid' | 'pet';
  soundEnabled: boolean;
}

export interface GameState {
  profile: UserProfile;
  level: number;
  currentXP: number;
  maxXP: number;
  streak: number;
  totalStars: number;
  levels: LevelProgress[];
  badges: Badge[];
  devMode: boolean;

  setProfile: (profile: Partial<UserProfile>) => void;
  completeLevel: (levelId: number, starsEarned: number, xpEarned: number) => void;
  unlockBadge: (badgeId: number) => void;
  addXP: (amount: number) => void;
  resetProgress: () => void;
  calculateMaxXP: (level: number) => number;
  setDevMode: (enabled: boolean) => void;
  updateLevelName: (levelId: number, newName: string) => void; // ✅ NUEVA
}

// ---------- Datos iniciales ----------
const INITIAL_LEVELS: LevelProgress[] = [
  { id: 1, name: 'Logic Basics', icon: 'shield', status: 'completed', stars: 3 },
  { id: 2, name: 'AI Chatting', icon: 'chat', status: 'completed', stars: 2 },
  { id: 3, name: 'Neural Networks', icon: 'psychology', status: 'current', stars: 0 },
  { id: 4, name: 'Data Sorting', icon: 'storage', status: 'locked', stars: 0 },
  { id: 5, name: 'Final Boss', icon: 'sports-esports', status: 'locked', stars: 0 },
  { id: 6, name: 'Computer Vision', icon: 'image', status: 'locked', stars: 0 },
  { id: 7, name: 'NLP Basics', icon: 'record-voice-over', status: 'locked', stars: 0 },
  { id: 8, name: 'Ethics in AI', icon: 'gavel', status: 'locked', stars: 0 },
  { id: 9, name: 'Robotics', icon: 'smart-toy', status: 'locked', stars: 0 },
  { id: 10, name: 'Big Data', icon: 'analytics', status: 'locked', stars: 0 },
  { id: 11, name: 'Cloud AI', icon: 'cloud', status: 'locked', stars: 0 },
  { id: 12, name: 'Edge Computing', icon: 'devices', status: 'locked', stars: 0 },
  { id: 13, name: 'AI Art', icon: 'palette', status: 'locked', stars: 0 },
  { id: 14, name: 'Reinforcement Learning', icon: 'trending-up', status: 'locked', stars: 0 },
  { id: 15, name: 'Master Challenge', icon: 'workspace-premium', status: 'locked', stars: 0 },
];

const INITIAL_BADGES: Badge[] = [
  { id: 1, name: 'Safe Surfer', icon: 'shield', unlocked: true, color: '#005ca8', bgColor: '#eef3ff' },
  { id: 2, name: 'Chat Master', icon: 'forum', unlocked: true, color: '#8126cf', bgColor: '#f3e8ff' },
  { id: 3, name: 'Robot Friend', icon: 'smart-toy', unlocked: true, color: '#16a34a', bgColor: '#dcfce7' },
  { id: 4, name: 'Pattern Picker', icon: 'psychology', unlocked: false, color: '#747779', bgColor: '#e5e9eb' },
  { id: 5, name: 'AI Detective', icon: 'manage-search', unlocked: false, color: '#747779', bgColor: '#e5e9eb' },
  { id: 6, name: 'Computer Vision', icon: 'image', unlocked: false, color: '#747779', bgColor: '#e5e9eb' },
  { id: 7, name: 'NLP Basics', icon: 'record-voice-over', unlocked: false, color: '#747779', bgColor: '#e5e9eb' },
  { id: 8, name: 'Ethics in AI', icon: 'gavel', unlocked: false, color: '#747779', bgColor: '#e5e9eb' },
  { id: 9, name: 'Robotics', icon: 'smart-toy', unlocked: false, color: '#747779', bgColor: '#e5e9eb' },
  { id: 10, name: 'Big Data', icon: 'analytics', unlocked: false, color: '#747779', bgColor: '#e5e9eb' },
  { id: 11, name: 'Cloud AI', icon: 'cloud', unlocked: false, color: '#747779', bgColor: '#e5e9eb' },
  { id: 12, name: 'Edge Computing', icon: 'devices', unlocked: false, color: '#747779', bgColor: '#e5e9eb' },
  { id: 13, name: 'AI Art', icon: 'palette', unlocked: false, color: '#747779', bgColor: '#e5e9eb' },
  { id: 14, name: 'Reinforcement Learning', icon: 'trending-up', unlocked: false, color: '#747779', bgColor: '#e5e9eb' },
  { id: 15, name: 'Master Challenge', icon: 'workspace-premium', unlocked: false, color: '#747779', bgColor: '#e5e9eb' },
];

const DEFAULT_PROFILE: UserProfile = {
  name: 'AI Explorer',
  avatar: 'robot',
  soundEnabled: true,
};

const calculateMaxXP = (level: number): number => {
  return Math.floor(1000 + (level - 1) * 500);
};

// ---------- Store ----------
export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      profile: DEFAULT_PROFILE,
      level: 3,
      currentXP: 750,
      maxXP: calculateMaxXP(3),
      streak: 5,
      totalStars: 5,
      levels: INITIAL_LEVELS,
      badges: INITIAL_BADGES,
      devMode: false,

      setProfile: (newProfile) => set((state) => ({
        profile: { ...state.profile, ...newProfile }
      })),

      completeLevel: (levelId, starsEarned, xpEarned) => {
        const state = get();
        const levelIndex = state.levels.findIndex(l => l.id === levelId);
        if (levelIndex === -1) return;

        const updatedLevels = [...state.levels];
        updatedLevels[levelIndex] = {
          ...updatedLevels[levelIndex],
          status: 'completed',
          stars: Math.max(updatedLevels[levelIndex].stars, starsEarned),
        };

        const nextLevelIndex = levelIndex + 1;
        if (nextLevelIndex < updatedLevels.length && updatedLevels[nextLevelIndex].status === 'locked') {
          updatedLevels[nextLevelIndex].status = 'current';
        }

        const newTotalStars = state.totalStars + starsEarned - (state.levels[levelIndex].stars || 0);
        const newXP = state.currentXP + xpEarned;
        let newLevel = state.level;
        let newMaxXP = state.maxXP;
        let remainingXP = newXP;

        while (remainingXP >= newMaxXP) {
          remainingXP -= newMaxXP;
          newLevel += 1;
          newMaxXP = calculateMaxXP(newLevel);
        }

        set({
          levels: updatedLevels,
          totalStars: newTotalStars,
          currentXP: remainingXP,
          level: newLevel,
          maxXP: newMaxXP,
        });

        if (starsEarned >= 3 && levelId === 3) get().unlockBadge(4);
        if (state.totalStars >= 10) get().unlockBadge(5);
      },

      unlockBadge: (badgeId) => set((state) => ({
        badges: state.badges.map(b => b.id === badgeId ? { ...b, unlocked: true } : b)
      })),

      addXP: (amount) => {
        const state = get();
        let newXP = state.currentXP + amount;
        let newLevel = state.level;
        let newMaxXP = state.maxXP;

        while (newXP >= newMaxXP) {
          newXP -= newMaxXP;
          newLevel += 1;
          newMaxXP = calculateMaxXP(newLevel);
        }

        set({
          currentXP: newXP,
          level: newLevel,
          maxXP: newMaxXP,
        });
      },

      resetProgress: () => set({
        profile: DEFAULT_PROFILE,
        level: 1,
        currentXP: 0,
        maxXP: calculateMaxXP(1),
        streak: 0,
        totalStars: 0,
        levels: INITIAL_LEVELS.map(l => ({
          ...l,
          status: l.id === 1 ? 'current' : 'locked',
          stars: 0,
        })),
        badges: INITIAL_BADGES.map(b => ({ ...b, unlocked: b.id === 1 })),
        devMode: true,
      }),

      calculateMaxXP,

      setDevMode: (enabled) => set({ devMode: enabled }),

      // ✅ Nueva función para editar nombre del nivel
      updateLevelName: (levelId, newName) =>
        set((state) => ({
          levels: state.levels.map((level) =>
            level.id === levelId ? { ...level, name: newName } : level
          ),
        })),
    }),
    {
      name: 'ai-explorer-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);