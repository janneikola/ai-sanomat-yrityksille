'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SourceTable } from '@/components/sources/source-table';
import { SourceForm } from '@/components/sources/source-form';
import { apiFetch } from '@/lib/api';
import type { SourceResponse } from '@ai-sanomat/shared';

type HealthFilter = 'all' | 'green' | 'yellow' | 'red';

const HEALTH_FILTER_LABELS: Record<HealthFilter, string> = {
  all: 'Kaikki',
  green: 'Kunnossa',
  yellow: 'Varoitus',
  red: 'Virhe',
};

export default function SourcesPage() {
  const [sources, setSources] = useState<SourceResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<SourceResponse | null>(null);
  const [healthFilter, setHealthFilter] = useState<HealthFilter>('all');

  const loadSources = useCallback(async () => {
    try {
      const url = healthFilter === 'all'
        ? '/api/admin/sources'
        : `/api/admin/sources?healthStatus=${healthFilter}`;
      const data = await apiFetch<SourceResponse[]>(url);
      setSources(data);
    } catch (err) {
      console.error('Lahteiden lataus epaonnistui:', err);
    } finally {
      setLoading(false);
    }
  }, [healthFilter]);

  useEffect(() => {
    setLoading(true);
    loadSources();
  }, [loadSources]);

  function handleCreate() {
    setEditingSource(null);
    setDialogOpen(true);
  }

  function handleEdit(source: SourceResponse) {
    setEditingSource(source);
    setDialogOpen(true);
  }

  function handleToggle(source: SourceResponse, newActive: boolean) {
    setSources((prev) =>
      prev.map((s) => (s.id === source.id ? { ...s, isActive: newActive } : s))
    );
  }

  async function handleSuccess() {
    setDialogOpen(false);
    setEditingSource(null);
    await loadSources();
  }

  function handleCancel() {
    setDialogOpen(false);
    setEditingSource(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Uutislahteet</h1>
        <Button onClick={handleCreate}>Lisaa lahde</Button>
      </div>

      {/* Health status filter bar */}
      <div className="flex items-center gap-2">
        {(Object.keys(HEALTH_FILTER_LABELS) as HealthFilter[]).map((filter) => (
          <Button
            key={filter}
            variant={healthFilter === filter ? 'default' : 'outline'}
            size="sm"
            onClick={() => setHealthFilter(filter)}
          >
            {filter !== 'all' && (
              <span
                className={`mr-1.5 inline-block h-2 w-2 rounded-full ${
                  filter === 'green' ? 'bg-green-500' :
                  filter === 'yellow' ? 'bg-yellow-500' :
                  'bg-red-500'
                }`}
              />
            )}
            {HEALTH_FILTER_LABELS[filter]}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted-foreground">Ladataan...</p>
      ) : (
        <SourceTable
          sources={sources}
          onEdit={handleEdit}
          onToggle={handleToggle}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingSource ? 'Muokkaa lahdetta' : 'Lisaa uusi lahde'}
            </DialogTitle>
          </DialogHeader>
          <SourceForm
            source={editingSource ?? undefined}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
