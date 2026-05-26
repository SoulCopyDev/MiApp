---
n: 37
nombre: "Nombre del nivel"
mundo: 7
icono: "🤖"
descripcion: "Una línea que describe lo que aprenderá el usuario en este nivel."
xp_max: 200
---

<!-- ════════════════════════════════════════════════════════
     TIPOS DE MÓDULOS DISPONIBLES
     Copiar y pegar los bloques que necesites en cualquier orden.
     El skill genera el código completo automáticamente.
     ════════════════════════════════════════════════════════ -->

<!-- ── INTRODUCCIÓN (obligatorio, siempre primero) ───────── -->
## intro

Texto de bienvenida. Explica de qué trata el nivel y qué aprenderá el usuario.
Puede ser un párrafo o dos.

---

<!-- ── TEORÍA ─────────────────────────────────────────────
     tag: emoji y título del módulo
     contenido: texto principal (usa saltos de línea para párrafos)
     infoBox: caja destacada opcional (omitir si no hay)
     ──────────────────────────────────────────────────────── -->
## teoria | 10 XP
tag: 📖 Módulo 1 · Teoría
### Título del módulo de teoría

Texto principal aquí. Puede incluir varias líneas.
Cada línea nueva se renderiza como parte del mismo párrafo.

> InfoBox: Texto destacado en caja azul. Omitir este renglón si no hay infoBox.

---

<!-- ── QUIZ (opción múltiple) ─────────────────────────────
     Marcar la respuesta correcta con ✓ al final de la línea.
     feedback: explicación que aparece tras responder.
     ──────────────────────────────────────────────────────── -->
## quiz | 15 XP
tag: 🎯 Módulo 2 · Quiz
### Título del quiz

¿Pregunta aquí?

- Opción A
- Opción B ✓
- Opción C
- Opción D

> Feedback: Explicación de por qué B es la respuesta correcta.

---

<!-- ── MATCHING (conectar pares) ──────────────────────────
     Pares: lado izquierdo → lado derecho
     El skill mezcla el lado derecho automáticamente.
     ──────────────────────────────────────────────────────── -->
## matching | 20 XP
tag: 🔗 Módulo 3 · Matching
### Conecta cada concepto con su definición

- Concepto A → Definición A
- Concepto B → Definición B
- Concepto C → Definición C
- Concepto D → Definición D

---

<!-- ── VERDADERO O FALSO ───────────────────────────────────
     Formato: afirmación → TRUE/FALSE: feedback
     ──────────────────────────────────────────────────────── -->
## vf | 15 XP
tag: ✔️ Módulo 4 · Verdadero o Falso
### ¿Verdadero o Falso?

- La IA puede aprender sin datos. → FALSE: Todo modelo de IA requiere datos de entrenamiento.
- Los LLMs predicen tokens estadísticamente. → TRUE: Es la base del funcionamiento de GPT y similares.
- Una IA siempre da respuestas correctas. → FALSE: Los modelos tienen tasas de error y pueden alucinar.

---

<!-- ── BUILDER (texto libre del usuario) ──────────────────
     prompt: instrucción al usuario
     min: mínimo de caracteres requeridos
     ──────────────────────────────────────────────────────── -->
## builder | 15 XP
tag: ✏️ Módulo 5 · Reflexión
### Título del ejercicio

Instrucción clara para el usuario. ¿Qué debe escribir?
Puede ser una pregunta abierta o una tarea de redacción.

min: 30

---

<!-- ── SPRINT (escritura cronometrada) ────────────────────
     instruccion: qué debe hacer el usuario en el tiempo dado
     duracion: segundos (recomendado: 45–90)
     min: mínimo de caracteres para validar
     ──────────────────────────────────────────────────────── -->
## sprint | 20 XP
tag: ⚡ Módulo 6 · Sprint
### Título del sprint

Instrucción del sprint. El usuario tiene tiempo limitado para responder.
Ejemplo: "Escribe 3 usos de la IA en tu vida cotidiana."

duracion: 60
min: 50

---

<!-- ── CLASSIFY (clasificar en categorías) ────────────────
     categorias: 2 o 3 categorías separadas por |
     items: texto → nombre de la categoría correcta
     ──────────────────────────────────────────────────────── -->
## classify | 15 XP
tag: ↕️ Módulo 7 · Clasifica
### Clasifica cada elemento

categorias: Ventaja | Riesgo | Neutro

- El diagnóstico médico mejora → Ventaja
- Pérdida de privacidad → Riesgo
- Cambio de interfaz → Neutro
- Automatización de tareas repetitivas → Ventaja
- Sesgo algorítmico → Riesgo

---

<!-- ── FIN (obligatorio, siempre último) ──────────────────
     No requiere contenido. El skill genera la pantalla de
     resultados con estrellas, XP y botón de volver.
     ──────────────────────────────────────────────────────── -->
## fin

---

<!-- ════════════════════════════════════════════════════════
     REFERENCIA DE XP
     ─────────────────────────────────────────────────────────
     Guía de XP por tipo:
       teoria   → 0–10 XP   (no interactivo)
       quiz     → 10–20 XP  (una pregunta)
       matching → 15–25 XP  (varios pares)
       builder  → 10–20 XP  (reflexión libre)
       vf       → 10–20 XP  (múltiples ítems)
       sprint   → 15–25 XP  (esfuerzo cronometrado)
       classify → 10–20 XP  (clasificación)

     Regla de estrellas (automático, basado en xp_max):
       ★★★ = xp ≥ 67% de xp_max
       ★★  = xp ≥ 40% de xp_max
       ★   = xp ≥ 15% de xp_max

     Usa este comando cuando el spec esté listo:
       /project:new-level ruta/al/spec.md
     ════════════════════════════════════════════════════════ -->
