/**
 * Shim de arrastre táctil → HTML5 Drag & Drop.
 *
 * Problema: en móvil, el arrastre nativo de HTML5 (`draggable="true"` + eventos
 * `dragstart`/`dragover`/`drop`) exige mantener el chip presionado unos segundos
 * (long-press) antes de poder moverlo. Mala UX.
 *
 * Solución (sin tocar ningún nivel): este shim escucha los eventos táctiles a nivel
 * de `document` y, apenas el dedo se mueve unos píxeles sobre un elemento
 * `draggable="true"`, sintetiza y despacha los eventos de arrastre HTML5 reales
 * (`dragstart`, `dragenter`, `dragover`, `drop`, `dragend`) sobre los mismos
 * elementos. Como los niveles ya registran sus listeners de drag con `addEventListener`,
 * el arrastre empieza al primer toque, con un "fantasma" que sigue el dedo.
 *
 * - En escritorio (mouse) NO interviene: sigue el arrastre nativo tal cual.
 * - Un toque SIN mover (por debajo del umbral) no inicia arrastre → el `onPress`
 *   del chip se dispara normal, así el "tocar para seleccionar → tocar la caja"
 *   (tap-para-colocar) sigue funcionando igual.
 */

let installed = false;

function makeDataTransfer() {
  const store: Record<string, string> = {};
  return {
    effectAllowed: 'move',
    dropEffect: 'move',
    types: [] as string[],
    files: [] as unknown[],
    items: [] as unknown[],
    setData: (type: string, val: string) => { store[type] = String(val); },
    getData: (type: string) => store[type] ?? '',
    clearData: () => { for (const k of Object.keys(store)) delete store[k]; },
    setDragImage: () => { /* no-op: usamos nuestro propio fantasma */ },
  };
}

function fireDrag(el: EventTarget, type: string, dataTransfer: unknown, clientX: number, clientY: number) {
  const ev = new Event(type, { bubbles: true, cancelable: true }) as Event & Record<string, unknown>;
  ev.dataTransfer = dataTransfer;
  ev.clientX = clientX;
  ev.clientY = clientY;
  el.dispatchEvent(ev);
  return ev;
}

export function installTouchDragShim(): void {
  if (installed || typeof document === 'undefined' || typeof window === 'undefined') return;
  installed = true;

  const THRESHOLD = 6; // px que debe moverse el dedo para considerar que es un arrastre (y no un toque)

  let source: HTMLElement | null = null;   // chip draggable bajo el dedo (o null)
  let dragging = false;
  let dataTransfer: ReturnType<typeof makeDataTransfer> | null = null;
  let ghost: HTMLElement | null = null;
  let lastOver: Element | null = null;
  let startX = 0, startY = 0;

  const findDraggable = (el: Element | null): HTMLElement | null => {
    let n: Element | null = el;
    while (n && n !== document.body) {
      if (n instanceof HTMLElement && n.getAttribute('draggable') === 'true') return n;
      n = n.parentElement;
    }
    return null;
  };

  const cleanup = () => {
    if (ghost) { ghost.remove(); ghost = null; }
    if (source) source.style.opacity = '';
    source = null;
    dragging = false;
    dataTransfer = null;
    lastOver = null;
  };

  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) { cleanup(); return; }
    const t = e.touches[0];
    source = findDraggable(document.elementFromPoint(t.clientX, t.clientY));
    dragging = false;
    startX = t.clientX;
    startY = t.clientY;
  };

  const onTouchMove = (e: TouchEvent) => {
    if (!source || e.touches.length !== 1) return;
    const t = e.touches[0];

    if (!dragging) {
      if (Math.abs(t.clientX - startX) < THRESHOLD && Math.abs(t.clientY - startY) < THRESHOLD) return;
      // Iniciar arrastre
      dragging = true;
      dataTransfer = makeDataTransfer();
      fireDrag(source, 'dragstart', dataTransfer, t.clientX, t.clientY);
      // Fantasma que sigue el dedo
      const rect = source.getBoundingClientRect();
      ghost = source.cloneNode(true) as HTMLElement;
      const g = ghost.style;
      g.position = 'fixed';
      g.left = `${t.clientX}px`;
      g.top = `${t.clientY}px`;
      g.width = `${rect.width}px`;
      g.margin = '0';
      g.transform = 'translate(-50%, -50%)';
      g.pointerEvents = 'none';
      g.opacity = '0.92';
      g.zIndex = '99999';
      document.body.appendChild(ghost);
      source.style.opacity = '0.35';
    }

    // Ya arrastrando: evitar scroll y mover el fantasma
    e.preventDefault();
    if (ghost) { ghost.style.left = `${t.clientX}px`; ghost.style.top = `${t.clientY}px`; }

    const over = document.elementFromPoint(t.clientX, t.clientY);
    if (over !== lastOver) {
      if (lastOver) fireDrag(lastOver, 'dragleave', dataTransfer, t.clientX, t.clientY);
      if (over) fireDrag(over, 'dragenter', dataTransfer, t.clientX, t.clientY);
      lastOver = over;
    }
    if (over) fireDrag(over, 'dragover', dataTransfer, t.clientX, t.clientY);
  };

  const onTouchEnd = (e: TouchEvent) => {
    if (!source) return;
    if (dragging) {
      const t = e.changedTouches[0];
      const over = document.elementFromPoint(t.clientX, t.clientY);
      if (over) fireDrag(over, 'drop', dataTransfer, t.clientX, t.clientY);
      fireDrag(source, 'dragend', dataTransfer, t.clientX, t.clientY);
      // Evita el "click fantasma" que el navegador genera tras el touch (dispararía el tap-para-colocar)
      e.preventDefault();
    }
    cleanup();
  };

  const onTouchCancel = () => {
    if (source && dragging) fireDrag(source, 'dragend', dataTransfer, startX, startY);
    cleanup();
  };

  document.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
  document.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
  document.addEventListener('touchend', onTouchEnd, { passive: false, capture: true });
  document.addEventListener('touchcancel', onTouchCancel, { passive: true, capture: true });
}
