export function formatNestError(err: any): string {
  const msg = err?.response?.data?.message
  if (Array.isArray(msg)) return msg.join(', ')
  if (typeof msg === 'string') return msg
  return err?.message ?? 'Error desconocido'
}