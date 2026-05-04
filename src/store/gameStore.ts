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

export interface World {
  id: number;
  name: string;
  icon: string;
  description: string;
  levels: LevelProgress[];
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
  playerLevel: number;
  currentXP: number;
  maxXP: number;
  streak: number;
  totalStars: number;
  worlds: World[];
  badges: Badge[];
  devMode: boolean;

  setProfile: (profile: Partial<UserProfile>) => void;
  completeLevel: (worldId: number, levelId: number, starsEarned: number, xpEarned: number) => void;
  unlockBadge: (badgeId: number) => void;
  addXP: (amount: number) => void;
  resetProgress: () => void;
  calculateMaxXP: (level: number) => number;
  setDevMode: (enabled: boolean) => void;
  updateLevelName: (worldId: number, levelId: number, newName: string) => void;
  updateWorldName: (worldId: number, newName: string) => void;
}

// ---------- Datos iniciales ----------
const INITIAL_WORLDS: World[] = [
  {
    id: 1,
    name: 'Fundamentos de IA',
    icon: 'school',
    description: 'Aprende los conceptos básicos de la Inteligencia Artificial',
    levels: [
      { id: 1, name: 'Robots vs. Humanos 🤖', icon: 'smart-toy', status: 'completed', stars: 3 },
      { id: 2, name: 'Machine Learning', icon: 'psychology', status: 'completed', stars: 2 },
      { id: 3, name: 'Redes Neuronales', icon: 'account-tree', status: 'current', stars: 0 },
      { id: 4, name: 'Procesamiento de Datos', icon: 'storage', status: 'locked', stars: 0 },
      { id: 5, name: 'Ética en IA', icon: 'gavel', status: 'locked', stars: 0 },
      { id: 6, name: 'Tu primera misión real', icon: 'image', status: 'locked', stars: 0 },
    ],
  },
  {
    id: 2,
    name: 'Aplicaciones Prácticas',
    icon: 'rocket',
    description: 'Descubre cómo se aplica la IA en el mundo real',
    levels: [
      { id: 1, name: 'Visión Computacional', icon: 'image', status: 'locked', stars: 3 },
      { id: 2, name: 'Procesamiento de Texto', icon: 'record-voice-over', status: 'locked', stars: 0 },
      { id: 3, name: 'Robótica', icon: 'smart-toy', status: 'locked', stars: 0 },
      { id: 4, name: 'Big Data', icon: 'analytics', status: 'locked', stars: 0 },
      { id: 5, name: 'IA en la Nube', icon: 'cloud', status: 'locked', stars: 0 },
      { id: 6, name: 'IA en la Nube2', icon: 'cloud', status: 'locked', stars: 0 },
      { id: 7, name: 'IA en la Nube3', icon: 'cloud', status: 'locked', stars: 0 },
    ],
  },
    {
      id: 3,
      name: 'Especialización',
      icon: 'workspace-premium',
      description: 'Conviértete en un experto en IA',
      levels: [
        { id: 1, name: 'Edge Computing', icon: 'devices', status: 'locked', stars: 0 },
        { id: 2, name: 'IA Generativa', icon: 'palette', status: 'locked', stars: 0 },
        { id: 3, name: 'Aprendizaje Reforzado', icon: 'trending-up', status: 'locked', stars: 0 },
        { id: 4, name: 'Sistemas Expertos', icon: 'psychology', status: 'locked', stars: 0 },
        { id: 5, name: 'Proyecto Final', icon: 'workspace-premium', status: 'locked', stars: 0 },
        { id: 6, name: 'Proyecto Final', icon: 'workspace-premium', status: 'locked', stars: 0 },
        { id: 7, name: 'Proyecto Final', icon: 'workspace-premium', status: 'locked', stars: 0 },
      ],
    },
    {
      id: 4,
      name: 'El Gran Torneo de Herramientas',
      icon: 'emoji-events', // 🏆 trofeo
      description: 'Compara y domina las mejores IAs',
      levels: [
        { id: 1, name: 'ChatGPT: El Pionero', icon: 'smart-toy', status: 'locked', stars: 0 },
        { id: 2, name: 'Claude', icon: 'psychology', status: 'locked', stars: 0 },
        { id: 3, name: 'Gemini', icon: 'star', status: 'locked', stars: 0 },
        { id: 4, name: 'Grok', icon: 'bolt', status: 'locked', stars: 0 },
        { id: 5, name: 'Perplexity, Copilot y Más', icon: 'search', status: 'locked', stars: 0 },
        { id: 6, name: '¿Cuál Herramienta Uso?', icon: 'compare-arrows', status: 'locked', stars: 0 },
        { id: 7, name: 'Evaluación M4', icon: 'quiz', status: 'locked', stars: 0 },
      ],
    },
    {
      id: 5,
      name: 'Herramientas en la Nube',
      icon: 'emoji-events', // 🏆 trofeo
      description: 'Aprende a usar las herramientas en la nube',
      levels: [
        { id: 1, name: 'AWS', icon: 'cloud', status: 'locked', stars: 0 },
        { id: 2, name: 'Azure', icon: 'cloud', status: 'locked', stars: 0 },
        { id: 3, name: 'Google Cloud', icon: 'cloud', status: 'locked', stars: 0 }, { id: 4, name: 'Grok', icon: 'bolt', status: 'locked', stars: 0 },
        { id: 5, name: 'Perplexity, Copilot y Más', icon: 'search', status: 'locked', stars: 0 },
        { id: 6, name: '¿Cuál Herramienta Uso?', icon: 'compare-arrows', status: 'locked', stars: 0 },
        { id: 7, name: 'Evaluación M4', icon: 'quiz', status: 'locked', stars: 0 },
      ],
    },
    {
      id: 6,
      name: 'World 6',
      icon: 'emoji-events', // 🏆 trofeo
      description: 'Aprende a usar las herramientas en la nube',
      levels: [
        { id: 1, name: 'AWS', icon: 'cloud', status: 'locked', stars: 0 },
        { id: 2, name: 'Azure', icon: 'cloud', status: 'locked', stars: 0 },
        { id: 3, name: 'Google Cloud', icon: 'cloud', status: 'locked', stars: 0 },
        { id: 4, name: 'Grok', icon: 'bolt', status: 'locked', stars: 0 },
        { id: 5, name: 'Perplexity, Copilot y Más', icon: 'search', status: 'locked', stars: 0 },
        { id: 6, name: '¿Cuál Herramienta Uso?', icon: 'compare-arrows', status: 'locked', stars: 0 },
        { id: 7, name: 'Evaluación M4', icon: 'quiz', status: 'locked', stars: 0 }, 
        { id: 8, name: 'Evaluación M4', icon: 'quiz', status: 'locked', stars: 0 },
      ],
    },
];

