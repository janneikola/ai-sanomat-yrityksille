'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Newspaper, FileText } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface DashboardStats {
  clients: number;
  sources: number;
  templates: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({ clients: 0, sources: 0, templates: 0 });
  const [loading, setLoading] = useState(true);

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
    loadStats();
  }, []);

  const cards = [
    { title: 'Asiakkaat', value: stats.clients, icon: Users },
    { title: 'Uutislähteet', value: stats.sources, icon: Newspaper },
    { title: 'Kehotepohjat', value: stats.templates, icon: FileText },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Hallintapaneeli</h1>
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
    </div>
  );
}
