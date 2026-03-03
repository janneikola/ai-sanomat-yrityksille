'use client';

import { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Circle, ChevronDown, ChevronRight, Check, X, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import type { SourceResponse } from '@ai-sanomat/shared';

const TYPE_LABELS: Record<string, string> = {
  rss: 'RSS',
  beehiiv: 'Beehiiv',
  manual: 'Manuaalinen',
};

const HEALTH_COLORS: Record<string, string> = {
  green: 'text-green-500 fill-green-500',
  yellow: 'text-yellow-500 fill-yellow-500',
  red: 'text-red-500 fill-red-500',
};

interface HealthLog {
  id: number;
  success: boolean;
  itemCount: number;
  errorMessage: string | null;
  fetchedAt: string;
}

interface SourceTableProps {
  sources: SourceResponse[];
  onEdit: (source: SourceResponse) => void;
  onToggle: (source: SourceResponse, newActive: boolean) => void;
}

export function SourceTable({ sources, onEdit, onToggle }: SourceTableProps) {
  const [togglingIds, setTogglingIds] = useState<Set<number>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [healthLogs, setHealthLogs] = useState<Record<number, HealthLog[]>>({});
  const [loadingLogs, setLoadingLogs] = useState<Set<number>>(new Set());

  async function handleToggle(source: SourceResponse) {
    setTogglingIds((prev) => new Set(prev).add(source.id));
    try {
      await apiFetch(`/api/admin/sources/${source.id}/toggle`, { method: 'PATCH' });
      onToggle(source, !source.isActive);
    } catch (err) {
      console.error('Tilamuutos epaonnistui:', err);
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(source.id);
        return next;
      });
    }
  }

  async function handleExpand(sourceId: number) {
    const isExpanded = expandedIds.has(sourceId);
    if (isExpanded) {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        next.delete(sourceId);
        return next;
      });
      return;
    }

    // Load health logs if not already loaded
    if (!healthLogs[sourceId]) {
      setLoadingLogs((prev) => new Set(prev).add(sourceId));
      try {
        const logs = await apiFetch<HealthLog[]>(
          `/api/admin/sources/${sourceId}/health-logs?limit=20`
        );
        setHealthLogs((prev) => ({ ...prev, [sourceId]: logs }));
      } catch (err) {
        console.error('Terveyslokien lataus epaonnistui:', err);
      } finally {
        setLoadingLogs((prev) => {
          const next = new Set(prev);
          next.delete(sourceId);
          return next;
        });
      }
    }

    setExpandedIds((prev) => new Set(prev).add(sourceId));
  }

  function formatRelativeTime(dateStr: string | Date | null): string {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'juuri nyt';
    if (diffMins < 60) return `${diffMins} min sitten`;
    if (diffHours < 24) return `${diffHours} h sitten`;
    if (diffDays < 7) return `${diffDays} pv sitten`;
    return d.toLocaleDateString('fi-FI');
  }

  const columns: ColumnDef<SourceResponse>[] = [
    {
      id: 'expand',
      header: '',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={() => handleExpand(row.original.id)}
        >
          {expandedIds.has(row.original.id) ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      ),
    },
    {
      accessorKey: 'name',
      header: 'Nimi',
      cell: ({ row }) => {
        const source = row.original;
        const colorClass = HEALTH_COLORS[source.healthStatus] ?? HEALTH_COLORS.green;
        return (
          <div className="flex items-center gap-2">
            <Circle className={`h-3 w-3 ${colorClass}`} />
            <span>{source.name}</span>
          </div>
        );
      },
    },
    {
      accessorKey: 'type',
      header: 'Tyyppi',
      cell: ({ row }) => {
        const type = row.getValue<string>('type');
        return <Badge variant="secondary">{TYPE_LABELS[type] ?? type}</Badge>;
      },
    },
    {
      accessorKey: 'url',
      header: 'URL',
      cell: ({ row }) => {
        const url = row.getValue<string | null>('url');
        return url ? (
          <span className="text-sm text-muted-foreground truncate max-w-[200px] block">{url}</span>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        );
      },
    },
    {
      id: 'lastSuccess',
      header: 'Viimeisin haku',
      cell: ({ row }) => {
        const source = row.original;
        return (
          <span className="text-sm text-muted-foreground">
            {formatRelativeTime(source.lastSuccessAt)}
          </span>
        );
      },
    },
    {
      accessorKey: 'isActive',
      header: 'Aktiivinen',
      cell: ({ row }) => {
        const source = row.original;
        const isToggling = togglingIds.has(source.id);
        return (
          <Switch
            checked={source.isActive}
            onCheckedChange={() => handleToggle(source)}
            disabled={isToggling}
          />
        );
      },
    },
    {
      id: 'actions',
      header: 'Toiminnot',
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onEdit(row.original)}
        >
          Muokkaa
        </Button>
      ),
    },
  ];

  const table = useReactTable({
    data: sources,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <>
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
                {expandedIds.has(row.original.id) && (
                  <TableRow key={`${row.id}-logs`}>
                    <TableCell colSpan={columns.length} className="bg-muted/50 p-4">
                      {loadingLogs.has(row.original.id) ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Ladataan lokeja...
                        </div>
                      ) : healthLogs[row.original.id]?.length ? (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium">Hakuloki</h4>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[180px]">Aika</TableHead>
                                <TableHead className="w-[80px]">Tulos</TableHead>
                                <TableHead className="w-[80px]">Uutiset</TableHead>
                                <TableHead>Virhe</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {healthLogs[row.original.id].map((log) => (
                                <TableRow key={log.id}>
                                  <TableCell className="text-sm">
                                    {new Date(log.fetchedAt).toLocaleString('fi-FI')}
                                  </TableCell>
                                  <TableCell>
                                    {log.success ? (
                                      <Check className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <X className="h-4 w-4 text-red-500" />
                                    )}
                                  </TableCell>
                                  <TableCell className="text-sm">{log.itemCount}</TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {log.errorMessage ?? '-'}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Ei hakulokeja</p>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                Ei uutislahteitia.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
