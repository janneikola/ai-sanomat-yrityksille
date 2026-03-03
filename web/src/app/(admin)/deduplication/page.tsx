'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api';

interface DuplicateItem {
  id: number;
  title: string;
  url: string;
  collectedAt: string;
  canonicalItemId: number | null;
  canonicalTitle: string | null;
  canonicalUrl: string | null;
  similarity: number | null;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fi-FI', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

export default function DeduplicationPage() {
  const [duplicates, setDuplicates] = useState<DuplicateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const loadDuplicates = useCallback(async () => {
    try {
      const data = await apiFetch<DuplicateItem[]>('/api/admin/deduplication');
      setDuplicates(data);
    } catch (err) {
      console.error('Duplikaattien lataus epaonnistui:', err);
      toast.error('Duplikaattien lataus epaonnistui');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDuplicates();
  }, [loadDuplicates]);

  async function handleProcess() {
    setProcessing(true);
    try {
      const result = await apiFetch<{ embedded: number; duplicatesFound: number }>(
        '/api/admin/deduplication/process',
        { method: 'POST' }
      );
      toast.success(
        `${result.embedded} uutista analysoitu, ${result.duplicatesFound} duplikaattia loydetty`
      );
      await loadDuplicates();
    } catch {
      toast.error('Deduplikoinnin kaynnistys epaonnistui');
    } finally {
      setProcessing(false);
    }
  }

  async function handleOverride(itemId: number) {
    if (!confirm('Poistetaanko duplikaattimerkinta?')) return;

    try {
      await apiFetch(`/api/admin/deduplication/${itemId}/override`, {
        method: 'POST',
      });
      setDuplicates((prev) => prev.filter((d) => d.id !== itemId));
      toast.success('Duplikaattimerkinta poistettu');
    } catch {
      toast.error('Merkkinnan poisto epaonnistui');
    }
  }

  function renderSimilarityBadge(similarity: number | null) {
    if (similarity === null) return '-';
    const percentage = Math.round(similarity * 100);

    if (percentage >= 95) {
      return (
        <Badge variant="destructive">
          {percentage}% Tarkka kopio
        </Badge>
      );
    }

    return (
      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
        {percentage}% Lahes kopio
      </Badge>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Duplikaattien hallinta</h1>
          <p className="text-muted-foreground">
            Semanttinen deduplikointi -- tarkista ja hallitse tunnistettuja duplikaatteja
          </p>
        </div>
        <Button onClick={handleProcess} disabled={processing}>
          {processing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Aja deduplikointi
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tunnistetut duplikaatit</CardTitle>
          <CardDescription>
            Semanttisesti samankaltaiset uutiset joilla on eri URL
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : duplicates.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Ei tunnistettuja duplikaatteja. Aja deduplikointi keruun jalkeen.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Uutinen</TableHead>
                  <TableHead>Alkuperainen</TableHead>
                  <TableHead className="text-center">Samankaltaisuus</TableHead>
                  <TableHead>Keratty</TableHead>
                  <TableHead>Toiminnot</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {duplicates.map((dup) => (
                  <TableRow key={dup.id}>
                    <TableCell className="max-w-xs">
                      <a
                        href={dup.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-start gap-1"
                      >
                        <span>{truncate(dup.title, 60)}</span>
                        <ExternalLink className="h-3 w-3 mt-1 shrink-0" />
                      </a>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      {dup.canonicalUrl ? (
                        <a
                          href={dup.canonicalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline flex items-start gap-1"
                        >
                          <span>{truncate(dup.canonicalTitle || '-', 50)}</span>
                          <ExternalLink className="h-3 w-3 mt-1 shrink-0" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {renderSimilarityBadge(dup.similarity)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDate(dup.collectedAt)}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOverride(dup.id)}
                      >
                        Ei duplikaatti
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
