/**
 * Identificadores locais. `crypto.randomUUID` existe em todo navegador que
 * suporta os recursos usados aqui; o fallback cobre contexto não seguro
 * (abrir o `dist` por `file://`, por exemplo), onde a API fica indisponível.
 */
export function createId(prefix = ''): string {
  const uuid =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

  return prefix ? `${prefix}_${uuid}` : uuid
}

/** Normaliza um rótulo livre em identificador estável de categoria. */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
