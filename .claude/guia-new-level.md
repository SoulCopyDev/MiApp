# Guía completa — Generador de niveles `/project:new-level`

## Qué hace este sistema

Convierte un archivo de texto (el "spec") en un nivel funcional completo. Un solo comando genera:

- `src/levels/Level{N}.tsx` — código React Native completo, listo para producción
- Registro en `src/levels/LevelScreen.tsx` — el dispatcher lo conoce automáticamente
- Entrada en `src/store/gameStore.ts` — aparece en el mapa del juego
- Incremento de versión del store — migración automática para usuarios existentes

No hay que tocar código. Solo hay que escribir el contenido.

---

## Flujo de trabajo estándar

```
1. Copiar el template
2. Rellenar con el contenido del nivel
3. Ejecutar el comando
4. Revisar el nivel generado en la app
5. Commit y deploy
```

### Paso 1 — Copiar el template

```bash
cp .claude/commands/_nivel-template.md mi-nivel-37.md
```

Nombrar el archivo con el número del nivel: `nivel-37-salud.md`, `nivel-38-robotica.md`, etc.

### Paso 2 — Rellenar el frontmatter

El frontmatter es la parte entre `---` al principio del archivo. Es lo más importante.

```yaml
---
n: 37                  # Número del nivel (siguiente disponible después de 36)
nombre: "IA en Salud"  # Nombre que ve el usuario
mundo: 7               # worldId (1–6 existentes, o 7+ si es mundo nuevo)
icono: "🏥"            # Emoji del nivel (aparece en mapa y pantalla de intro)
descripcion: "Descubre cómo la IA transforma el diagnóstico médico"
xp_max: 200            # XP total disponible — define los umbrales de estrellas
---
```

**Cómo saber qué número de nivel usar:**
- El último nivel existente es N36 (World 6, Level 6)
- El siguiente nivel regular sería N37 en el World 7
- Ejecutar `ls src/levels/Level*.tsx | sort -V | tail -3` para ver los últimos

**Cómo calcular `xp_max`:**
Sumar el XP de todos los módulos interactivos del spec. Ejemplo:
- 1 teoría (0 XP) + 2 quiz (15 XP c/u) + 1 matching (20 XP) + 1 VF (15 XP) + 1 builder (15 XP) = **80 XP total**

### Paso 3 — Escribir los módulos

Cada módulo es una sección del documento que empieza con `## tipo | XP`.

### Paso 4 — Ejecutar el comando

```
/project:new-level ruta/al/mi-nivel-37.md
```

El skill reporta exactamente qué archivos tocó y qué errores encontró (si los hay).

### Paso 5 — Verificar en la app

```bash
npm run web
```

Navegar al mundo correspondiente → abrir el nivel → completar todos los módulos → verificar pantalla de resultados.

---

## Módulos disponibles — Referencia detallada

### `intro` — Obligatorio, siempre primero

La pantalla de bienvenida del nivel. El usuario la ve antes de empezar.

```markdown
## intro

En este nivel vas a descubrir cómo la IA está revolucionando la medicina.
Aprenderás a identificar las principales herramientas, sus limitaciones y
cómo pueden cambiar tu vida en los próximos años.
```

**Reglas:**
- Solo texto corrido. Sin subtítulos.
- 2–4 oraciones. No más.
- Mencionar qué aprenderá el usuario (engancha la motivación).

---

### `teoria` — Contenido teórico

Módulo de lectura. El usuario avanza con el botón "Entendido →".

```markdown
## teoria | 10 XP
tag: 📖 Módulo 1 · Diagnóstico con IA
### ¿Cómo ve la IA una radiografía?

Los modelos de visión computacional analizan píxeles de imágenes médicas
buscando patrones que predicen enfermedades. Fueron entrenados con millones
de radiografías etiquetadas por radiólogos expertos.

> InfoBox: En 2023, el modelo CheXNet de Stanford detectó neumonía en
> radiografías con mayor precisión que el promedio de radiólogos.
```

