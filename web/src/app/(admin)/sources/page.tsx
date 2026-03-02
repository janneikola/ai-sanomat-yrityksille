'use client';

import { useEffect, useState } from 'react';
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

export default function SourcesPage() {
  const [sources, setSources] = useState<SourceResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<SourceResponse | null>(null);

  async function loadSources() {
    try {
      const data = await apiFetch<SourceResponse[]>('/api/admin/sources');
      setSources(data);
    } catch (err) {
      console.error('Lähteiden lataus epäonnistui:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSources();
  }, []);

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
        <h1 className="text-2xl font-bold">Uutislähteet</h1>
        <Button onClick={handleCreate}>Lisää lähde</Button>
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
              {editingSource ? 'Muokkaa lähdettä' : 'Lisää uusi lähde'}
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
