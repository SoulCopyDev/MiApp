import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DailyMission,
  generateDailyMission,
  detectMissionStatus,
} from '../utils/dailyMission';
import { DEFAULT_AVATAR_EMOJI } from '../config/avatarEmojis';

// ---------- Utilidades de numeración global ----------
/** Converts global level number (N=1..43) to worldId/levelId coords. */
function globalNToCoords(N: number): { worldId: number; levelId: number } {
  if (N === 43) return { worldId: 6, levelId: 8 };
  if (N >= 37)  return { worldId: N - 36, levelId: 7 };
  const worldId = Math.ceil(N / 6);
  return { worldId, levelId: N - (worldId - 1) * 6 };
}

/** Converts worldId/levelId to global level number (N=1..43). */
export function coordsToGlobalN(worldId: number, levelId: number): number {
  if (levelId === 8) return 43;
  if (levelId === 7) return worldId + 36;
  return (worldId - 1) * 6 + levelId;
}

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
  description: string;
  icon: string;
  unlocked: boolean;
  color: string;
  bgColor: string;
}

export interface UserProfile {
  name: string;
  avatarEmoji: string;
  soundEnabled: boolean;
}

export interface GameState {
  profile: UserProfile;
  playerLevel: number;
  currentXP: number;
  maxXP: number;
  streak: number;
  lastPlayedDate: string | null;
  totalStars: number;
  worlds: World[];
  badges: Badge[];
  dailyMission: DailyMission | null;
  devMode: boolean;

  setProfile: (profile: Partial<UserProfile>) => void;
  completeLevel: (globalN: number, starsEarned: number, xpEarned: number) => void;
  unlockBadge: (badgeId: number) => void;
  addXP: (amount: number) => void;
  resetProgress: () => void;
  calculateMaxXP: (level: number) => number;
  setDevMode: (enabled: boolean) => void;
  updateStreak: () => void;
  refreshDailyMission: () => void;
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
  { id: 1,  name: 'Explorador IA',      description: 'Completa tu primer nivel del curso',               icon: 'shield',            unlocked: false, color: '#005ca8', bgColor: '#eef3ff' },
  { id: 2,  name: 'Aprendiz de ML',     description: "Termina el mundo '¿Qué es la IA?'",               icon: 'forum',             unlocked: false, color: '#8126cf', bgColor: '#f3e8ff' },
  { id: 3,  name: 'Amigo Robot',        description: 'Obtén 3 ⭐ en cualquier nivel',                    icon: 'smart-toy',         unlocked: false, color: '#16a34a', bgColor: '#dcfce7' },
  { id: 4,  name: 'Detective de Datos', description: "Completa el mundo 'Domina el Prompting'",          icon: 'manage-search',     unlocked: false, color: '#747779', bgColor: '#e5e9eb' },
  { id: 5,  name: 'Maestro de Redes',   description: 'Acumula 15 estrellas en total',                    icon: 'account-tree',      unlocked: false, color: '#747779', bgColor: '#e5e9eb' },
  { id: 6,  name: 'Visionario',         description: "Completa el mundo 'IA Creativa'",                  icon: 'image',             unlocked: false, color: '#747779', bgColor: '#e5e9eb' },
  { id: 7,  name: 'Lingüista Digital',  description: 'Completa el nivel de Prompts Creativos (M2·N3)',   icon: 'record-voice-over', unlocked: false, color: '#747779', bgColor: '#e5e9eb' },
  { id: 8,  name: 'Ético Digital',      description: 'Completa el nivel de IA y Ética (M1·N5)',          icon: 'gavel',             unlocked: false, color: '#747779', bgColor: '#e5e9eb' },
  { id: 9,  name: 'Constructor de IA',  description: "Completa el 'Gran Torneo de Herramientas' (M4)",   icon: 'smart-toy',         unlocked: false, color: '#747779', bgColor: '#e5e9eb' },
  { id: 10, name: 'Analista de Datos',  description: 'Acumula 30 estrellas en total',                    icon: 'analytics',         unlocked: false, color: '#747779', bgColor: '#e5e9eb' },
  { id: 11, name: 'Cloud Master',       description: "Completa el mundo 'Tu Proyecto de Impacto' (M5)",  icon: 'cloud',             unlocked: false, color: '#747779', bgColor: '#e5e9eb' },
  { id: 12, name: 'Edge Innovator',     description: 'Acumula 50 estrellas en total',                    icon: 'devices',           unlocked: false, color: '#747779', bgColor: '#e5e9eb' },
  { id: 13, name: 'Artista IA',         description: 'Completa el nivel de Generación de Imágenes (M3·N1)', icon: 'palette',        unlocked: false, color: '#747779', bgColor: '#e5e9eb' },
  { id: 14, name: 'Estratega de RL',    description: 'Acumula 75 estrellas en total',                    icon: 'trending-up',       unlocked: false, color: '#747779', bgColor: '#e5e9eb' },
  { id: 15, name: 'Campeón IA',         description: '¡Completa todos los mundos del curso!',            icon: 'workspace-premium', unlocked: false, color: '#747779', bgColor: '#e5e9eb' },
];