const INITIAL_BADGES: Badge[] = [
  { id: 1, name: 'Explorador IA', icon: 'shield', unlocked: true, color: '#005ca8', bgColor: '#eef3ff' },
  { id: 2, name: 'Aprendiz de ML', icon: 'forum', unlocked: true, color: '#8126cf', bgColor: '#f3e8ff' },
  { id: 3, name: 'Amigo Robot', icon: 'smart-toy', unlocked: true, color: '#16a34a', bgColor: '#dcfce7' },
  { id: 4, name: 'Detective de Datos', icon: 'manage-search', unlocked: false, color: '#747779', bgColor: '#e5e9eb' },
  { id: 5, name: 'Maestro de Redes', icon: 'account-tree', unlocked: false, color: '#747779', bgColor: '#e5e9eb' },
  { id: 6, name: 'Visionario', icon: 'image', unlocked: false, color: '#747779', bgColor: '#e5e9eb' },
  { id: 7, name: 'Lingüista Digital', icon: 'record-voice-over', unlocked: false, color: '#747779', bgColor: '#e5e9eb' },
  { id: 8, name: 'Ético Digital', icon: 'gavel', unlocked: false, color: '#747779', bgColor: '#e5e9eb' },
  { id: 9, name: 'Constructor de Robots', icon: 'smart-toy', unlocked: false, color: '#747779', bgColor: '#e5e9eb' },
  { id: 10, name: 'Analista de Datos', icon: 'analytics', unlocked: false, color: '#747779', bgColor: '#e5e9eb' },
  { id: 11, name: 'Cloud Master', icon: 'cloud', unlocked: false, color: '#747779', bgColor: '#e5e9eb' },
  { id: 12, name: 'Edge Innovator', icon: 'devices', unlocked: false, color: '#747779', bgColor: '#e5e9eb' },
  { id: 13, name: 'Artista IA', icon: 'palette', unlocked: false, color: '#747779', bgColor: '#e5e9eb' },
  { id: 14, name: 'Estratega de RL', icon: 'trending-up', unlocked: false, color: '#747779', bgColor: '#e5e9eb' },
  { id: 15, name: 'Campeón IA', icon: 'workspace-premium', unlocked: false, color: '#747779', bgColor: '#e5e9eb' },
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
      playerLevel: 3,
      currentXP: 750,
      maxXP: calculateMaxXP(3),
      streak: 5,
      totalStars: 5,
      worlds: INITIAL_WORLDS,
      badges: INITIAL_BADGES,
      devMode: false,

      setProfile: (newProfile) => set((state) => ({
        profile: { ...state.profile, ...newProfile }
      })),

      completeLevel: (worldId, levelId, starsEarned, xpEarned) => {
        const state = get();
        const worldIndex = state.worlds.findIndex(w => w.id === worldId);
        if (worldIndex === -1) return;
        
        const world = state.worlds[worldIndex];
        const levelIndex = world.levels.findIndex(l => l.id === levelId);
        if (levelIndex === -1) return;
      
        const updatedWorlds = [...state.worlds];
        const updatedLevels = [...world.levels];
        
        updatedLevels[levelIndex] = {
          ...updatedLevels[levelIndex],
          status: 'completed',
          stars: Math.max(updatedLevels[levelIndex].stars, starsEarned),
        };
      
        // Desbloquear el siguiente nivel en el mismo mundo
        const nextLevelIndex = levelIndex + 1;
        if (nextLevelIndex < updatedLevels.length && updatedLevels[nextLevelIndex].status === 'locked') {
          updatedLevels[nextLevelIndex].status = 'current';
        }
      
        // 🆕 Si acabamos de completar el último nivel del mundo, desbloquear el primer nivel del siguiente mundo
        const isLastLevel = levelIndex === updatedLevels.length - 1;
        if (isLastLevel) {
          const nextWorldIndex = worldIndex + 1;
          if (nextWorldIndex < updatedWorlds.length) {
            const nextWorld = updatedWorlds[nextWorldIndex];
            const firstLevel = nextWorld.levels[0];
            if (firstLevel && firstLevel.status === 'locked') {
              const updatedNextWorldLevels = [...nextWorld.levels];
              updatedNextWorldLevels[0] = { ...firstLevel, status: 'current' };
              updatedWorlds[nextWorldIndex] = { ...nextWorld, levels: updatedNextWorldLevels };
            }
          }
        }
      
        updatedWorlds[worldIndex] = { ...world, levels: updatedLevels };
      
        // ... el resto del cálculo de estrellas, XP e insignias queda igual
        const newTotalStars = updatedWorlds.reduce((sum, w) => 
          sum + w.levels.reduce((s, l) => s + l.stars, 0), 0
        );
      
        const newXP = state.currentXP + xpEarned;
        let newPlayerLevel = state.playerLevel;
        let newMaxXP = state.maxXP;
        let remainingXP = newXP;
      
        while (remainingXP >= newMaxXP) {
          remainingXP -= newMaxXP;
          newPlayerLevel += 1;
          newMaxXP = calculateMaxXP(newPlayerLevel);
        }
      
        set({
          worlds: updatedWorlds,
          totalStars: newTotalStars,
          currentXP: remainingXP,
          playerLevel: newPlayerLevel,
          maxXP: newMaxXP,
        });
      
        if (starsEarned >= 3 && worldId === 1 && levelId === 3) get().unlockBadge(4);
        if (newTotalStars >= 10) get().unlockBadge(5);
        if (worldId === 1 && levelId === 5) get().unlockBadge(6);
      },

      unlockBadge: (badgeId) => set((state) => ({
        badges: state.badges.map(b => b.id === badgeId ? { ...b, unlocked: true } : b)
      })),

      addXP: (amount) => {
        const state = get();
        let newXP = state.currentXP + amount;
        let newPlayerLevel = state.playerLevel;
        let newMaxXP = state.maxXP;

        while (newXP >= newMaxXP) {
          newXP -= newMaxXP;
          newPlayerLevel += 1;
          newMaxXP = calculateMaxXP(newPlayerLevel);
        }

        set({
          currentXP: newXP,
          playerLevel: newPlayerLevel,
          maxXP: newMaxXP,
        });
      },

      resetProgress: () => {
        const resetWorlds: World[] = INITIAL_WORLDS.map((world, wIndex) => ({
          ...world,
          levels: world.levels.map((level, lIndex) => ({
            ...level,
            status: (wIndex === 0 && lIndex === 0) ? 'current' : 'locked' as LevelStatus,
            stars: 0,
          })),
        }));
        
        set({
          profile: DEFAULT_PROFILE,
          playerLevel: 1,
          currentXP: 0,
          maxXP: calculateMaxXP(1),
          streak: 0,
          totalStars: 0,
          worlds: resetWorlds,
          badges: INITIAL_BADGES.map(b => ({ ...b, unlocked: b.id === 1 })),
          devMode: true,
        });
      },

      calculateMaxXP,

      setDevMode: (enabled) => set({ devMode: enabled }),

      updateLevelName: (worldId, levelId, newName) =>
        set((state) => ({
          worlds: state.worlds.map(world =>
            world.id === worldId
              ? {
                  ...world,
                  levels: world.levels.map(level =>
                    level.id === levelId ? { ...level, name: newName } : level
                  ),
                }
              : world
          ),
        })),

      updateWorldName: (worldId, newName) =>
        set((state) => ({
          worlds: state.worlds.map(world =>
            world.id === worldId ? { ...world, name: newName } : world
          ),
        })),
    }),
    {
      name: 'ai-explorer-storage-v2',
      storage: createJSONStorage(() => AsyncStorage),
      version: 11,
      migrate: (persistedState: any, version: number) => {
        if (persistedState?.worlds) {
          // 1. Agregar mundos completamente nuevos (que no existan en el estado guardado)
          INITIAL_WORLDS.forEach((templateWorld) => {
            let world = persistedState.worlds.find((w: World) => w.id === templateWorld.id);
            if (!world) {
              // El mundo no existe en absoluto: lo creamos con todos sus niveles bloqueados
              world = {
                id: templateWorld.id,
                name: templateWorld.name,
                icon: templateWorld.icon,
                description: templateWorld.description,
                levels: templateWorld.levels.map((l) => ({
                  id: l.id,
                  name: l.name,
                  icon: l.icon,
                  status: 'locked' as LevelStatus,
                  stars: 0,
                })),
              };
              persistedState.worlds.push(world);
            } else {
              // 2. Si el mundo ya existe, agregar niveles faltantes
              templateWorld.levels.forEach((templateLevel) => {
                const exists = world.levels.some((l: any) => l.id === templateLevel.id);
                if (!exists) {
                  world.levels.push({
                    id: templateLevel.id,
                    name: templateLevel.name,
                    icon: templateLevel.icon,
                    status: 'locked',
                    stars: 0,
                  });
                }
              });
            }
          });
      
          // 3. Reordenar los mundos por ID para que queden en el orden correcto
          persistedState.worlds.sort((a: World, b: World) => a.id - b.id);
      
          // 4. Desbloqueo del primer nivel del mundo siguiente si el anterior está completo
          for (let i = 0; i < persistedState.worlds.length - 1; i++) {
            const currentWorld = persistedState.worlds[i];
            const allCompleted = currentWorld.levels.every((l: any) => l.status === 'completed');
            const nextWorld = persistedState.worlds[i + 1];
            if (allCompleted && nextWorld && nextWorld.levels[0]?.status === 'locked') {
              nextWorld.levels[0].status = 'current';
            }
          }
        }
      
        return persistedState as GameState;
      },
    }
  )
);