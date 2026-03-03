'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, Search, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiFetch } from '@/lib/api';

interface SearchCacheEntry {
  id: number;
  query: string;
  resultCount: number;
  cachedAt: string;
  results: string;
}

interface WebSearchClient {
  id: number;
  name: string;
  industry: string;
  webSearchEnabled: boolean;
  searchPrompt: string | null;
  lastWebSearchAt: string | null;
  recentResults: SearchCacheEntry[];
}

interface SearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'juuri nyt';
  if (diffMin < 60) return `${diffMin} min sitten`;
  if (diffHours < 24) return `${diffHours} tuntia sitten`;
  return `${diffDays} paivaa sitten`;
}

export default function WebSearchPage() {
  const [clients, setClients] = useState<WebSearchClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggerLoading, setTriggerLoading] = useState<Record<number, boolean>>({});
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [editingPrompts, setEditingPrompts] = useState<Record<number, string>>({});

  const loadClients = useCallback(async () => {
    try {
      const data = await apiFetch<WebSearchClient[]>('/api/admin/web-search/clients');
      setClients(data);
    } catch (err) {
      console.error('Web search clients lataus epaonnistui:', err);
      toast.error('Asiakkaiden lataus epaonnistui');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  async function handleToggle(clientId: number, enabled: boolean) {
    try {
      await apiFetch(`/api/admin/web-search/${clientId}/config`, {
        method: 'PUT',
        body: JSON.stringify({ webSearchEnabled: enabled }),
      });
      setClients((prev) =>
        prev.map((c) => (c.id === clientId ? { ...c, webSearchEnabled: enabled } : c))
      );
      toast.success(enabled ? 'Verkkohaku kaytetty kayttoon' : 'Verkkohaku poistettu kaytosta');
    } catch {
      toast.error('Asetuksen paivitys epaonnistui');
    }
  }

  async function handlePromptSave(clientId: number) {
    const prompt = editingPrompts[clientId];
    if (prompt === undefined) return;

    try {
      await apiFetch(`/api/admin/web-search/${clientId}/config`, {
        method: 'PUT',
        body: JSON.stringify({ searchPrompt: prompt || null }),
      });
      setClients((prev) =>
        prev.map((c) => (c.id === clientId ? { ...c, searchPrompt: prompt || null } : c))
      );
      setEditingPrompts((prev) => {
        const next = { ...prev };
        delete next[clientId];
        return next;
      });
      toast.success('Hakukysely paivitetty');
    } catch {
      toast.error('Hakukyselyn paivitys epaonnistui');
    }
  }

  async function handleTrigger(clientId: number) {
    setTriggerLoading((prev) => ({ ...prev, [clientId]: true }));
    try {
      const result = await apiFetch<{ collected: number; queries: number; cached: number }>(
        `/api/admin/web-search/${clientId}/trigger`,
        { method: 'POST' }
      );
      toast.success(
        `${result.collected} uutta uutista loydetty (${result.queries} hakua, ${result.cached} valimuistista)`
      );
      await loadClients();
    } catch {
      toast.error('Verkkohaun kaynnistys epaonnistui');
    } finally {
      setTriggerLoading((prev) => ({ ...prev, [clientId]: false }));
    }
  }

  function toggleExpanded(clientId: number) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) {
        next.delete(clientId);
      } else {
        next.add(clientId);
      }
      return next;
    });
  }

  function getRecentResultCount(client: WebSearchClient): number {
    return client.recentResults.reduce((sum, r) => sum + r.resultCount, 0);
  }

  function parseResults(resultsJson: string): SearchResult[] {
    try {
      return JSON.parse(resultsJson) as SearchResult[];
    } catch {
      return [];
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Verkkohaku</h1>
        <p className="text-muted-foreground">
          Tavily-verkkohaku asiakaskohtaisilla hakukyselyilla
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Asiakkaat</CardTitle>
          <CardDescription>
            Hallitse asiakaskohtaisia verkkohakuasetuksia ja kaynnista hakuja manuaalisesti
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : clients.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Ei asiakkaita</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Asiakas</TableHead>
                  <TableHead>Toimiala</TableHead>
                  <TableHead className="text-center">Haku</TableHead>
                  <TableHead>Hakukysely</TableHead>
                  <TableHead>Viimeisin haku</TableHead>
                  <TableHead className="text-center">Tulokset</TableHead>
                  <TableHead>Toiminnot</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => {
                  const isExpanded = expandedRows.has(client.id);
                  const allResults = client.recentResults.flatMap((r) => parseResults(r.results));

                  return (
                    <>
                      <TableRow key={client.id}>
                        <TableCell>
                          <button
                            onClick={() => toggleExpanded(client.id)}
                            className="p-1 hover:bg-muted rounded"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        </TableCell>
                        <TableCell className="font-medium">{client.name}</TableCell>
                        <TableCell>{client.industry}</TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={client.webSearchEnabled}
                            onCheckedChange={(checked) => handleToggle(client.id, checked)}
                          />
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <Input
                            placeholder={`AI ${client.industry} news`}
                            value={
                              editingPrompts[client.id] !== undefined
                                ? editingPrompts[client.id]
                                : client.searchPrompt || ''
                            }
                            onChange={(e) =>
                              setEditingPrompts((prev) => ({ ...prev, [client.id]: e.target.value }))
                            }
                            onBlur={() => handlePromptSave(client.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handlePromptSave(client.id);
                            }}
                            className="text-sm"
                          />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatRelativeTime(client.lastWebSearchAt)}
                        </TableCell>
                        <TableCell className="text-center">
                          {getRecentResultCount(client)}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleTrigger(client.id)}
                            disabled={triggerLoading[client.id]}
                          >
                            {triggerLoading[client.id] ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Search className="mr-2 h-4 w-4" />
                            )}
                            Hae nyt
                          </Button>
                        </TableCell>
                      </TableRow>

                      {isExpanded && allResults.length > 0 && (
                        <TableRow key={`${client.id}-results`}>
                          <TableCell colSpan={8} className="bg-muted/50 p-4">
                            <div className="space-y-2">
                              <p className="text-sm font-medium">Viimeisimmat tulokset</p>
                              <ul className="space-y-1">
                                {allResults.slice(0, 10).map((result, i) => (
                                  <li key={i} className="text-sm flex items-start gap-2">
                                    <ExternalLink className="h-3 w-3 mt-1 shrink-0 text-muted-foreground" />
                                    <a
                                      href={result.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:underline break-all"
                                    >
                                      {result.title}
                                    </a>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}

                      {isExpanded && allResults.length === 0 && (
                        <TableRow key={`${client.id}-empty`}>
                          <TableCell colSpan={8} className="bg-muted/50 p-4">
                            <p className="text-sm text-muted-foreground">
                              Ei hakutuloksia. Kaynnista haku painamalla &quot;Hae nyt&quot;.
                            </p>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
