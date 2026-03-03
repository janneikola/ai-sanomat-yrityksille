'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Users, Newspaper, FileText, Clock } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface DashboardStats {
  clients: number;
  sources: number;
  templates: number;
}

interface DeliveryStatsItem {
  clientId: number;
  clientName: string;
  teamSize: number;
  latestSend: string | null;
  openRate: number | null;
  nextScheduledDate: string | null;
  scheduleFrequency: string;
  schedulePaused: boolean;
}

interface SchedulerRun {
  id: number;
  startedAt: string;
  completedAt: string | null;
  clientsProcessed: number;
  successes: number;
  failures: number;
  skips: number;
  notes: string | null;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({ clients: 0, sources: 0, templates: 0 });
  const [deliveryStats, setDeliveryStats] = useState<DeliveryStatsItem[]>([]);
  const [schedulerRuns, setSchedulerRuns] = useState<SchedulerRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [deliveryLoading, setDeliveryLoading] = useState(true);
  const [runsLoading, setRunsLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const [clients, sources, templates] = await Promise.all([
          apiFetch<{ id: number }[]>('/api/admin/clients'),
          apiFetch<{ id: number }[]>('/api/admin/sources'),
          apiFetch<{ id: number }[]>('/api/admin/templates'),
        ]);
        setStats({
          clients: clients.length,
          sources: sources.length,
          templates: templates.length,
        });
      } catch {
        // Stats will remain at 0 if loading fails
      } finally {
        setLoading(false);
      }
    }

    async function loadDeliveryStats() {
      try {
        const data = await apiFetch<DeliveryStatsItem[]>('/api/admin/dashboard/stats');
        // Sort by latest send date (most recent first), clients with no sends last
        const sorted = [...data].sort((a, b) => {
          if (!a.latestSend && !b.latestSend) return 0;
          if (!a.latestSend) return 1;
          if (!b.latestSend) return -1;
          return new Date(b.latestSend).getTime() - new Date(a.latestSend).getTime();
        });
        setDeliveryStats(sorted);
      } catch {
        // Delivery stats will remain empty if loading fails
      } finally {
        setDeliveryLoading(false);
      }
    }

    async function loadSchedulerRuns() {
      try {
        const data = await apiFetch<SchedulerRun[]>('/api/admin/dashboard/scheduler-runs');
        setSchedulerRuns(data);
      } catch {
        // Scheduler runs will remain empty if loading fails
      } finally {
        setRunsLoading(false);
      }
    }

    loadStats();
    loadDeliveryStats();
    loadSchedulerRuns();
  }, []);

  const cards = [
    { title: 'Asiakkaat', value: stats.clients, icon: Users },
    { title: 'Uutislahteet', value: stats.sources, icon: Newspaper },
    { title: 'Kehotepohjat', value: stats.templates, icon: FileText },
  ];

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('fi-FI');
  }

  function formatDateTime(dateStr: string | null): string {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return `${d.toLocaleDateString('fi-FI')} ${d.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })}`;
  }

  function formatOpenRate(rate: number | null): string {
    if (rate === null || rate === undefined) return '-';
    return `${rate.toFixed(1)}%`;
  }

  function formatNextScheduled(item: DeliveryStatsItem): React.ReactNode {
    if (item.schedulePaused) {
      return <Badge variant="secondary">Pysaytetty</Badge>;
    }
    if (!item.nextScheduledDate) return '-';
    return new Date(item.nextScheduledDate).toLocaleDateString('fi-FI', {
      weekday: 'short',
      day: 'numeric',
      month: 'numeric',
    });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Hallintapaneeli</h1>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? '...' : card.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Delivery stats table */}
      <Card>
        <CardHeader>
          <CardTitle>Asiakasyhteenveto</CardTitle>
        </CardHeader>
        <CardContent>
          {deliveryLoading ? (
            <p className="text-muted-foreground">Ladataan...</p>
          ) : deliveryStats.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ei viela lahetyksia</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asiakas</TableHead>
                    <TableHead>Tiimin koko</TableHead>
                    <TableHead>Viimeisin lahetys</TableHead>
                    <TableHead>Avausprosentti</TableHead>
                    <TableHead>Seuraava generointi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveryStats.map((item) => (
                    <TableRow key={item.clientId}>
                      <TableCell>
                        <Link
                          href={`/clients/${item.clientId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {item.clientName}
                        </Link>
                      </TableCell>
                      <TableCell>{item.teamSize}</TableCell>
                      <TableCell>{formatDate(item.latestSend)}</TableCell>
                      <TableCell>{formatOpenRate(item.openRate)}</TableCell>
                      <TableCell>{formatNextScheduled(item)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scheduler run log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Ajastushistoria
          </CardTitle>
        </CardHeader>
        <CardContent>
          {runsLoading ? (
            <p className="text-muted-foreground">Ladataan...</p>
          ) : schedulerRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ei viela ajoja</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aika</TableHead>
                    <TableHead>Kasitelty</TableHead>
                    <TableHead>Onnistuneet</TableHead>
                    <TableHead>Epaonnistuneet</TableHead>
                    <TableHead>Ohitetut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedulerRuns.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell className="text-sm">
                        {formatDateTime(run.startedAt)}
                      </TableCell>
                      <TableCell>{run.clientsProcessed}</TableCell>
                      <TableCell>{run.successes}</TableCell>
                      <TableCell>
                        <span className={run.failures > 0 ? 'font-medium text-red-600' : ''}>
                          {run.failures}
                        </span>
                      </TableCell>
                      <TableCell>{run.skips}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