**Componentes:**
- `tag:` — etiqueta visual (emoji + texto). Formato: `📖 Módulo N · Tema`
- `###` — título del módulo (negrita grande)
- Texto corrido — párrafos separados por línea en blanco
- `> InfoBox:` — caja azul destacada. **Opcional.** Usar para datos sorprendentes o analogías clave.

**Buenas prácticas:**
- Máximo 3–4 oraciones de texto principal. Si hay más, dividir en dos módulos de teoría.
- La InfoBox es para datos concretos, no resúmenes del texto anterior.
- Usar negritas en el spec para indicar qué texto va en Bold en la app: `**texto**`

**XP:** La teoría no es interactiva → 0–10 XP. Usar 10 solo si el contenido es denso.

---

### `quiz` — Pregunta de opción múltiple

Un quiz clásico: 4 opciones, 1 correcta, feedback inmediato.

```markdown
## quiz | 15 XP
tag: 🎯 Módulo 2 · Quiz
### ¿Cuánto mejora la IA el diagnóstico?

¿Qué hace el modelo AlphaFold de DeepMind?

- Genera imágenes médicas realistas
- Predice la estructura 3D de proteínas ✓
- Traduce reportes médicos entre idiomas
- Automatiza cirugías con brazos robóticos

> Feedback: AlphaFold resolvió en 2021 uno de los problemas más difíciles
> de la biología: predecir cómo se pliegan las proteínas. Ganó el Nobel de
> Química 2024.
```

**Reglas de formato:**
- La línea de pregunta va SIN guión, directamente después de `###`
- Opciones con `- ` al inicio
- La opción correcta lleva ` ✓` al final (espacio antes del checkmark)
- `> Feedback:` — explicación que aparece tras responder. **Obligatoria.** Explica el POR QUÉ, no solo "correcto" o "incorrecto".

**Buenas prácticas para quiz:**
- Los distractores (opciones incorrectas) deben ser plausibles, no obvios.
- El feedback de respuesta incorrecta debe enseñar algo nuevo, no solo corregir.
- Evitar opciones tipo "todas las anteriores" o "ninguna de las anteriores".
- La correcta NO tiene que ser siempre la B — variar posición.

**XP:** 10–20 XP según dificultad. Un quiz estándar = 15 XP.

---

### `matching` — Conectar pares

El usuario une conceptos con definiciones. El lado derecho se mezcla automáticamente.

```markdown
## matching | 20 XP
tag: 🔗 Módulo 3 · Herramientas
### Conecta cada IA con su especialidad médica

- Google DeepMind AlphaFold → Predicción de estructura de proteínas
- IBM Watson Oncology → Análisis de historiales para tratamiento de cáncer
- Microsoft InnerEye → Segmentación de tumores en imágenes 3D
- Babylon Health → Diagnóstico por síntomas vía chatbot
```

**Reglas de formato:**
- Formato exacto: `- Izquierda → Derecha`
- Mínimo 3 pares, máximo 6.
- El texto de cada lado debe ser corto (máximo 8–10 palabras).
- Los pares deben ser distintos unos de otros — sin ambigüedad posible.

**Buenas prácticas:**
- El lado izquierdo: nombres propios, conceptos técnicos, herramientas.
- El lado derecho: definiciones, funciones, características.
- Si los textos son largos, el matching se ve mal en móvil — reducir a 3–4 pares cortos.

**XP:** 15–25 XP según número de pares. 4 pares = 20 XP es estándar.

---

### `vf` — Verdadero o Falso

Múltiples afirmaciones, el usuario decide si son verdad o mentira.

```markdown
## vf | 15 XP
tag: ✔️ Módulo 4 · Mitos y realidades
### ¿Verdadero o Falso sobre IA en medicina?

- La IA puede reemplazar completamente a los médicos. → FALSE: La IA asiste y complementa, pero la responsabilidad y el juicio clínico siguen siendo humanos.
- Los algoritmos de IA pueden detectar enfermedades antes de síntomas visibles. → TRUE: Modelos entrenados en datos longitudinales detectan patrones sutiles años antes.
- Una IA médica aprobada por la FDA garantiza 0% de errores. → FALSE: Toda IA tiene tasas de error. La FDA evalúa que el beneficio supere el riesgo, no perfección.
- El sesgo racial existe en algoritmos médicos. → TRUE: Modelos entrenados con datos mayoritariamente caucásicos rinden peor en otras etnias — es un problema documentado.
```

