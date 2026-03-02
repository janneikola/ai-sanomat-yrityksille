const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new Error('Istunto vanhentunut. Kirjaudu uudelleen sisään.');
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Pyyntö epäonnistui' }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}
