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
import { apiFetch } from '@/lib/api';
import type { SourceResponse } from '@ai-sanomat/shared';

const TYPE_LABELS: Record<string, string> = {
  rss: 'RSS',
  beehiiv: 'Beehiiv',
  manual: 'Manuaalinen',
};

interface SourceTableProps {
  sources: SourceResponse[];
  onEdit: (source: SourceResponse) => void;
  onToggle: (source: SourceResponse, newActive: boolean) => void;
}

export function SourceTable({ sources, onEdit, onToggle }: SourceTableProps) {
  const [togglingIds, setTogglingIds] = useState<Set<number>>(new Set());

  async function handleToggle(source: SourceResponse) {
    setTogglingIds((prev) => new Set(prev).add(source.id));
    try {
      await apiFetch(`/api/admin/sources/${source.id}/toggle`, { method: 'PATCH' });
      onToggle(source, !source.isActive);
    } catch (err) {
      console.error('Tilamuutos epäonnistui:', err);
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(source.id);
        return next;
      });
    }
  }

  const columns: ColumnDef<SourceResponse>[] = [
    {
      accessorKey: 'name',
      header: 'Nimi',
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
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                Ei uutislähteitä.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
