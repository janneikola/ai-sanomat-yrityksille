'use client';

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
import type { ClientResponse } from '@ai-sanomat/shared';

interface ClientTableProps {
  clients: ClientResponse[];
  onEdit: (client: ClientResponse) => void;
}

export function ClientTable({ clients, onEdit }: ClientTableProps) {
  const columns: ColumnDef<ClientResponse>[] = [
    {
      accessorKey: 'name',
      header: 'Nimi',
    },
    {
      accessorKey: 'industry',
      header: 'Toimiala',
    },
    {
      accessorKey: 'contactEmail',
      header: 'Yhteyshenkilö',
    },
    {
      accessorKey: 'plan',
      header: 'Paketti',
      cell: ({ row }) => {
        const plan = row.getValue<string>('plan');
        return (
          <Badge variant={plan === 'ai_teams' ? 'default' : 'secondary'}>
            {plan === 'ai_pulse' ? 'AI Pulse' : 'AI Teams'}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'isActive',
      header: 'Tila',
      cell: ({ row }) => {
        const active = row.getValue<boolean>('isActive');
        return (
          <Badge variant={active ? 'default' : 'outline'}>
            {active ? 'Aktiivinen' : 'Ei aktiivinen'}
          </Badge>
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
    data: clients,
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
                Ei asiakkaita. Lisää ensimmäinen asiakas.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
