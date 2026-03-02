'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { Trash2, Loader2 } from 'lucide-react';
import type { NewsItemResponse, CollectionResult } from '@ai-sanomat/shared';

export default function NewsPage() {
  const [newsItems, setNewsItems] = useState<NewsItemResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [collecting, setCollecting] = useState(false);

  // Lomakkeen tila
  const [formUrl, setFormUrl] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formSummary, setFormSummary] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function loadNews() {
    try {
      const data = await apiFetch<NewsItemResponse[]>('/api/admin/news');
      setNewsItems(data);
    } catch (err) {
      console.error('Uutisten lataus epaonnistui:', err);
      toast.error('Uutisten lataus epaonnistui');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNews();
  }, []);

  async function handleAddNews(e: React.FormEvent) {
    e.preventDefault();
    if (!formUrl.trim()) return;

    setSubmitting(true);
    try {
      const body: Record<string, string> = { url: formUrl.trim() };
      if (formTitle.trim()) body.title = formTitle.trim();
      if (formSummary.trim()) body.summary = formSummary.trim();

      await apiFetch('/api/admin/news', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      toast.success('Uutinen lisatty');
      setFormUrl('');
      setFormTitle('');
      setFormSummary('');
      setShowAddForm(false);
      await loadNews();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lisays epaonnistui';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCollect() {
    setCollecting(true);
    try {
      const result = await apiFetch<CollectionResult>('/api/admin/news/collect', {
        method: 'POST',
      });
      toast.success(
        `Keratty ${result.collected} uutista ${result.sources} lahteesta` +
          (result.errors > 0 ? `, ${result.errors} virhetta` : '')
      );
      await loadNews();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Kerays epaonnistui';
      toast.error(message);
    } finally {
      setCollecting(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await apiFetch(`/api/admin/news/${id}`, { method: 'DELETE' });
      setNewsItems((prev) => prev.filter((item) => item.id !== id));
      toast.success('Uutinen poistettu');
    } catch {
      toast.error('Poistaminen epaonnistui');
    }
  }

  function formatDate(date: Date | string | null): string {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('fi-FI', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Uutiset</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleCollect}
            disabled={collecting}
          >
            {collecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Keraa uutiset
          </Button>
          <Button onClick={() => setShowAddForm(!showAddForm)}>
            {showAddForm ? 'Peruuta' : 'Lisaa uutinen'}
          </Button>
        </div>
      </div>

      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>Lisaa uutinen</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddNews} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="url">URL *</Label>
                <Input
                  id="url"
                  type="url"
                  placeholder="https://..."
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Otsikko (valinnainen)</Label>
                <Input
                  id="title"
                  placeholder="Uutisen otsikko"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="summary">Tiivistelma (valinnainen)</Label>
                <Input
                  id="summary"
                  placeholder="Lyhyt kuvaus"
                  value={formSummary}
                  onChange={(e) => setFormSummary(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={submitting}>
                {submitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Lisaa
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-muted-foreground">Ladataan...</p>
      ) : newsItems.length === 0 ? (
        <p className="text-muted-foreground">
          Ei uutisia. Keraa uutisia lahteista tai lisaa manuaalisesti.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Otsikko</TableHead>
              <TableHead>Julkaistu</TableHead>
              <TableHead>Keratty</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {newsItems.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                    title={item.title}
                  >
                    {truncate(item.title, 60)}
                  </a>
                  {!item.sourceId && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      Manuaalinen
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(item.publishedAt)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(item.collectedAt)}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
