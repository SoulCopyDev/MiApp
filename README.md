# AI Explorer — curso gamificado de IA para menores (9–17)

> ⚠️ **ESTE REPO ES EL PROYECTO PARA MENORES DE EDAD.**
> Hay un segundo proyecto, independiente, dirigido a adultos 18+. **No viven en el mismo repo.** Ver [§ Los dos proyectos](#los-dos-proyectos).

App móvil y web (React Native + Expo) que enseña a usar IA de forma productiva mediante niveles gamificados: 6 mundos · 36 niveles · 7 evaluaciones. Sin backend, 100% offline, progreso en el dispositivo.

**Producción:** https://mi-app-kappa-navy.vercel.app

---

## Los dos proyectos

| | **AI Explorer** (este repo) | **Proyecto adulto** |
|---|---|---|
| Audiencia | 9–17 años | 18+ · profesionales y universitarios |
| Repo | `SoulCopyDev/MiApp` | Repo separado — *marca por definir* |
| Estado | **Congelado** · auditado y funcional | En diseño |
| Enfoque | Alfabetización en IA, escuela, familia | Uso profesional: investigación, trabajo, productividad |
| Herramientas que enseña | Solo las que permiten menores | Catálogo completo |

### Por qué están separados

No es preferencia organizativa, es una restricción real: **las herramientas de IA tienen edades mínimas incompatibles entre sí.**

- **Claude — 18+ sin excepciones.** No existe cuenta parental ni modo supervisado ([política de Anthropic](https://support.claude.com/en/articles/13117299-minimum-age-requirement-access-restriction))
- **Google Flow / Veo — 18+** y requiere suscripción de pago
- **Runway — 18+**
- **ChatGPT — 13+** con cuenta parental vinculada
- **Gemini — 13+**, o menores vía Family Link

Un curso para menores **no puede** instruir la creación de cuentas donde están prohibidos: es riesgo legal para el operador y le enseña al estudiante a mentir sobre su edad justo mientras el mundo 1 le enseña ética.

Por eso el producto adulto no es "el mismo curso con otro tono" — enseña un catálogo de herramientas distinto.

---

## Estado de este repo

**Congelado.** El contenido está auditado nivel por nivel y es fiel a los prototipos de diseño. Hay trabajo de actualización de contenido diagnosticado pero **no ejecutado**:

| Documento | Qué contiene |
|---|---|
| [`AUDIT-CONTENIDO.md`](./AUDIT-CONTENIDO.md) | Inventario de obsolescencia · 43 niveles · panorama verificado |
| [`LEARNING-PATH-v3.md`](./LEARNING-PATH-v3.md) | Propuesta de renovación de contenido — **pendiente de aprobación** |
| [`CLAUDE.md`](./CLAUDE.md) | Referencia técnica completa: stack, arquitectura, store, convenciones |

Antes de retomar este proyecto, leer los tres en ese orden.

> **Pendiente conocido:** los HTML prototipo usan el nombre viejo *"AI Expert"*. Debe corregirse a *"IA Explorer"* para no colisionar con la marca del producto adulto.

---

## Arranque rápido

```bash
nvm use 20        # expo export falla en Node 18
npm install
npm start         # dev con QR
npm run web       # dev web
npm run build:web # → dist/
```

Node 20+ obligatorio. Detalle completo de scripts, deploy y arquitectura en [`CLAUDE.md`](./CLAUDE.md).

---

## Arquitectura en una línea

Monolito Expo Router (file-based routing en `app/`) + un único store Zustand persistido en AsyncStorage (`src/store/gameStore.ts`). Cada nivel es un componente autónomo en `src/levels/Level{N}.tsx`. Sin servidor, sin API externa, sin base de datos.

**Al añadir niveles o mundos hay que incrementar `version` en el `persist` del store** — dispara la migración que preserva el progreso del usuario.