**Reglas de formato:**
- Formato exacto: `- Afirmación. → TRUE/FALSE: Feedback explicativo.`
- TRUE/FALSE en mayúsculas.
- El feedback va después de los dos puntos `:` — es la parte más importante.
- Mínimo 3 ítems, máximo 6.

**Buenas prácticas:**
- Mezclar TRUE y FALSE — no todos del mismo tipo.
- Las afirmaciones falsas deben ser creencias comunes, no mentiras obvias.
- El feedback de los TRUE también debe enseñar algo (no solo "correcto").
- Afirmaciones cortas → mejor experiencia. Máximo 2 líneas por afirmación.

**XP:** 10–20 XP. 4 ítems = 15 XP es estándar.

---

### `builder` — Reflexión escrita

El usuario escribe una respuesta libre. Se valida por longitud mínima.

```markdown
## builder | 15 XP
tag: ✏️ Módulo 5 · Tu perspectiva
### Si la IA detectara enfermedades con 10 años de anticipación...

¿Cómo cambiaría tu vida si supieras con una década de antelación que
desarrollarás una enfermedad? ¿Cambiarías algo? ¿Querrías saberlo?
Escribe tu reflexión honesta.

min: 40
```

**Reglas de formato:**
- `###` — título del ejercicio
- Texto — el prompt o instrucción para el usuario (puede ser largo)
- `min:` — mínimo de caracteres. **Obligatorio.**

**Cuándo usar builder:**
- Para reflexiones abiertas donde no hay respuesta correcta.
- Para ejercicios creativos (escribir un prompt, diseñar algo, planificar).
- Nunca para preguntas con respuesta correcta única (usar quiz).

**Buenas prácticas para el min:**
- Reflexión simple → `min: 30`
- Respuesta elaborada → `min: 50`
- Ejercicio extenso → `min: 80`
- No poner `min:` muy alto — el usuario abandona si se siente bloqueado.

**XP:** 10–20 XP. No más de 20 aunque sea un builder largo.

---

### `sprint` — Escritura cronometrada

El usuario escribe lo más posible en tiempo limitado. Alta presión, alta energía.

```markdown
## sprint | 20 XP
tag: ⚡ Módulo 6 · Sprint
### 60 segundos: usos de IA en salud

Tienes 60 segundos. Escribe todos los usos de la IA en medicina que
se te ocurran — diagnóstico, tratamiento, investigación, logística.
¡Cuantos más, mejor!

duracion: 60
min: 50
```

**Reglas de formato:**
- `duracion:` — segundos. Rango recomendado: 45–90.
- `min:` — mínimo para considerar válido (evitar envíos vacíos).

**Cuándo usar sprint:**
- Para generar ideas rápidamente (brainstorming).
- Para demostrar que el usuario ya sabe el tema (síntesis).
- Colocar hacia el final del nivel, cuando el usuario ya aprendió el contenido.
- Nunca más de 1 sprint por nivel.

**Buenas prácticas:**
- El tiempo debe ser desafiante pero alcanzable. 60s para listar ideas = OK. 30s para escribir una oración = demasiado corto.
- La instrucción debe ser ultra-clara — el usuario no puede releerla mientras el timer corre.

**XP:** 15–25 XP. Es el módulo más "costoso" en esfuerzo → merece más XP.

---

### `classify` — Clasificar en categorías

El usuario asigna cada elemento a una de 2–3 categorías.

```markdown
## classify | 15 XP
tag: ↕️ Módulo 7 · Clasifica
### ¿Beneficio, riesgo o neutral?

categorias: Beneficio | Riesgo | Neutral

- Diagnóstico más preciso que el ojo humano → Beneficio
- Desempleo de radiólogos → Riesgo
- Mayor cantidad de datos médicos disponibles → Neutral
- Sesgo algorítmico en grupos minoritarios → Riesgo
- Detección temprana de enfermedades raras → Beneficio
- Cambio en flujos de trabajo hospitalarios → Neutral
```

