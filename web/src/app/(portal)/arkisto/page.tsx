'use client';

import { useEffect, useState } from 'react';
import { Archive } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';

interface Issue {
  id: number;
  weekNumber: number;
  year: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('fi-FI', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  });
}

export default function ArkistoPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Issue[]>('/api/portal/archive')
      .then(setIssues)
      .catch(() => {
        toast.error('Arkiston lataaminen epaonnistui');
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Archive className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Uutiskirjearkisto</h1>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Ladataan arkistoa...</p>
      ) : issues.length === 0 ? (
        <p className="text-muted-foreground">
          Ei lahetettyja uutiskirjeita.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {issues.map((issue) => (
            <Card key={issue.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">
                  Viikko {issue.weekNumber}/{issue.year}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Lahetetty {formatDate(issue.updatedAt)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
