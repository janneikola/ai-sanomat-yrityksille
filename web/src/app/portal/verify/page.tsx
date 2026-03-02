'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState(false);

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError(true);
      return;
    }

    async function verify() {
      try {
        await apiFetch<{ success: boolean; redirectUrl: string }>(
          '/api/portal/verify',
          {
            method: 'POST',
            body: JSON.stringify({ token: searchParams.get('token') }),
          }
        );
        router.push('/tiimi');
      } catch {
        setError(true);
      }
    }

    verify();
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-xl">Kirjautuminen epaonnistui</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Kirjautumislinkki on vanhentunut tai virheellinen. Pyyda uusi
              linkki.
            </p>
            <Button asChild className="w-full">
              <Link href="/portal/login">Takaisin kirjautumiseen</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Card className="w-full max-w-sm">
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">Kirjaudutaan sisaan...</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PortalVerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <Card className="w-full max-w-sm">
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">Ladataan...</p>
            </CardContent>
          </Card>
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}