**Reglas de formato:**
- `categorias:` — nombres separados por `|`. Máximo 3 categorías.
- `- Elemento → Categoría correcta` — la categoría debe coincidir exactamente con el nombre declarado arriba.

**Buenas prácticas:**
- 2 categorías: Sí/No, Verdad/Mito, Positivo/Negativo.
- 3 categorías: permite matices pero complica la UI en pantallas pequeñas.
- Los elementos deben ser inequívocos — sin debates posibles sobre la categoría correcta.
- 4–6 elementos es el rango ideal.

**XP:** 10–20 XP. 5 elementos = 15 XP estándar.

---

### `fin` — Obligatorio, siempre último

No requiere contenido. El skill genera automáticamente la pantalla de resultados con:
- Trofeo 🏆
- Nombre del nivel
- Estrellas (calculadas del XP acumulado vs xp_max)
- XP ganado
- Botón "Volver al mundo"

```markdown
## fin
```

---

## Diseño de un nivel completo — Buenas prácticas

### Estructura recomendada (orden óptimo)

```
intro → teoria → quiz → matching → teoria → vf → builder → sprint → fin
```

No es obligatorio seguir este orden, pero tiene lógica pedagógica:
1. **Intro** — engancha, contextualiza.
2. **Teoría** — establece el marco conceptual.
3. **Quiz** — verifica comprensión básica.
4. **Matching** — consolida vocabulario/relaciones.
5. **Teoría** (opcional) — profundiza.
6. **V/F** — rompe mitos, consolida.
7. **Builder** — aplica, reflexiona.
8. **Sprint** — sintetiza todo aprendido bajo presión.
9. **Fin** — celebra.

### Cantidad de módulos por nivel

| Tipo de nivel | Módulos | XP sugerido |
|---|---|---|
| Corto (introducción) | 6–8 | 80–120 XP |
| Estándar | 10–14 | 150–200 XP |
| Profundo | 15–21 | 200–280 XP |

Los niveles existentes tienen entre 14 y 21 módulos. Para un nivel nuevo, empezar con 10–14.

### Regla del ritmo

Nunca poner dos módulos del mismo tipo seguidos. Alternar siempre:
- ❌ teoria → teoria → teoria
- ✅ teoria → quiz → teoria → matching

La excepción: dos teorías seguidas si la segunda es muy corta (2–3 oraciones).

### Coherencia temática

Todo el nivel debe girar alrededor de UN tema concreto. Ejemplos de temas buenos:
- "IA en medicina" ✅ (específico)
- "El futuro" ❌ (demasiado amplio)
- "Modelos de lenguaje y privacidad" ✅
- "Tecnología" ❌

### Calibrar el XP correctamente

El XP total del spec determina qué tan fácil/difícil es conseguir 3 estrellas:

| Porcentaje del xp_max | Estrellas |
|---|---|
| ≥ 67% | ★★★ |
| ≥ 40% | ★★ |
| ≥ 15% | ★ |
| < 15% | Sin estrella |

Si el nivel tiene 200 XP disponibles, el usuario necesita ganar 134 XP para 3 estrellas. Eso significa acertar la mayoría de quiz/matching/vf. Es el nivel correcto de dificultad.

---

## Errores comunes a evitar

### En el spec

| Error | Por qué falla | Corrección |
|---|---|---|
| `n: 36` cuando ya existe Level36 | El skill detecta el conflicto y para | Usar el siguiente número disponible |
| Correcta sin ✓ en quiz | El skill no sabe cuál es la respuesta | Agregar ` ✓` al final de la opción correcta |
| `→ VERDAD` en vf en lugar de `→ TRUE` | Solo acepta `TRUE`/`FALSE` en inglés | Usar TRUE/FALSE siempre |
| Olvidar `## fin` | El nivel no tiene pantalla de completado | Agregar siempre al final |
| `min:` demasiado alto (> 150) | Usuarios abandonan | Máximo 80 para builder, 60 para sprint |
| categoría en classify sin coincidir | El skill no puede mapear respuesta correcta | Copiar-pegar exacto el nombre de categoría |

