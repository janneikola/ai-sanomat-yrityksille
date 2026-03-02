export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: HeadersInit = { ...options.headers };
  if (options.body) {
    (headers as Record<string, string>)['Content-Type'] = 'application/json';
  }

  const res = await fetch(path, {
    ...options,
    credentials: 'include',
    headers,
  });

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      // Portaalisivut ohjataan portaalin kirjautumissivulle
      const portalPaths = ['/tiimi', '/arkisto', '/portal'];
      const isPortal = portalPaths.some((p) => window.location.pathname.startsWith(p));
      window.location.href = isPortal ? '/portal/login' : '/login';
    }
    throw new Error('Istunto vanhentunut. Kirjaudu uudelleen sisään.');
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Pyyntö epäonnistui' }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}
