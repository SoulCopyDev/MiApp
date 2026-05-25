# AI Explorer — Descripción del Proyecto

## ¿Qué es?
App educativa gamificada para aprender Inteligencia Artificial. Diseñada para usuarios sin conocimientos técnicos previos. 100% offline, sin backend, cross-platform (Android / iOS / Web PWA).

## Audiencia objetivo
Personas sin perfil técnico que quieren entender IA de forma práctica. Tono accesible, progresión gradual, feedback inmediato.

## Flujo del usuario
```
Inicio (perfil + racha + misión diaria)
  → Mapa (6 mundos con progreso)
    → Mundo (lista de niveles desbloqueados)
      → Nivel (contenido interactivo: quiz, drag-drop, V/F, clasificación...)
        → Resultado (estrellas + XP ganado)
```

## Contenido

| Mundo | Tema | Niveles |
|---|---|---|
| 1 | ¿Qué es la IA? | 7 |
| 2 | Domina el Prompting | 7 |
| 3 | IA Creativa | 7 |
| 4 | El Gran Torneo de Herramientas | 7 |
| 5 | Tu Proyecto de Impacto | 7 |
| 6 | El Futuro de la IA | 8 |

**Total: 42 niveles.** Cada mundo termina con nivel "Evaluación". Mundo 6 tiene además "Evaluación Final".

## Mecánicas de juego
- **Estrellas:** 0–3 por nivel, basado en aciertos o XP acumulado
- **XP y niveles de jugador:** 8 rangos (Novato → Leyenda IA)
- **Racha diaria:** días consecutivos jugados
- **Misión diaria:** objetivo aleatorio basado en nivel actual
- **Insignias:** 15 badges desbloqueables por logros específicos
- **DevMode:** bypass de validaciones para pruebas rápidas

## Decisiones de arquitectura

| Decisión | Razón |
|---|---|
| Sin backend | Offline-first, cero costos operativos, simplicidad |
| Expo + Metro | Un codebase → Android/iOS/Web |
| Zustand + AsyncStorage | Estado global sin boilerplate, persiste entre sesiones |
| Expo Router (file-based) | Deep links nativos + web routing gratis |
| Niveles estáticos (no CMS) | Contenido educativo curado, sin dependencia de red |

## URLs

| Entorno | URL |
|---|---|
| Producción web | https://mi-app-kappa-navy.vercel.app |
| APK descarga | /downloads/ai-explorer.apk |

---

> **Meta-instrucción para Claude:** Actualizar este archivo si cambia el número de mundos/niveles, la audiencia objetivo, las URLs o las decisiones arquitectónicas fundamentales.
