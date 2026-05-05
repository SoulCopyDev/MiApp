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
      name: '¿Qué es la IA?',
      icon: 'school',
      description: 'Aprende los conceptos básicos de la Inteligencia Artificial',
      levels: [
        { id: 1, name: 'Robots vs. Humanos 🤖', icon: 'smart-toy', status: 'current', stars: 0 }, 
        { id: 2, name: 'La IA vive en tus apps 📱', icon: 'apps', status: 'locked', stars: 0 }, 
        { id: 3, name: 'Habla con la IA: Prompting básico 💬', icon: 'chat', status: 'locked', stars: 0 }, 
        { id: 4, name: '¡Crea algo con IA Hoy! 🚀', icon: 'brush', status: 'locked', stars: 0 }, 
        { id: 5, name: 'IA y Ética ⚖️', icon: 'gavel', status: 'locked', stars: 0 }, 
        { id: 6, name: 'Tu primer proyecto con IA 🛠️', icon: 'build', status: 'locked', stars: 0 }, 
        { id: 7, name: 'Evaluación', icon: 'quiz', status: 'locked', stars: 0 },
      ],
    },
    {
      id: 2,
      name: 'Domina el Prompting',
      icon: 'psychology',
      description: 'Convierte tus instrucciones en superpoderes',
      levels: [
        { id: 1, name: 'Prompting Intermedio: Contexto y Roles 🎭', icon: 'theater-comedy', status: 'locked', stars: 0 },
        { id: 2, name: 'El Cerebro Secreto de la IA 🧠', icon: 'memory', status: 'locked', stars: 0 }, 
        { id: 3, name: 'Prompts Creativos: Escribe, Inventa y Sueña ✨', icon: 'auto-awesome', status: 'locked', stars: 0 }, 
        { id: 4, name: 'Prompts que Fallan: Aprende del Error 🐛', icon: 'bug-report', status: 'locked', stars: 0 }, 
        { id: 5, name: 'Prompts en Cadena: IA que Razona Paso a Paso 🔗', icon: 'linear-scale', status: 'locked', stars: 0 }, 
        { id: 6, name: 'Trucos Secretos: Prompting Avanzado 🔑', icon: 'vpn-key', status: 'locked', stars: 0 },
        { id: 7, name: 'Evaluación', icon: 'quiz', status: 'locked', stars: 0 },
      ],
    },
    {
      id: 3,
      name: 'IA Creativa',
      icon: 'palette',
      description: 'Crea imágenes, música, video y más con IA',
      levels: [
        { id: 1, name: 'IA que Dibuja: Genera Imágenes con Palabras 🖼️', icon: 'image', status: 'locked', stars: 0 }, 
        { id: 2, name: 'IA que Canta y Habla: Audio e IA 🎵', icon: 'music-note', status: 'locked', stars: 0 }, 
        { id: 3, name: 'IA que Filma: Genera Videos 🎬', icon: 'movie', status: 'locked', stars: 0 }, 
        { id: 4, name: 'Haz tu Primera Web con IA 💻', icon: 'code', status: 'locked', stars: 0 }, 
        { id: 5, name: 'Descubre Secretos en los Datos 📊', icon: 'analytics', status: 'locked', stars: 0 }, 
        { id: 6, name: 'IA Multimodal: Todo al Mismo Tiempo 🔗', icon: 'multiline-chart', status: 'locked', stars: 0 }, 
        { id: 7, name: 'Evaluación', icon: 'quiz', status: 'locked', stars: 0 },
      ],
    },
    {
      id: 4,
      name: 'El Gran Torneo de Herramientas',
      icon: 'emoji-events',
      description: 'Compara y domina las mejores IAs del momento',
      levels: [
        { id: 1, name: '⚡ ChatGPT: El Pionero', icon: 'smart-toy', status: 'locked', stars: 0 }, 
        { id: 2, name: '🟣 Claude: El que Piensa Contigo', icon: 'psychology', status: 'locked', stars: 0 }, 
        { id: 3, name: '🔵 Gemini: La IA de Google', icon: 'star', status: 'locked', stars: 0 }, 
        { id: 4, name: '🌑 Grok: La IA con Personalidad', icon: 'bolt', status: 'locked', stars: 0 }, 
        { id: 5, name: '🔍 Perplexity, Copilot y Más: El Ecosistema Completo', icon: 'search', status: 'locked', stars: 0 }, 
        { id: 6, name: '🎯 ¿Cuál Herramienta Uso? Elige como un Pro', icon: 'compare-arrows', status: 'locked', stars: 0 },
        { id: 7, name: 'Evaluación', icon: 'quiz', status: 'locked', stars: 0 }, 
      ],
    },
    {
      id: 5,
      name: 'Tu Proyecto de Impacto',
      icon: 'rocket-launch',
      description: 'De la idea a la realidad: crea tu solución con IA',
      levels: [
        { id: 1, name: '🤖 Crea tu Chatbot Personalizado', icon: 'chat', status: 'locked', stars: 0 }, 
        { id: 2, name: '⚡ Haz que la IA Trabaje Sola', icon: 'auto-awesome', status: 'locked', stars: 0 }, 
        { id: 3, name: '💡 Tu Idea para Cambiar Algo', icon: 'lightbulb', status: 'locked', stars: 0 }, 
        { id: 4, name: '📱 Diseña una App con IA — Sin Código', icon: 'phone-android', status: 'locked', stars: 0 }, 
        { id: 5, name: '📣 Comparte tu Creación con el Mundo', icon: 'share', status: 'locked', stars: 0 }, 
        { id: 6, name: '🎤 Presenta tu Proyecto', icon: 'record-voice-over', status: 'locked', stars: 0 }, 
        {id: 7, name: 'Evaluación', icon: 'quiz', status: 'locked', stars: 0 }, 
      ],
    },
    {
      id: 6,
      name: 'El Futuro de la IA',
      icon: 'travel-explore',
      description: 'El mundo que vas a heredar y la IA que lo transformará',
      levels: [
        { id: 1, name: '🤯 AGI: ¿Qué Pasaría si la IA Pensara Sola?', icon: 'auto-awesome', status: 'locked', stars: 0 }, 
        { id: 2, name: '🦾 Robótica e IA: El Cuerpo de la IA', icon: 'smart-toy', status: 'locked', stars: 0 }, 
        { id: 3, name: '🚗 IA en Movimiento: Autos y Drones', icon: 'directions-car', status: 'locked', stars: 0 }, 
        { id: 4, name: '🌍 IA y Tu Planeta: El Futuro que Vas a Heredar', icon: 'public', status: 'locked', stars: 0 }, 
        { id: 5, name: '🧬 IA y Tu Salud: La Medicina que Viene por Ti', icon: 'health-and-safety', status: 'locked', stars: 0 }, 
        { id: 6, name: '🌟 Tú y la IA: Tu Misión en el Mundo', icon: 'star', status: 'locked', stars: 0 }, 
        {id: 7, name: 'Evaluación', icon: 'quiz', status: 'locked', stars: 0 },   
        {id: 8, name: 'Evaluación Final', icon: 'quiz', status: 'locked', stars: 0 },   
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
      version: 13,
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