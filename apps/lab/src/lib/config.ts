export function apiBase(value: string | undefined, pageProtocol = typeof location === 'undefined' ? 'https:' : location.protocol): string {
  if (!value) throw new Error('Set VITE_SENSOR_LAB_API to enable uploading. Local export and replay remain available.');
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || (pageProtocol === 'https:' && url.protocol !== 'https:')) throw new Error('Sensor Lab API must use HTTPS when the Lab uses HTTPS.');
  return url.href.replace(/\/$/, '');
}
