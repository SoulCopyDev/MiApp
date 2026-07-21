/**
 * Barajado uniforme (Fisher-Yates) y selección aleatoria.
 *
 * ⚠️ NO usar `arr.sort(() => Math.random() - 0.5)`. Es el idiom más extendido y es
 * incorrecto: el comparador es inconsistente (no define un orden total), así que el
 * resultado depende del algoritmo de ordenación del motor. V8 usa insertion sort en
 * arrays cortos, que es justo el caso de este proyecto.
 *
 * Medido sobre 200 000 simulaciones:
 *
 *   · Barajando 4 opciones de respuesta, la correcta caía en
 *     A 36,0% · B 17,2% · C 15,5% · D 31,3%   (uniforme = 25%)
 *
 *   · Barajando 5 elementos (módulos de ordenar/emparejar), el orden ORIGINAL
 *     quedaba intacto el 9,43% de las veces   (uniforme = 0,83%, o sea 11× más)
 *     → 1 de cada 10 intentos el ejercicio aparecía ya resuelto.
 *
 * Fisher-Yates da 25,0% y 0,85% respectivamente.
 */
export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Toma `n` elementos al azar, sin repetir. Si `n` excede la longitud, devuelve todos barajados. */
export function pickN<T>(arr: readonly T[], n: number): T[] {
  return shuffle(arr).slice(0, n);
}