const DEFAULT_PROFILE: UserProfile = {
  name: 'AI Explorer',
  avatarEmoji: DEFAULT_AVATAR_EMOJI,
  soundEnabled: true,
};

const calculateMaxXP = (level: number): number => {
  return Math.floor(1000 + (level - 1) * 500);
};

// Devuelve la fecha local del dispositivo como 'YYYY-MM-DD'.
// Usa hora local para que la racha se calcule según el día del usuario, no UTC.
const getLocalDate = (offsetDays = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ---------- Store ----------
export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      profile: DEFAULT_PROFILE,
      playerLevel: 1,
      currentXP: 0,
      maxXP: calculateMaxXP(1),
      streak: 0,
      lastPlayedDate: null,
      totalStars: 0,
      worlds: INITIAL_WORLDS,
      badges: INITIAL_BADGES,
      dailyMission: null,
      devMode: false,

      setProfile: (newProfile) => set((state) => ({
        profile: { ...state.profile, ...newProfile }
      })),

      completeLevel: (globalN, starsEarned, xpEarned) => {
        const { worldId, levelId } = globalNToCoords(globalN);
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
      
        const isWorldComplete = (wId: number) =>
          updatedWorlds.find(w => w.id === wId)?.levels.every(l => l.status === 'completed') ?? false;

        // 1 — Primer nivel completado (N1)
        if (globalN === 1)                   get().unlockBadge(1);
        // 2 — World 1 completo
        if (isWorldComplete(1))              get().unlockBadge(2);
        // 3 — Primera vez con 3 estrellas en cualquier nivel
        if (starsEarned >= 3)                get().unlockBadge(3);
        // 4 — World 2 completo
        if (isWorldComplete(2))              get().unlockBadge(4);
        // 5 — 15 estrellas acumuladas
        if (newTotalStars >= 15)             get().unlockBadge(5);
        // 6 — World 3 completo
        if (isWorldComplete(3))              get().unlockBadge(6);
        // 7 — N9: Prompts Creativos (World2/Level3)
        if (globalN === 9)                   get().unlockBadge(7);
        // 8 — N5: IA y Ética (World1/Level5)
        if (globalN === 5)                   get().unlockBadge(8);
        // 9 — World 4 completo
        if (isWorldComplete(4))              get().unlockBadge(9);
        // 10 — 30 estrellas acumuladas
        if (newTotalStars >= 30)             get().unlockBadge(10);
        // 11 — World 5 completo
        if (isWorldComplete(5))              get().unlockBadge(11);
        // 12 — 50 estrellas acumuladas
        if (newTotalStars >= 50)             get().unlockBadge(12);
        // 13 — N13: Generación de Imágenes (World3/Level1)
        if (globalN === 13)                  get().unlockBadge(13);
        // 14 — 75 estrellas acumuladas
        if (newTotalStars >= 75)             get().unlockBadge(14);
        // 15 — Todos los mundos completados
        if (updatedWorlds.every(w => w.levels.every(l => l.status === 'completed'))) get().unlockBadge(15);

        // Comprobar si el nivel recién completado es el objetivo de la misión diaria
        const mission = get().dailyMission;
        if (
          mission &&
          !mission.rewardClaimed &&
          mission.status !== 'completed' &&
          mission.targetWorldId === worldId &&
          mission.targetLevelId === levelId  // worldId/levelId extracted from globalN above
        ) {
          set({ dailyMission: { ...mission, status: 'completed', rewardClaimed: true } });
          get().addXP(mission.reward.xp);
        }
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
          lastPlayedDate: null,
          totalStars: 0,
          worlds: resetWorlds,
          badges: INITIAL_BADGES.map(b => ({ ...b, unlocked: false })),
          dailyMission: null,
          devMode: true,
        });
      },

      calculateMaxXP,

      setDevMode: (enabled) => set({ devMode: enabled }),

      updateStreak: () => {
        const state = get();
        const today = getLocalDate();
        if (state.lastPlayedDate === today) return;
        const isConsecutive = state.lastPlayedDate === getLocalDate(-1);
        set({ streak: isConsecutive ? state.streak + 1 : 1, lastPlayedDate: today });
      },

      refreshDailyMission: () => {
        const state = get();
        const today = getLocalDate();

        if (state.dailyMission?.date === today) {
          // Reutilizar misión de hoy; solo sincronizar el status si cambió
          const mission = state.dailyMission;
          if (mission.status === 'completed') return;

          const newStatus = detectMissionStatus(mission, state.worlds);
          if (newStatus !== mission.status) {
            set({ dailyMission: { ...mission, status: newStatus } });
          }
          return;
        }

        // Nuevo día → generar misión fresca
        set({ dailyMission: generateDailyMission(state.worlds, today) });
      },

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
      version: 20,
      migrate: (persistedState: any, version: number) => {
        if (persistedState?.worlds) {
          // Iterate over the template worlds to update/add
          INITIAL_WORLDS.forEach((templateWorld) => {
            let existingWorld = persistedState.worlds.find((w: World) => w.id === templateWorld.id);
            
            if (!existingWorld) {
              // Completely new world – add it with all levels locked
              existingWorld = {
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
              persistedState.worlds.push(existingWorld);
            } else {
              // World already exists – update its metadata with the template
              existingWorld.name = templateWorld.name;
              existingWorld.icon = templateWorld.icon;
              existingWorld.description = templateWorld.description;
              
              // Rebuild levels in the order defined by the template,
              // updating names/icons but keeping progress
              const updatedLevels = templateWorld.levels.map((templateLevel) => {
                const existingLevel = existingWorld.levels.find((l: any) => l.id === templateLevel.id);
                if (existingLevel) {
                  // Keep user progress, just sync name and icon
                  return {
                    ...existingLevel,
                    name: templateLevel.name,
                    icon: templateLevel.icon,
                  };
                } else {
                  // New level introduced – add as locked
                  return {
                    id: templateLevel.id,
                    name: templateLevel.name,
                    icon: templateLevel.icon,
                    status: 'locked' as LevelStatus,
                    stars: 0,
                  };
                }
              });
              
              existingWorld.levels = updatedLevels;
            }
          });
          
          // Ensure worlds are sorted by ID
          persistedState.worlds.sort((a: World, b: World) => a.id - b.id);
          
          // Auto-unlock: if all levels of world N are completed, unlock first level of world N+1
          for (let i = 0; i < persistedState.worlds.length - 1; i++) {
            const currentWorld = persistedState.worlds[i];
            const allCompleted = currentWorld.levels.every((l: any) => l.status === 'completed');
            const nextWorld = persistedState.worlds[i + 1];
            if (allCompleted && nextWorld && nextWorld.levels[0]?.status === 'locked') {
              nextWorld.levels[0].status = 'current';
            }
          }
        }
      
        // Reconstruye insignias: preserva estado unlocked, actualiza nombre/descripción/icono/colores del template
        if (Array.isArray(persistedState?.badges)) {
          persistedState.badges = INITIAL_BADGES.map(template => {
            const existing = persistedState.badges.find((b: Badge) => b.id === template.id);
            return { ...template, unlocked: existing?.unlocked ?? false };
          });
        } else {
          persistedState.badges = INITIAL_BADGES.map(b => ({ ...b, unlocked: false }));
        }

        if (persistedState.lastPlayedDate === undefined) {
          persistedState.lastPlayedDate = null;
        }
        if (persistedState.dailyMission === undefined) {
          persistedState.dailyMission = null;
        }

        // Migrar sistema de avatar antiguo → avatarEmoji
        if (persistedState.profile) {
          if (!persistedState.profile.avatarEmoji) {
            const oldAvatar = persistedState.profile.avatar;
            persistedState.profile.avatarEmoji =
              oldAvatar === 'kid' ? '🧑‍💻'
              : oldAvatar === 'pet' ? '🐶'
              : DEFAULT_AVATAR_EMOJI;
          }
          // Limpiar campos obsoletos
          delete persistedState.profile.avatar;
          delete persistedState.profile.avatarUri;
        }

        // Recalcula totalStars desde worlds para garantizar consistencia
        if (Array.isArray(persistedState?.worlds)) {
          persistedState.totalStars = persistedState.worlds.reduce(
            (sum: number, w: World) =>
              sum + w.levels.reduce((s: number, l: any) => s + (l.stars ?? 0), 0),
            0
          );
        }

        return persistedState as GameState;
      },
    }
  )
);