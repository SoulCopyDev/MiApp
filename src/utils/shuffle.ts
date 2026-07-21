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

/**
 * Baraja garantizando que el resultado NO sea el orden de entrada.
 *
 * Para usar SOLO donde el orden **es** el ejercicio: módulos de ordenar, la columna
 * derecha de los de emparejar, y los rankers. En esos casos que salga el orden
 * original significa que el ejercicio aparece ya resuelto y basta pulsar «Verificar»:
 * el alumno no practica nada y además parece que la app está rota.
 *
 * Un barajado uniforme produce el orden original 1/n! de las veces, y con pocos
 * elementos eso NO es raro:
 *
 *   3 elementos → 16,7%   ·   4 → 4,2%   ·   5 → 0,8%   ·   6 → 0,1%
 *
 * El ranker de Level7 usa 3 elementos: 1 de cada 6 intentos salía ya ordenado.
 *
 * NO usar donde el orden es mera presentación (opciones de un quiz, orden de
 * escenarios, selección de pools): ahí el orden no revela la respuesta y forzar
 * que cambie solo introduce un sesgo innecesario — usar `shuffle`.
 */
export function shuffleDistinct<T>(arr: readonly T[], maxAttempts = 20): T[] {
  if (arr.length < 2) return [...arr];
  for (let i = 0; i < maxAttempts; i++) {
    const out = shuffle(arr);
    if (out.some((v, idx) => v !== arr[idx])) return out;
  }
  // Sin salida: todos los elementos son equivalentes (p. ej. array de valores repetidos),
  // así que no existe un orden distinto. Se devuelve un barajado normal en vez de colgarse.
  return shuffle(arr);
}
