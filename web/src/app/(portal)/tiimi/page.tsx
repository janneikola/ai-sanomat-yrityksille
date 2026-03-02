'use client';

import { useEffect, useState, useCallback } from 'react';
import { Users, Trash2, Plus, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';

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

export default function TiimiPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // Add single member state
  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addName, setAddName] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  // Bulk import state
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkEmails, setBulkEmails] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);

  // Remove confirmation state
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);

  const fetchMembers = useCallback(async () => {
    try {
      const data = await apiFetch<Member[]>('/api/portal/members');
      // Filter out inactive (soft-deleted) members for cleaner UX
      setMembers(data.filter((m) => m.isActive));
    } catch {
      toast.error('Jasenien lataaminen epaonnistui');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    setAddLoading(true);

    try {
      await apiFetch('/api/portal/members', {
        method: 'POST',
        body: JSON.stringify({
          email: addEmail,
          name: addName || undefined,
        }),
      });
      toast.success('Jasen lisatty');
      setAddOpen(false);
      setAddEmail('');
      setAddName('');
      await fetchMembers();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Jasen lisaaminen epaonnistui';
      if (message.includes('jo lisatty') || message.includes('409')) {
        toast.error('Sahkoposti on jo lisatty');
      } else {
        toast.error(message);
      }
    } finally {
      setAddLoading(false);
    }
  }

  async function handleBulkImport(e: React.FormEvent) {
    e.preventDefault();
    setBulkLoading(true);

    try {
      const result = await apiFetch<BulkResult>('/api/portal/members/bulk', {
        method: 'POST',
        body: JSON.stringify({ emails: bulkEmails }),
      });

      const parts: string[] = [];
      if (result.added > 0) parts.push(`Lisatty: ${result.added}`);
      if (result.reactivated > 0)
        parts.push(`Uudelleenaktivoitu: ${result.reactivated}`);
      if (result.skipped > 0) parts.push(`Ohitettu: ${result.skipped}`);

      toast.success(parts.join(', ') || 'Ei muutoksia');

      if (result.invalid.length > 0) {
        toast.error(`Virheelliset: ${result.invalid.join(', ')}`);
      }

      setBulkOpen(false);
      setBulkEmails('');
      await fetchMembers();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Tuonti epaonnistui'
      );
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleRemoveMember() {
    if (!removeTarget) return;
    setRemoveLoading(true);

    try {
      await apiFetch(`/api/portal/members/${removeTarget.id}`, {
        method: 'PATCH',
      });
      toast.success('Jasen poistettu');
      setRemoveTarget(null);
      await fetchMembers();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Poistaminen epaonnistui'
      );
    } finally {
      setRemoveLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Tiimin jasenet</h1>
        </div>
        <div className="flex gap-2">
          {/* Add single member dialog */}
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-1" />
                Lisaa jasen
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Lisaa uusi jasen</DialogTitle>
                <DialogDescription>
                  Syota uuden tiimin jasenen sahkopostiosoite.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddMember} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="add-email">Sahkoposti</Label>
                  <Input
                    id="add-email"
                    type="email"
                    placeholder="matti@yritys.fi"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    required
                    disabled={addLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-name">Nimi (valinnainen)</Label>
                  <Input
                    id="add-name"
                    type="text"
                    placeholder="Matti Meikalainen"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    disabled={addLoading}
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={addLoading}>
                    {addLoading ? 'Lisataan...' : 'Lisaa jasen'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Bulk import dialog */}
          <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-1" />
                Tuo useita
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tuo useita jasenia</DialogTitle>
                <DialogDescription>
                  Syota sahkopostiosoitteet pilkulla erotettuna.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleBulkImport} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bulk-emails">Sahkopostiosoitteet</Label>
                  <Textarea
                    id="bulk-emails"
                    placeholder={
                      'Syota sahkopostiosoitteet pilkulla erotettuna\nesim. matti@yritys.fi, maija@yritys.fi'
                    }
                    value={bulkEmails}
                    onChange={(e) => setBulkEmails(e.target.value)}
                    required
                    disabled={bulkLoading}
                    rows={4}
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={bulkLoading}>
                    {bulkLoading ? 'Tuodaan...' : 'Tuo jasenet'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Members table */}
      {loading ? (
        <p className="text-muted-foreground">Ladataan jasenia...</p>
      ) : members.length === 0 ? (
        <p className="text-muted-foreground">
          Ei jasenia. Lisaa ensimmainen jasen ylla olevasta painikkeesta.
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
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">{member.email}</TableCell>
                  <TableCell>{member.name ?? '-'}</TableCell>
                  <TableCell>
                    {member.isBounced ? (
                      <Badge variant="destructive">Palautunut</Badge>
                    ) : (
                      <Badge className="bg-green-600 text-white hover:bg-green-700">
                        Aktiivinen
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRemoveTarget(member)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Remove confirmation dialog */}
      <Dialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Poista jasen</DialogTitle>
            <DialogDescription>
              Haluatko varmasti poistaa jasenen{' '}
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
