'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';

export default function PortalLoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      await apiFetch('/api/portal/login', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setSubmitted(true);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Verkkovirhe. Yrita uudelleen.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">AI-Sanomat</CardTitle>
          <CardDescription>Yritysportaali</CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Jos tama sahkoposti on rekisteroity, saat kirjautumislinkin
                sahkopostiisi.
              </p>
              <Button
                variant="ghost"
                className="text-sm"
                onClick={() => {
                  setSubmitted(false);
                  setEmail('');
                }}
              >
                Lahetä uusi linkki
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Sahkoposti</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="matti@yritys.fi"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Lahetetaan...' : 'Laheta kirjautumislinkki'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
