'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Send, RefreshCw, CheckCircle, AlertCircle, Calendar, Pause, Play, Users, Trash2, Plus, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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

interface Member {
  id: number;
  email: string;
  name: string | null;
  isActive: boolean;
  isBounced: boolean;
}

interface BulkResult {
  added: number;
  reactivated: number;
  skipped: number;
  invalid: string[];
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

  // Members state
  const [membersList, setMembersList] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [addMemberEmail, setAddMemberEmail] = useState('');
  const [addMemberName, setAddMemberName] = useState('');
  const [addMemberLoading, setAddMemberLoading] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkEmails, setBulkEmails] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);

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

  const fetchMembers = useCallback(async () => {
    try {
      const data = await apiFetch<Member[]>(`/api/admin/clients/${clientId}/members`);
      setMembersList(data);
    } catch {
      toast.error('Vastaanottajien lataaminen epaonnistui');
    } finally {
      setLoadingMembers(false);
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
    fetchMembers();
  }, [clientId, loadDigest, fetchMembers]);

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

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    setAddMemberLoading(true);
    try {
      await apiFetch(`/api/admin/clients/${clientId}/members`, {
        method: 'POST',
        body: JSON.stringify({
          email: addMemberEmail,
          name: addMemberName || undefined,
        }),
      });
      toast.success('Vastaanottaja lisatty');
      setAddMemberOpen(false);
      setAddMemberEmail('');
      setAddMemberName('');
      await fetchMembers();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Vastaanottajan lisaaminen epaonnistui';
      if (message.includes('jo lisatty') || message.includes('409')) {
        toast.error('Sahkoposti on jo lisatty');
      } else {
        toast.error(message);
      }
    } finally {
      setAddMemberLoading(false);
    }
  }

  async function handleBulkImport(e: React.FormEvent) {
    e.preventDefault();
    setBulkLoading(true);
    try {
      const result = await apiFetch<BulkResult>(`/api/admin/clients/${clientId}/members/bulk`, {
        method: 'POST',
        body: JSON.stringify({ emails: bulkEmails }),
      });

      const parts: string[] = [];
      if (result.added > 0) parts.push(`Lisatty: ${result.added}`);
      if (result.reactivated > 0) parts.push(`Uudelleenaktivoitu: ${result.reactivated}`);
      if (result.skipped > 0) parts.push(`Ohitettu: ${result.skipped}`);

      toast.success(parts.join(', ') || 'Ei muutoksia');

      if (result.invalid.length > 0) {
        toast.error(`Virheelliset: ${result.invalid.join(', ')}`);
      }

      setBulkOpen(false);
      setBulkEmails('');
      await fetchMembers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Tuonti epaonnistui');
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleRemoveMember() {
    if (!removeTarget) return;
    setRemoveLoading(true);
    try {
      await apiFetch(`/api/admin/clients/${clientId}/members/${removeTarget.id}`, {
        method: 'PATCH',
      });
      toast.success('Vastaanottaja poistettu');
      setRemoveTarget(null);
      await fetchMembers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Poistaminen epaonnistui');
    } finally {
      setRemoveLoading(false);
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

      {/* Tabbed sections */}
      <Tabs defaultValue="digest" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="digest">Viikkokatsaus</TabsTrigger>
          <TabsTrigger value="schedule">Aikataulu</TabsTrigger>
          <TabsTrigger value="members">
            Vastaanottajat
            <Badge variant="secondary" className="ml-2">{membersList.filter((m) => m.isActive).length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="digest">
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

        </TabsContent>

        <TabsContent value="schedule">
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

        </TabsContent>

        <TabsContent value="members">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Vastaanottajat
            </CardTitle>
            <div className="flex gap-2">
              {/* Add single member dialog */}
              <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Lisaa vastaanottaja
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Lisaa uusi vastaanottaja</DialogTitle>
                    <DialogDescription>
                      Syota uuden vastaanottajan sahkopostiosoite.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddMember} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="member-email">Sahkoposti</Label>
                      <Input
                        id="member-email"
                        type="email"
                        placeholder="matti@yritys.fi"
                        value={addMemberEmail}
                        onChange={(e) => setAddMemberEmail(e.target.value)}
                        required
                        disabled={addMemberLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="member-name">Nimi (valinnainen)</Label>
                      <Input
                        id="member-name"
                        type="text"
                        placeholder="Matti Meikalainen"
                        value={addMemberName}
                        onChange={(e) => setAddMemberName(e.target.value)}
                        disabled={addMemberLoading}
                      />
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={addMemberLoading}>
                        {addMemberLoading ? 'Lisataan...' : 'Lisaa vastaanottaja'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>

              {/* Bulk import dialog */}
              <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Upload className="h-4 w-4 mr-1" />
                    Tuo useita
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Tuo useita vastaanottajia</DialogTitle>
                    <DialogDescription>
                      Syota sahkopostiosoitteet pilkulla erotettuna.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleBulkImport} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="bulk-emails">Sahkopostiosoitteet</Label>
                      <Textarea
                        id="bulk-emails"
                        placeholder={'Syota sahkopostiosoitteet pilkulla erotettuna\nesim. matti@yritys.fi, maija@yritys.fi'}
                        value={bulkEmails}
                        onChange={(e) => setBulkEmails(e.target.value)}
                        required
                        disabled={bulkLoading}
                        rows={4}
                      />
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={bulkLoading}>
                        {bulkLoading ? 'Tuodaan...' : 'Tuo vastaanottajat'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingMembers ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Ladataan vastaanottajia...
            </div>
          ) : membersList.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ei vastaanottajia. Lisaa ensimmainen vastaanottaja.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sahkoposti</TableHead>
                    <TableHead>Nimi</TableHead>
                    <TableHead>Tila</TableHead>
                    <TableHead className="w-[100px]">Toiminnot</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {membersList.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">{member.email}</TableCell>
                      <TableCell>{member.name ?? '-'}</TableCell>
                      <TableCell>
                        {!member.isActive ? (
                          <Badge variant="secondary">Poistettu</Badge>
                        ) : member.isBounced ? (
                          <Badge variant="destructive">Palautunut</Badge>
                        ) : (
                          <Badge className="bg-green-600 text-white hover:bg-green-700">
                            Aktiivinen
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {member.isActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setRemoveTarget(member)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

        </TabsContent>
      </Tabs>

      {/* Remove member confirmation dialog */}
      <Dialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Poista vastaanottaja</DialogTitle>
            <DialogDescription>
              Haluatko varmasti poistaa vastaanottajan{' '}
              <span className="font-semibold">{removeTarget?.email}</span>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRemoveTarget(null)}
              disabled={removeLoading}
            >
              Peruuta
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemoveMember}
              disabled={removeLoading}
            >
              {removeLoading ? 'Poistetaan...' : 'Poista'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
