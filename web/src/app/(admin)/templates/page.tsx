'use client';

import { useEffect, useState } from 'react';
import { TemplateEditor } from '@/components/templates/template-editor';
import { apiFetch } from '@/lib/api';
import type { TemplateResponse } from '@ai-sanomat/shared';
import { cn } from '@/lib/utils';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateResponse[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateResponse | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadTemplates() {
    try {
      const data = await apiFetch<TemplateResponse[]>('/api/admin/templates');
      setTemplates(data);
      if (data.length > 0 && !selectedTemplate) {
        setSelectedTemplate(data[0]);
      }
    } catch (err) {
      console.error('Kehotepohjien lataus epäonnistui:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSave(updated: TemplateResponse) {
    setTemplates((prev) =>
      prev.map((t) => (t.id === updated.id ? updated : t))
    );
    setSelectedTemplate(updated);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Kehotepohjat</h1>

      {loading ? (
        <p className="text-muted-foreground">Ladataan...</p>
      ) : (
        <div className="flex gap-6">
          {/* Template list */}
          <div className="w-64 shrink-0 space-y-2">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTemplate(t)}
                className={cn(
                  'w-full text-left p-3 rounded-lg border transition-colors',
                  selectedTemplate?.id === t.id
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card hover:bg-muted border-border'
                )}
              >
                <p className="font-medium text-sm">{t.name}</p>
                {t.description && (
                  <p className={cn(
                    'text-xs mt-0.5 line-clamp-2',
                    selectedTemplate?.id === t.id ? 'text-primary-foreground/70' : 'text-muted-foreground'
                  )}>
                    {t.description}
                  </p>
                )}
              </button>
            ))}
            {templates.length === 0 && (
              <p className="text-sm text-muted-foreground">Ei kehotepohjia.</p>
            )}
          </div>

          {/* Editor */}
          <div className="flex-1">
            {selectedTemplate ? (
              <TemplateEditor
                key={selectedTemplate.id}
                template={selectedTemplate}
                onSave={handleSave}
              />
            ) : (
              <p className="text-muted-foreground">Valitse kehottepohja vasemmalta.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
