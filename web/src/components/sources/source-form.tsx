'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiFetch } from '@/lib/api';
import type { SourceResponse } from '@ai-sanomat/shared';

interface SourceFormProps {
  source?: SourceResponse;
  onSuccess: () => void;
  onCancel: () => void;
}

export function SourceForm({ source, onSuccess, onCancel }: SourceFormProps) {
  const isEdit = !!source;

  const [name, setName] = useState(source?.name ?? '');
  const [type, setType] = useState<'rss' | 'beehiiv' | 'manual' | 'web_search' | 'x_account' | 'x_search'>(source?.type ?? 'rss');
  const [url, setUrl] = useState(source?.url ?? '');
  const [config, setConfig] = useState(source?.config ?? '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const showUrl = type === 'rss' || type === 'beehiiv';
  const showConfig = type === 'beehiiv';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Nimi on pakollinen');
      return;
    }

    setLoading(true);

    try {
      const data = {
        name: name.trim(),
        type,
        url: showUrl ? url.trim() || undefined : undefined,
        config: showConfig ? config.trim() || undefined : undefined,
      };

      if (isEdit) {
        await apiFetch(`/api/admin/sources/${source.id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        });
      } else {
        await apiFetch('/api/admin/sources', {
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
          placeholder="Lähteen nimi"
          disabled={loading}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="type">Tyyppi</Label>
        <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
          <SelectTrigger id="type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="rss">RSS</SelectItem>
            <SelectItem value="beehiiv">Beehiiv</SelectItem>
            <SelectItem value="manual">Manuaalinen</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {showUrl && (
        <div className="space-y-2">
          <Label htmlFor="url">URL</Label>
          <Input
            id="url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={type === 'rss' ? 'https://example.com/rss.xml' : 'https://aisanomat.fi'}
            disabled={loading}
          />
        </div>
      )}

      {showConfig && (
        <div className="space-y-2">
          <Label htmlFor="config">Asetukset (JSON)</Label>
          <Textarea
            id="config"
            value={config}
            onChange={(e) => setConfig(e.target.value)}
            placeholder={'{"publicationId": "pub_xxxx"}'}
            disabled={loading}
            rows={3}
          />
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Peruuta
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Tallennetaan...' : isEdit ? 'Tallenna' : 'Luo lähde'}
        </Button>
      </div>
    </form>
  );
}