### En la app (después de generar)

| Síntoma | Causa probable | Solución |
|---|---|---|
| Nivel no aparece en mapa | Faltó actualizar gameStore | Verificar que el skill incrementó versión; si no, resetear progreso en Configuración |
| Crash al abrir el nivel | Error de TypeScript no detectado | Revisar consola de Metro, corregir el archivo generado |
| Matching no shufflea | El spec tiene pares en orden muy obvio | No hay problema — es aleatorio en runtime |
| Estrellas siempre 3 | xp_max muy bajo comparado con módulos | Recalcular xp_max sumando todos los XP del spec |
| Sprint no termina | `duracion:` no está en el spec | Verificar que el campo existe con valor numérico |

---

## Ejemplo completo de spec funcional

Guardar como `niveles/nivel-37-ia-salud.md`:

```markdown
---
n: 37
nombre: "IA en Salud"
mundo: 7
icono: "🏥"
descripcion: "Cómo la inteligencia artificial transforma el diagnóstico y tratamiento médico"
xp_max: 175
---

## intro

La IA ya está en los hospitales. Detecta tumores en radiografías, predice
enfermedades antes de síntomas y diseña moléculas para nuevos medicamentos.
En este nivel vas a entender cómo funciona y qué significa para tu futuro.

---

## teoria | 10 XP
tag: 📖 Módulo 1 · Diagnóstico con IA
### La IA que ve lo que el ojo no ve

Los modelos de visión computacional analizan imágenes médicas —radiografías,
resonancias, histologías— pixel por pixel, buscando patrones que predicen
enfermedades. Fueron entrenados con millones de imágenes etiquetadas por
especialistas.

> InfoBox: El modelo CheXNet de Stanford detecta neumonía en radiografías
> con mayor precisión que el promedio de 4 radiólogos expertos.

---

## quiz | 15 XP
tag: 🎯 Módulo 2 · Quiz
### Diagnóstico por imagen

¿Qué problema resolvió AlphaFold de DeepMind en 2021?

- Detectar cáncer en estadio temprano
- Predecir la estructura 3D de proteínas ✓
- Transcribir historiales médicos automáticamente
- Optimizar turnos en quirófanos

> Feedback: El problema del plegamiento de proteínas llevaba 50 años sin
> solución. AlphaFold lo resolvió con un modelo de deep learning, desbloqueando
> una era nueva en diseño de fármacos. Sus creadores ganaron el Nobel 2024.

---

## matching | 20 XP
tag: 🔗 Módulo 3 · Herramientas de IA médica
### Conecta cada herramienta con su función

- Google AlphaFold → Predicción de estructura de proteínas
- IBM Watson Oncology → Análisis de opciones de tratamiento oncológico
- Microsoft InnerEye → Segmentación de tumores en imágenes 3D
- Babylon Health → Diagnóstico preliminar por síntomas vía chat

---

## vf | 15 XP
tag: ✔️ Módulo 4 · Mitos y realidades
### ¿Verdadero o Falso?

- La IA reemplazará completamente a los médicos en 10 años. → FALSE: La IA es una herramienta de asistencia. La responsabilidad legal y el juicio clínico seguirán siendo humanos.
- Los algoritmos médicos pueden tener sesgo racial. → TRUE: Modelos entrenados con datos mayoritariamente caucásicos rinden peor en otras etnias. Es un problema documentado y activo.
- Una IA aprobada por la FDA no puede cometer errores. → FALSE: La FDA evalúa que el beneficio supere el riesgo estadístico, no que sea infalible.
- La IA puede detectar Alzheimer antes de síntomas visibles. → TRUE: Modelos que analizan patrones de voz y escritura detectan señales cognitivas hasta 7 años antes del diagnóstico clínico.

---

## teoria | 0 XP
tag: 🌍 Módulo 5 · Casos reales
### Tres momentos que cambiaron la medicina con IA

**2016 — Google DeepMind y retinopatía diabética.** Un modelo detectó
ceguera prevenible en fondos de ojo con 94% de precisión, igualando a
oftalmólogos especialistas. Hoy opera en clínicas de India y Tailandia.

**2020 — IA y COVID-19.** En 72 horas, modelos de IA analizaron
millones de compuestos y propusieron candidatos a antivirales que los
humanos habrían tardado años en identificar.

**2024 — Nobel de Química.** Los creadores de AlphaFold recibieron el
Nobel por resolver el plegamiento de proteínas, abriendo una nueva era
en diseño de medicamentos.

---

## builder | 15 XP
tag: ✏️ Módulo 6 · Tu perspectiva
### Si supieras con 10 años de anticipación...

La IA ya puede detectar ciertos cánceres con hasta una década de antelación.
¿Querrías saber que vas a desarrollar una enfermedad grave? ¿Cómo cambiaría
tu vida? Escribe tu reflexión honesta.

min: 40

---

## classify | 15 XP
tag: ↕️ Módulo 7 · Clasifica el impacto
### ¿Beneficio, riesgo o neutral?

categorias: Beneficio | Riesgo | Neutral

- Diagnóstico de cáncer en estadio 0 → Beneficio
- Desempleo de técnicos radiólogos → Riesgo
- Mayor cantidad de datos médicos digitalizados → Neutral
- Sesgo algorítmico en pacientes de minorías étnicas → Riesgo
- Diseño de fármacos 10x más rápido → Beneficio
- Cambio en protocolos de formación médica → Neutral

---

## sprint | 20 XP
tag: ⚡ Módulo 8 · Sprint final
### 60 segundos: todo lo que sabes de IA en salud

Tienes 60 segundos. Escribe todos los usos, herramientas, impactos o
reflexiones sobre IA en medicina que recuerdes de este nivel.
¡Sin parar, sin editar, solo escribir!

duracion: 60
min: 50

---

## teoria | 0 XP
tag: 🔮 Módulo 9 · Lo que viene
### El hospital del futuro

En 2030, cada hospital tendrá IA integrada en cada paso: desde la
admisión hasta el seguimiento post-operatorio. El médico del futuro
no compite con la IA — la domina.

El próximo nivel explora cómo prepararte para ese mundo.

---

## fin
```

