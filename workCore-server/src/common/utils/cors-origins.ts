/**
 * Розбирає CORS_ORIGIN (кілька origin через кому) у масив.
 * WebSocket-шлюзи інакше отримували б один рядок "a,b" і не збігалися б
 * з жодним реальним origin.
 */
export function parseCorsOrigins(raw?: string): string[] {
  return (raw ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}
