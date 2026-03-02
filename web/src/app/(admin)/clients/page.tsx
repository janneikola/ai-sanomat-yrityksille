'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ClientTable } from '@/components/clients/client-table';
import { ClientForm } from '@/components/clients/client-form';
import { apiFetch } from '@/lib/api';
import type { ClientResponse } from '@ai-sanomat/shared';

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientResponse | null>(null);

  async function loadClients() {
    try {
      const data = await apiFetch<ClientResponse[]>('/api/admin/clients');
      setClients(data);
    } catch (err) {
      console.error('Asiakkaiden lataus epäonnistui:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadClients();
  }, []);

  function handleCreate() {
    setEditingClient(null);
    setDialogOpen(true);
  }

  function handleEdit(client: ClientResponse) {
    setEditingClient(client);
    setDialogOpen(true);
  }

  async function handleSuccess() {
    setDialogOpen(false);
    setEditingClient(null);
    await loadClients();
  }

  function handleCancel() {
    setDialogOpen(false);
    setEditingClient(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Asiakkaat</h1>
        <Button onClick={handleCreate}>Lisää asiakas</Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Ladataan...</p>
      ) : (
        <ClientTable clients={clients} onEdit={handleEdit} />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingClient ? 'Muokkaa asiakasta' : 'Lisää uusi asiakas'}
            </DialogTitle>
          </DialogHeader>
          <ClientForm
            client={editingClient ?? undefined}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
