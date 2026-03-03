'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Send, RefreshCw, CheckCircle, AlertCircle, Calendar, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import type { ClientResponse } from '@ai-sanomat/shared';

interface Digest {
  id: number;
  clientId: number;
  weekNumber: number;
  year: number;
  status: string;
  generatedContent: string | null;
  validationReport: string | null;
  heroImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DigestListItem {
  id: number;
  clientId: number;
  weekNumber: number;
  year: number;
  status: string;
  createdAt: string;
}

function statusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'sent':
      return 'default';
    case 'approved':
      return 'secondary';
    case 'ready':
      return 'outline';
    case 'failed':
      return 'destructive';
    default:
      return 'secondary';
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'generating':
      return 'Generoidaan';
    case 'ready':
      return 'Valmis';
    case 'approved':
      return 'Hyvaksytty';
    case 'sent':
      return 'Lahetetty';
    case 'failed':
      return 'Epaonnistunut';
    default:
      return status;
  }
}

export default function ClientDetailPage() {
  const params = useParams();
  const clientId = Number(params.id);

  const [client, setClient] = useState<ClientResponse | null>(null);
  const [digest, setDigest] = useState<Digest | null>(null);
  const [loadingClient, setLoadingClient] = useState(true);
  const [loadingDigest, setLoadingDigest] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Schedule config state
  const [scheduleFrequency, setScheduleFrequency] = useState<'weekly' | 'biweekly' | 'monthly'>('weekly');
  const [scheduleDay, setScheduleDay] = useState<number>(1);
  const [scheduleBiweeklyWeek, setScheduleBiweeklyWeek] = useState<string | null>(null);
  const [schedulePaused, setSchedulePaused] = useState(true);
  const [savingSchedule, setSavingSchedule] = useState(false);

  const loadDigest = useCallback(async (issueId?: number) => {
    try {
      if (issueId) {
        const data = await apiFetch<Digest>(`/api/admin/digests/${issueId}`);
        setDigest(data);
      } else {
        const digests = await apiFetch<DigestListItem[]>('/api/admin/digests');
        const clientDigests = digests
          .filter((d) => d.clientId === clientId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        if (clientDigests.length > 0) {
          const data = await apiFetch<Digest>(`/api/admin/digests/${clientDigests[0].id}`);
          setDigest(data);
        }
      }
    } catch {
      // No digests yet -- that's fine
    } finally {
      setLoadingDigest(false);
    }
  }, [clientId]);

  useEffect(() => {
    async function loadClient() {
      try {
        const data = await apiFetch<ClientResponse>(`/api/admin/clients/${clientId}`);
        setClient(data);
        // Sync schedule state from server
        setScheduleFrequency(data.scheduleFrequency);
        setScheduleDay(data.scheduleDay);
        setScheduleBiweeklyWeek(data.scheduleBiweeklyWeek);
        setSchedulePaused(data.schedulePaused);
      } catch {
        toast.error('Asiakkaan lataus epaonnistui');
      } finally {
        setLoadingClient(false);
      }
    }

    loadClient();
    loadDigest();
  }, [clientId, loadDigest]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const result = await apiFetch<{ issueId: number; status: string }>(
        '/api/admin/digests/generate',
        {
          method: 'POST',
          body: JSON.stringify({ clientId }),
        }
      );
      toast.success('Katsaus generoitu');
      await loadDigest(result.issueId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generointi epaonnistui');
    } finally {
      setGenerating(false);
    }
  }

  async function handleApproveAndSend() {
    if (!digest) return;
    setSending(true);
    try {
      await apiFetch(`/api/admin/digests/${digest.id}/approve`, { method: 'POST' });
      const result = await apiFetch<{ sent: number; issueId: number }>(
        `/api/admin/digests/${digest.id}/send`,
        { method: 'POST' }
      );
      toast.success(`Katsaus lahetetty ${result.sent} vastaanottajalle`);
      await loadDigest(digest.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lahetys epaonnistui');
    } finally {
      setSending(false);
    }
  }

  async function handleSend() {
    if (!digest) return;
    setSending(true);
    try {
      const result = await apiFetch<{ sent: number; issueId: number }>(
        `/api/admin/digests/${digest.id}/send`,
        { method: 'POST' }
      );
      toast.success(`Katsaus lahetetty ${result.sent} vastaanottajalle`);
      await loadDigest(digest.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lahetys epaonnistui');
    } finally {
      setSending(false);
    }
  }

  async function handleRegenerate() {
    if (!digest) return;
    setRegenerating(true);
    try {
      const result = await apiFetch<{ issueId: number; status: string }>(
        `/api/admin/digests/${digest.id}/regenerate`,
        { method: 'POST' }
      );
      toast.success('Katsaus generoitu uudelleen');
      await loadDigest(result.issueId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Uudelleengenerointi epaonnistui');
    } finally {
      setRegenerating(false);
    }
  }

  const DAY_NAMES = ['Sunnuntai', 'Maanantai', 'Tiistai', 'Keskiviikko', 'Torstai', 'Perjantai', 'Lauantai'];

  async function handleSaveSchedule() {
    setSavingSchedule(true);
    try {
      const updated = await apiFetch<ClientResponse>(
        `/api/admin/clients/${clientId}/schedule`,
        {
          method: 'PUT',
          body: JSON.stringify({
            scheduleFrequency,
            scheduleDay,
            scheduleBiweeklyWeek: scheduleFrequency === 'biweekly' ? scheduleBiweeklyWeek : null,
            schedulePaused,
          }),
        }
      );
      setClient(updated);
      toast.success('Aikataulu tallennettu');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Aikataulun tallennus epaonnistui');
    } finally {
      setSavingSchedule(false);
    }
  }

  async function handleTogglePause() {
    const newPaused = !schedulePaused;
    setSavingSchedule(true);
    try {
      const updated = await apiFetch<ClientResponse>(
        `/api/admin/clients/${clientId}/schedule`,
        {
          method: 'PUT',
          body: JSON.stringify({ schedulePaused: newPaused }),
        }
      );
      setClient(updated);
      setSchedulePaused(newPaused);
      toast.success(newPaused ? 'Aikataulu pysaytetty' : 'Aikataulu jatkettu');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Tilamuutos epaonnistui');
    } finally {
      setSavingSchedule(false);
    }
  }

  function formatNextDate(dateStr: string | null): string {
    if (!dateStr) return 'Pysaytetty';
    const d = new Date(dateStr);
    return d.toLocaleDateString('fi-FI', { weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' });
  }

  if (loadingClient) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Ladataan...
      </div>
    );
  }

  if (!client) {
    return (
      <div className="space-y-4">
        <Link href="/clients" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Takaisin
        </Link>
        <p className="text-destructive">Asiakasta ei loytynyt.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link href="/clients" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Takaisin
      </Link>

      {/* Client info header */}
      <div>
        <h1 className="text-2xl font-bold">{client.name}</h1>
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span>Toimiala: {client.industry}</span>
          <span>Yhteystieto: {client.contactEmail}</span>
          <Badge variant={client.plan === 'ai_teams' ? 'default' : 'secondary'}>
            {client.plan === 'ai_pulse' ? 'AI Pulse' : 'AI Teams'}
          </Badge>
        </div>
      </div>

      {/* Digest generation section */}
      <Card>
        <CardHeader>
          <CardTitle>Viikkokatsaus</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Generate button */}
          <div className="flex items-center gap-3">
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generoidaan katsausta...
                </>
              ) : (
                'Generoi katsaus'
              )}
            </Button>
          </div>

          {/* Latest digest info */}
          {loadingDigest ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Ladataan katsauksia...
            </div>
          ) : digest ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">
                  Viikko {digest.weekNumber}/{digest.year}
                </span>
                <Badge variant={statusBadgeVariant(digest.status)}>
                  {statusLabel(digest.status)}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(digest.createdAt).toLocaleDateString('fi-FI')}
                </span>
              </div>

              {/* Action buttons based on status */}
              <div className="flex items-center gap-2">
                {digest.status === 'ready' && (
                  <>
                    <Button onClick={handleApproveAndSend} disabled={sending}>
                      {sending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Lahetetaan...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          Hyvaksy ja laheta
                        </>
                      )}
                    </Button>
                    <Button variant="outline" onClick={handleRegenerate} disabled={regenerating}>
                      {regenerating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generoidaan...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Generoi uudelleen
                        </>
                      )}
                    </Button>
                  </>
                )}

                {digest.status === 'approved' && (
                  <>
                    <Button onClick={handleSend} disabled={sending}>
                      {sending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Lahetetaan...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          Laheta
                        </>
                      )}
                    </Button>
                    <Button variant="outline" onClick={handleRegenerate} disabled={regenerating}>
                      {regenerating ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      Generoi uudelleen
                    </Button>
                  </>
                )}

                {digest.status === 'sent' && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span>
                      Lahetetty {new Date(digest.updatedAt).toLocaleDateString('fi-FI')}{' '}
                      klo {new Date(digest.updatedAt).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}

                {digest.status === 'failed' && (
                  <>
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      <span>Generointi epaonnistui</span>
                    </div>
                    <Button variant="outline" onClick={handleRegenerate} disabled={regenerating}>
                      {regenerating ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      Generoi uudelleen
                    </Button>
                  </>
                )}
              </div>

              {/* Email preview iframe */}
              {(digest.status === 'ready' || digest.status === 'approved') && (
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">Esikatselu</h3>
                  <div className="overflow-hidden rounded-lg border">
                    <iframe
                      src={`/api/admin/digests/${digest.id}/preview`}
                      title="Sahkopostin esikatselu"
                      className="h-[800px] w-full border-0"
                    />
                  </div>
                </div>
              )}

              {/* Validation report */}
              {digest.validationReport && (
                <details className="rounded-lg border p-4">
                  <summary className="cursor-pointer text-sm font-medium">
                    Laaturaportti
                  </summary>
                  <pre className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
                    {typeof digest.validationReport === 'string'
                      ? digest.validationReport
                      : JSON.stringify(digest.validationReport, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Ei viela katsauksia. Generoi ensimmainen katsaus painamalla yllaolevaa painiketta.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Schedule config section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Aikataulu
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={schedulePaused ? 'secondary' : 'default'}>
                {schedulePaused ? 'Aikataulu pysaytetty' : 'Aikataulu aktiivinen'}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTogglePause}
                disabled={savingSchedule}
              >
                {schedulePaused ? (
                  <>
                    <Play className="mr-1 h-3 w-3" />
                    Jatka
                  </>
                ) : (
                  <>
                    <Pause className="mr-1 h-3 w-3" />
                    Pysayta
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Frequency */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Tiheys</label>
              <Select value={scheduleFrequency} onValueChange={(v) => setScheduleFrequency(v as 'weekly' | 'biweekly' | 'monthly')}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Viikoittain</SelectItem>
                  <SelectItem value="biweekly">Joka toinen viikko</SelectItem>
                  <SelectItem value="monthly">Kuukausittain</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Preferred day */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Paiva</label>
              <Select value={String(scheduleDay)} onValueChange={(v) => setScheduleDay(Number(v))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_NAMES.map((name, idx) => (
                    <SelectItem key={idx} value={String(idx)}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Biweekly week (only when biweekly) */}
            {scheduleFrequency === 'biweekly' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Viikko</label>
                <Select value={scheduleBiweeklyWeek ?? 'even'} onValueChange={setScheduleBiweeklyWeek}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="even">Parillinen viikko</SelectItem>
                    <SelectItem value="odd">Pariton viikko</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Next scheduled date */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Seuraava generointi:</span>
            <span className="font-medium">
              {formatNextDate(client.nextScheduledDate)}
            </span>
          </div>

          {/* Save button */}
          <Button onClick={handleSaveSchedule} disabled={savingSchedule}>
            {savingSchedule ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Tallennetaan...
              </>
            ) : (
              'Tallenna aikataulu'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