**XP total del spec:** 15 + 20 + 15 + 15 + 20 = **85 XP activos** de 175 declarados.

> Nota: Los módulos de teoría con 0 XP no contribuyen. Ajustar `xp_max: 85` para que las estrellas sean más realistas, o aumentar el XP de los módulos interactivos.

**Para generar este nivel:**
```
/project:new-level niveles/nivel-37-ia-salud.md
```

---

## Checklist antes de ejecutar el comando

- [ ] El número `n:` no existe aún (`ls src/levels/Level{N}.tsx` → no debe existir)
- [ ] `xp_max` coincide con la suma real de XP de los módulos interactivos
- [ ] Hay al menos un `## intro` y un `## fin`
- [ ] Cada `## quiz` tiene exactamente una opción con ` ✓`
- [ ] Cada `## vf` usa `TRUE` o `FALSE` en mayúsculas
- [ ] Los nombres de categorías en `classify` coinciden exactamente con las de `categorias:`
- [ ] Los módulos `teoria`, `quiz`, `matching`, `vf`, `builder`, `sprint`, `classify` tienen todos su `tag:` definido
- [ ] No hay dos módulos iguales consecutivos (ritmo alternado)
- [ ] El spec tiene sentido temático coherente de principio a fin

---

## Referencia rápida

```bash
# Ver niveles existentes
ls src/levels/Level*.tsx | sort -V

# Ejecutar el generador
/project:new-level ruta/spec.md

# Probar el nivel generado
npm run web

# Commit y deploy tras verificar
git add -A && git commit -m "feat(level): Level{N} — {nombre}"
nvm use 20 && npm run build:web && vercel --prod
```
