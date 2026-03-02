'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api';
import type { TemplateResponse } from '@ai-sanomat/shared';

interface TemplateEditorProps {
  template: TemplateResponse;
  onSave: (updated: TemplateResponse) => void;
}

export function TemplateEditor({ template, onSave }: TemplateEditorProps) {
  const [description, setDescription] = useState(template.description ?? '');
  const [body, setBody] = useState(template.template);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Parse variables from template.variables JSON field
  const variables: string[] = (() => {
    try {
      if (!template.variables) return [];
      const parsed = JSON.parse(template.variables);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  function insertVariable(varName: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const placeholder = `{{${varName}}}`;
    const newValue = body.substring(0, start) + placeholder + body.substring(end);
    setBody(newValue);

    // Restore cursor position after the inserted placeholder
    requestAnimationFrame(() => {
      textarea.focus();
      const newCursorPos = start + placeholder.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    });
  }

  async function handleSave() {
    setError('');
    setSaving(true);
    setSaved(false);

    try {
      const updated = await apiFetch<TemplateResponse>(`/api/admin/templates/${template.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          description: description || undefined,
          template: body,
          variables: template.variables,
        }),
      });
      setSaved(true);
      onSave(updated);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tallennus epäonnistui');
    } finally {
      setSaving(false);
    }
  }

  const updatedAt = new Date(template.updatedAt).toLocaleString('fi-FI', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{template.name}</h2>
        <span className="text-sm text-muted-foreground">
          Viimeksi muokattu: {updatedAt}
        </span>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Kuvaus</Label>
        <Input
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Lyhyt kuvaus kehotepohjasta"
        />
      </div>

      <div className="flex gap-4">
        {/* Template textarea */}
        <div className="flex-1 space-y-2">
          <Label htmlFor="template-body">Kehottepohja</Label>
          <Textarea
            id="template-body"
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="min-h-[400px] font-mono text-sm"
            placeholder="Kirjoita kehottepohja tähän..."
          />
        </div>

        {/* Variable reference sidebar */}
        {variables.length > 0 && (
          <div className="w-48 shrink-0 space-y-2">
            <Label>Muuttujat</Label>
            <p className="text-xs text-muted-foreground">
              Klikkaa lisätäksesi muuttuja kursorin kohdalle
            </p>
            <div className="space-y-1">
              {variables.map((varName) => (
                <button
                  key={varName}
                  type="button"
                  onClick={() => insertVariable(varName)}
                  className="w-full text-left px-2 py-1.5 text-sm font-mono bg-muted hover:bg-muted/80 rounded border text-foreground transition-colors"
                >
                  {`{{${varName}}}`}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-2">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Tallennetaan...' : 'Tallenna'}
        </Button>
        {saved && (
          <span className="text-sm text-muted-foreground">Tallennettu!</span>
        )}
      </div>
    </div>
  );
}
