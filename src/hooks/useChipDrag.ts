import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/**
 * Cablea arrastre HTML5 sobre chips y zonas ya renderizados, localizándolos por `nativeID`.
 *
 * **Complementa** el tap-para-colocar, no lo sustituye: los niveles deben soportar ambos
 * gestos. En móvil, `touchDragShim` (instalado una vez en `app/_layout.tsx`) traduce el
 * arrastre táctil a estos mismos eventos HTML5, así que cablear aquí cubre web y móvil.
 *
 * Convención de ids — el nivel debe renderizar:
 *   chips  → `{prefix}-chip-{itemId}`
 *   zonas  → `{prefix}-zone-{zoneId}`
 * con `{...({ nativeID: '…' } as any)}` sobre el `TouchableOpacity`.
 */
export function useChipDrag(opts: {
  /** Prefijo único por nivel/módulo, p. ej. 'l20'. */
  prefix: string;
  itemIds: string[];
  zoneIds: string[];
  /** Mapa itemId → zoneId de lo ya colocado; los chips colocados no se recablean. */
  placed: Record<string, string>;
  onDrop: (itemId: string, zoneId: string) => void;
  /** Desactiva el arrastre (p. ej. cuando el módulo ya se resolvió). */
  disabled?: boolean;
}) {
  const { prefix, itemIds, zoneIds, placed, onDrop, disabled } = opts;

  // Refs para que los listeners lean siempre el estado vigente sin recablearse por cada cambio.
  const placedRef = useRef(placed);
  useEffect(() => { placedRef.current = placed; }, [placed]);
  const onDropRef = useRef(onDrop);
  useEffect(() => { onDropRef.current = onDrop; }, [onDrop]);
  const dragIdRef = useRef<string | null>(null);

  const itemsKey = itemIds.join('|');
  const zonesKey = zoneIds.join('|');
  const placedKey = Object.keys(placed).sort().join('|');

  useEffect(() => {
    if (Platform.OS !== 'web' || disabled) return;
    const cleanups: Array<() => void> = [];

    // Pequeño retardo: los nodos deben existir en el DOM antes de buscarlos por id.
    const timer = setTimeout(() => {
      itemIds.forEach((id) => {
        if (placedRef.current[id] !== undefined) return; // ya colocado: no está en el banco
        const el = document.getElementById(`${prefix}-chip-${id}`);
        if (!el) return;
        el.setAttribute('draggable', 'true');
        el.style.cursor = 'grab';
        const start = (e: DragEvent) => {
          dragIdRef.current = id;
          if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            // Algunos navegadores exigen datos para iniciar el arrastre.
            try { e.dataTransfer.setData('text/plain', id); } catch { /* noop */ }
          }
        };
        const end = () => { dragIdRef.current = null; };
        el.addEventListener('dragstart', start);
        el.addEventListener('dragend', end);
        cleanups.push(() => {
          el.removeEventListener('dragstart', start);
          el.removeEventListener('dragend', end);
        });
      });

      zoneIds.forEach((zone) => {
        const el = document.getElementById(`${prefix}-zone-${zone}`);
        if (!el) return;
        // `dragover` DEBE llamar a preventDefault o el navegador no permite soltar.
        const over = (e: Event) => e.preventDefault();
        const drop = (e: Event) => {
          e.preventDefault();
          const id = dragIdRef.current;
          if (id === null || placedRef.current[id] !== undefined) return;
          onDropRef.current(id, zone);
          dragIdRef.current = null;
        };
        el.addEventListener('dragover', over);
        el.addEventListener('drop', drop);
        cleanups.push(() => {
          el.removeEventListener('dragover', over);
          el.removeEventListener('drop', drop);
        });
      });
    }, 60);

    return () => { clearTimeout(timer); cleanups.forEach((c) => c()); };
    // placedKey re-cablea cuando cambia QUÉ chips están en el banco.
  }, [prefix, itemsKey, zonesKey, placedKey, disabled]);
}
