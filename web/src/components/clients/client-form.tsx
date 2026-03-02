'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { apiFetch } from '@/lib/api';
import type { ClientResponse, CreateClient } from '@ai-sanomat/shared';

const INDUSTRIES = [
  'taloushallinto',
  'markkinointi',
  'rakennusala',
  'terveydenhuolto',
  'lakiala',
  'IT/ohjelmistokehitys',
  'logistiikka',
  'koulutus',
  'rahoitus',
  'vähittäiskauppa',
] as const;

interface ClientFormProps {
  client?: ClientResponse;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ClientForm({ client, onSuccess, onCancel }: ClientFormProps) {
  const isEdit = !!client;

  const [name, setName] = useState(client?.name ?? '');
  const [industry, setIndustry] = useState(client?.industry ?? '');
  const [contactEmail, setContactEmail] = useState(client?.contactEmail ?? '');
  const [contactName, setContactName] = useState(client?.contactName ?? '');
  const [plan, setPlan] = useState<'ai_pulse' | 'ai_teams'>(client?.plan ?? 'ai_pulse');
  const [isActive, setIsActive] = useState(client?.isActive ?? true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Nimi on pakollinen');
      return;
    }
    if (!industry) {
      setError('Toimiala on pakollinen');
      return;
    }
    if (!contactEmail.trim()) {
      setError('Sähköposti on pakollinen');
      return;
    }

    setLoading(true);

    try {
      const data: CreateClient & { isActive?: boolean } = {
        name: name.trim(),
        industry,
        contactEmail: contactEmail.trim(),
        contactName: contactName.trim() || undefined,
        plan,
        ...(isEdit ? { isActive } : {}),
      };

      if (isEdit) {
        await apiFetch(`/api/admin/clients/${client.id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        });
      } else {
        await apiFetch('/api/admin/clients', {
          method: 'POST',
          body: JSON.stringify(data),
        });
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tallennus epäonnistui');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nimi *</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Yrityksen nimi"
          disabled={loading}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="industry">Toimiala *</Label>
        <Select value={industry} onValueChange={setIndustry}>
          <SelectTrigger id="industry">
            <SelectValue placeholder="Valitse toimiala" />
          </SelectTrigger>
          <SelectContent>
            {INDUSTRIES.map((ind) => (
              <SelectItem key={ind} value={ind}>
                {ind}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="contactEmail">Yhteyshenkilön sähköposti *</Label>
        <Input
          id="contactEmail"
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder="yhteyshenkilö@yritys.fi"
          disabled={loading}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="contactName">Yhteyshenkilön nimi</Label>
        <Input
          id="contactName"
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
          placeholder="Etunimi Sukunimi"
          disabled={loading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="plan">Paketti</Label>
        <Select value={plan} onValueChange={(v) => setPlan(v as 'ai_pulse' | 'ai_teams')}>
          <SelectTrigger id="plan">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ai_pulse">AI Pulse</SelectItem>
            <SelectItem value="ai_teams">AI Teams</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isEdit && (
        <div className="flex items-center space-x-2">
          <Switch
            id="isActive"
            checked={isActive}
            onCheckedChange={setIsActive}
            disabled={loading}
          />
          <Label htmlFor="isActive">Aktiivinen</Label>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Peruuta
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Tallennetaan...' : isEdit ? 'Tallenna' : 'Luo asiakas'}
        </Button>
      </div>
    </form>
  );
}
