// Lista estática de emojis disponibles como avatar de perfil.
// Al ser un array const importado, no se recrea en cada render.

export const AVATAR_EMOJIS = [
  // Tecnología
  '🤖', '👾', '🧑‍💻', '🥷', '🧙', '🦸', '🤠', '🥸',
  // Animales
  '🦊', '🐱', '🐶', '🐸', '🦄', '🐻', '🐼', '🦁',
  '🐯', '🐺', '🦋', '🐲',
  // Cosmos y naturaleza
  '🚀', '🌟', '⚡', '🔥', '❄️', '🌈', '🌙', '☀️',
  // Logros y arte
  '💎', '👑', '🏆', '🎯', '🎮', '🧠', '💡', '🎨',
] as const;

export type AvatarEmoji = (typeof AVATAR_EMOJIS)[number];

export const DEFAULT_AVATAR_EMOJI: AvatarEmoji = '🤖';
