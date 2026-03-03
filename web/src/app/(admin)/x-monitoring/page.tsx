'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  DollarSign,
  AtSign,
  Search,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
} from '@/components/ui/dialog';
import { apiFetch } from '@/lib/api';

// --- Types ---

interface BudgetData {
  currentMonth: {
    spent: number;
    limit: number;
    remaining: number;
    warningLevel: 'none' | 'warning' | 'exceeded';
    tweetsCollected: number;
  };
  history: Array<{
    month: string;
    spent: number;
    tweetsCollected: number;
  }>;
}

interface XAccount {
  id: number;
  name: string;
  config: {
    handle: string;
    description?: string;
    includeReplies?: boolean;
    minLikes?: number;
  };
  isActive: boolean;
  healthStatus: string;
  lastSuccessAt: string | null;
  lastItemCount: number;
  createdAt: string;
}

interface XSearch {
  id: number;
  name: string;
  config: {
    query: string;
    language?: string;
  };
  clientName: string;
  isActive: boolean;
  healthStatus: string;
  lastSuccessAt: string | null;
  lastItemCount: number;
}

interface Client {
  id: number;
  name: string;
}

// --- Helpers ---

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'juuri nyt';
  if (diffMin < 60) return `${diffMin} min sitten`;
  if (diffHours < 24) return `${diffHours} tuntia sitten`;
  return `${diffDays} paivaa sitten`;
}

function healthDot(status: string) {
  const colors: Record<string, string> = {
    healthy: 'bg-green-500',
    degraded: 'bg-yellow-500',
    failing: 'bg-red-500',
  };
  const labels: Record<string, string> = {
    healthy: 'Terve',
    degraded: 'Heikentynyt',
    failing: 'Vikaantunut',
  };
  const color = colors[status] || 'bg-gray-400';
  const label = labels[status] || status;
  return (
    <div className="flex items-center gap-1.5">
      <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function warningBadge(level: 'none' | 'warning' | 'exceeded') {
  if (level === 'none') {
    return <Badge className="bg-green-100 text-green-800 border-green-200">OK</Badge>;
  }
  if (level === 'warning') {
    return (
      <Badge variant="outline" className="text-yellow-700 border-yellow-400 bg-yellow-50">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Varoitus (80%+)
      </Badge>
    );
  }
  return (
    <Badge variant="destructive">
      <AlertTriangle className="h-3 w-3 mr-1" />
      Ylitetty
    </Badge>
  );
}

// --- Component ---

export default function XMonitoringPage() {
  // State
  const [budget, setBudget] = useState<BudgetData | null>(null);
  const [budgetLoading, setBudgetLoading] = useState(true);
  const [budgetError, setBudgetError] = useState(false);

  const [accounts, setAccounts] = useState<XAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);

  const [searches, setSearches] = useState<XSearch[]>([]);
  const [searchesLoading, setSearchesLoading] = useState(true);

  const [clients, setClients] = useState<Client[]>([]);

  const [triggerLoading, setTriggerLoading] = useState(false);

  // Account dialog state
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<XAccount | null>(null);
  const [accountForm, setAccountForm] = useState({
    handle: '',
    description: '',
    includeReplies: false,
    minLikes: 0,
  });
  const [accountSaving, setAccountSaving] = useState(false);

  // Search dialog state
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [editingSearch, setEditingSearch] = useState<XSearch | null>(null);
  const [searchForm, setSearchForm] = useState({
    query: '',
    language: 'fi',
    clientId: '',
  });
  const [searchSaving, setSearchSaving] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'account' | 'search'; id: number; name: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // --- Data loading ---

  const loadBudget = useCallback(async () => {
    try {
      const data = await apiFetch<BudgetData>('/api/admin/x-monitoring/budget');
      setBudget(data);
      setBudgetError(false);
    } catch {
      setBudgetError(true);
    } finally {
      setBudgetLoading(false);
    }
  }, []);

  const loadAccounts = useCallback(async () => {
    try {
      const data = await apiFetch<XAccount[]>('/api/admin/x-monitoring/accounts');
      setAccounts(data);
    } catch {
      toast.error('Tilien lataus epaonnistui');
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  const loadSearches = useCallback(async () => {
    try {
      const data = await apiFetch<XSearch[]>('/api/admin/x-monitoring/searches');
      setSearches(data);
    } catch {
      toast.error('Hakujen lataus epaonnistui');
    } finally {
      setSearchesLoading(false);
    }
  }, []);

  const loadClients = useCallback(async () => {
    try {
      const data = await apiFetch<Client[]>('/api/admin/clients');
      setClients(data);
    } catch {
      // Clients list will remain empty
    }
  }, []);

  useEffect(() => {
    loadBudget();
    loadAccounts();
    loadSearches();
    loadClients();
  }, [loadBudget, loadAccounts, loadSearches, loadClients]);

  // --- Trigger collection ---

  async function handleTrigger() {
    setTriggerLoading(true);
    try {
      const result = await apiFetch<{ collected: number; errors: string[] }>(
        '/api/admin/x-monitoring/trigger',
        { method: 'POST' }
      );
      toast.success(`${result.collected} twiittia keratty`);
      if (result.errors?.length > 0) {
        toast.error(`${result.errors.length} virhetta keraysssa`);
      }
      await Promise.all([loadAccounts(), loadBudget()]);
    } catch {
      toast.error('Kerayksen kaynnistys epaonnistui');
    } finally {
      setTriggerLoading(false);
    }
  }

  // --- Account CRUD ---

  function openAddAccount() {
    setEditingAccount(null);
    setAccountForm({ handle: '', description: '', includeReplies: false, minLikes: 0 });
    setAccountDialogOpen(true);
  }

  function openEditAccount(account: XAccount) {
    setEditingAccount(account);
    setAccountForm({
      handle: account.config.handle || account.name,
      description: account.config.description || '',
      includeReplies: account.config.includeReplies || false,
      minLikes: account.config.minLikes || 0,
    });
    setAccountDialogOpen(true);
  }

  async function handleSaveAccount() {
    if (!accountForm.handle.trim()) {
      toast.error('Handle on pakollinen');
      return;
    }
    setAccountSaving(true);
    try {
      if (editingAccount) {
        await apiFetch(`/api/admin/x-monitoring/accounts/${editingAccount.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            handle: accountForm.handle.replace(/^@/, ''),
            description: accountForm.description || undefined,
            includeReplies: accountForm.includeReplies,
            minLikes: accountForm.minLikes || undefined,
          }),
        });
        toast.success('Tili paivitetty');
      } else {
        await apiFetch('/api/admin/x-monitoring/accounts', {
          method: 'POST',
          body: JSON.stringify({
            handle: accountForm.handle.replace(/^@/, ''),
            description: accountForm.description || undefined,
            includeReplies: accountForm.includeReplies,
            minLikes: accountForm.minLikes || undefined,
          }),
        });
        toast.success('Tili lisatty');
      }
      setAccountDialogOpen(false);
      await loadAccounts();
    } catch {
      toast.error('Tilin tallennus epaonnistui');
    } finally {
      setAccountSaving(false);
    }
  }

  async function handleToggleAccount(id: number, isActive: boolean) {
    try {
      await apiFetch(`/api/admin/x-monitoring/accounts/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive }),
      });
      setAccounts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, isActive } : a))
      );
      toast.success(isActive ? 'Tili aktivoitu' : 'Tili deaktivoitu');
    } catch {
      toast.error('Tilan paivitys epaonnistui');
    }
  }

  // --- Search CRUD ---

  function openAddSearch() {
    setEditingSearch(null);
    setSearchForm({ query: '', language: 'fi', clientId: '' });
    setSearchDialogOpen(true);
  }

  function openEditSearch(search: XSearch) {
    setEditingSearch(search);
    // Find clientId from name
    const client = clients.find((c) => c.name === search.clientName);
    setSearchForm({
      query: search.config.query || search.name,
      language: search.config.language || 'fi',
      clientId: client ? String(client.id) : '',
    });
    setSearchDialogOpen(true);
  }

  async function handleSaveSearch() {
    if (!searchForm.query.trim()) {
      toast.error('Hakusana on pakollinen');
      return;
    }
    if (!searchForm.clientId) {
      toast.error('Asiakas on pakollinen');
      return;
    }
    setSearchSaving(true);
    try {
      if (editingSearch) {
        await apiFetch(`/api/admin/x-monitoring/searches/${editingSearch.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            query: searchForm.query,
            language: searchForm.language || undefined,
            clientId: Number(searchForm.clientId),
          }),
        });
        toast.success('Haku paivitetty');
      } else {
        await apiFetch('/api/admin/x-monitoring/searches', {
          method: 'POST',
          body: JSON.stringify({
            query: searchForm.query,
            language: searchForm.language || undefined,
            clientId: Number(searchForm.clientId),
          }),
        });
        toast.success('Haku lisatty');
      }
      setSearchDialogOpen(false);
      await loadSearches();
    } catch {
      toast.error('Haun tallennus epaonnistui');
    } finally {
      setSearchSaving(false);
    }
  }

  async function handleToggleSearch(id: number, isActive: boolean) {
    try {
      await apiFetch(`/api/admin/x-monitoring/searches/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive }),
      });
      setSearches((prev) =>
        prev.map((s) => (s.id === id ? { ...s, isActive } : s))
      );
      toast.success(isActive ? 'Haku aktivoitu' : 'Haku deaktivoitu');
    } catch {
      toast.error('Tilan paivitys epaonnistui');
    }
  }

  // --- Delete ---

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const endpoint =
        deleteTarget.type === 'account'
          ? `/api/admin/x-monitoring/accounts/${deleteTarget.id}`
          : `/api/admin/x-monitoring/searches/${deleteTarget.id}`;
      await apiFetch(endpoint, { method: 'DELETE' });
      toast.success(
        deleteTarget.type === 'account' ? 'Tili poistettu' : 'Haku poistettu'
      );
      setDeleteTarget(null);
      if (deleteTarget.type === 'account') {
        await loadAccounts();
      } else {
        await loadSearches();
      }
    } catch {
      toast.error('Poisto epaonnistui');
    } finally {
      setDeleteLoading(false);
    }
  }

  // --- Render ---

  const budgetPercentage = budget
    ? Math.min(100, Math.round((budget.currentMonth.spent / budget.currentMonth.limit) * 100))
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">X-seuranta</h1>
        <p className="text-muted-foreground">
          X/Twitter-tilien ja hakujen hallinta Apify-integraatiolla
        </p>
      </div>

      {/* Section 1: Budget Overview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Budjetti
            </CardTitle>
            <CardDescription>Kuluvan kuukauden Apify-kaytto</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {budgetLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : budgetError || !budget ? (
            <div className="flex items-center gap-2 p-4 rounded-md bg-blue-50 text-blue-800 border border-blue-200">
              <Info className="h-4 w-4 shrink-0" />
              <p className="text-sm">
                APIFY_TOKEN ei ole asetettu &mdash; X-seuranta ei ole aktiivinen
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-2xl font-bold">
                    ${budget.currentMonth.spent.toFixed(2)} / ${budget.currentMonth.limit.toFixed(2)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {budget.currentMonth.tweetsCollected} twiittia keratty tassa kuussa
                  </p>
                </div>
                {warningBadge(budget.currentMonth.warningLevel)}
              </div>

              {/* Progress bar */}
              <div className="h-2 w-full rounded-full bg-muted">
                <div
                  className={`h-2 rounded-full transition-all ${
                    budget.currentMonth.warningLevel === 'exceeded'
                      ? 'bg-red-500'
                      : budget.currentMonth.warningLevel === 'warning'
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                  }`}
                  style={{ width: `${budgetPercentage}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-right">{budgetPercentage}% kaytetty</p>

              {/* History */}
              {budget.history.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Aiemmat kuukaudet</p>
                  <div className="flex gap-4">
                    {budget.history.slice(0, 3).map((h) => (
                      <div key={h.month} className="text-xs text-muted-foreground">
                        <span className="font-medium">{h.month}:</span> ${h.spent.toFixed(2)} ({h.tweetsCollected} tw.)
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 2: Influencer Accounts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AtSign className="h-5 w-5" />
              Seurattavat tilit
            </CardTitle>
            <CardDescription>X-vaikuttajatilit joiden julkaisut kerataan</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleTrigger} disabled={triggerLoading}>
              {triggerLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              Hae nyt
            </Button>
            <Button size="sm" onClick={openAddAccount}>
              <Plus className="mr-2 h-4 w-4" />
              Lisaa tili
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {accountsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : accounts.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Ei seurattavia tileja. Lisaa ensimmainen tili painamalla &quot;Lisaa tili&quot;.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Handle</TableHead>
                  <TableHead>Kuvaus</TableHead>
                  <TableHead className="text-center">Tila</TableHead>
                  <TableHead>Terveys</TableHead>
                  <TableHead>Viimeisin haku</TableHead>
                  <TableHead className="text-center">Tulokset</TableHead>
                  <TableHead>Toiminnot</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium">
                      @{account.config.handle || account.name}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {account.config.description || '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={account.isActive}
                        onCheckedChange={(checked) => handleToggleAccount(account.id, checked)}
                      />
                    </TableCell>
                    <TableCell>{healthDot(account.healthStatus)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatRelativeTime(account.lastSuccessAt)}
                    </TableCell>
                    <TableCell className="text-center">{account.lastItemCount}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEditAccount(account)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() =>
                            setDeleteTarget({
                              type: 'account',
                              id: account.id,
                              name: account.config.handle || account.name,
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Section 3: Keyword Searches */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Hakusanat
            </CardTitle>
            <CardDescription>Asiakaskohtaiset avainsanahaut X:sta</CardDescription>
          </div>
          <Button size="sm" onClick={openAddSearch}>
            <Plus className="mr-2 h-4 w-4" />
            Lisaa haku
          </Button>
        </CardHeader>
        <CardContent>
          {searchesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : searches.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Ei hakusanoja. Lisaa ensimmainen haku painamalla &quot;Lisaa haku&quot;.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hakusana</TableHead>
                  <TableHead>Asiakas</TableHead>
                  <TableHead>Kieli</TableHead>
                  <TableHead className="text-center">Tila</TableHead>
                  <TableHead>Terveys</TableHead>
                  <TableHead>Viimeisin haku</TableHead>
                  <TableHead className="text-center">Tulokset</TableHead>
                  <TableHead>Toiminnot</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {searches.map((search) => (
                  <TableRow key={search.id}>
                    <TableCell className="font-medium">{search.config.query || search.name}</TableCell>
                    <TableCell className="text-sm">{search.clientName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {search.config.language || 'fi'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={search.isActive}
                        onCheckedChange={(checked) => handleToggleSearch(search.id, checked)}
                      />
                    </TableCell>
                    <TableCell>{healthDot(search.healthStatus)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatRelativeTime(search.lastSuccessAt)}
                    </TableCell>
                    <TableCell className="text-center">{search.lastItemCount}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEditSearch(search)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() =>
                            setDeleteTarget({
                              type: 'search',
                              id: search.id,
                              name: search.config.query || search.name,
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Account Add/Edit Dialog */}
      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAccount ? 'Muokkaa tilia' : 'Lisaa uusi tili'}</DialogTitle>
            <DialogDescription>
              {editingAccount
                ? 'Paivita seurattavan tilin asetukset'
                : 'Lisaa uusi X-tili seurantaan'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="handle">Handle</Label>
              <Input
                id="handle"
                placeholder="esim. elikiiskinen"
                value={accountForm.handle}
                onChange={(e) => setAccountForm((prev) => ({ ...prev, handle: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Kuvaus</Label>
              <Input
                id="description"
                placeholder="esim. AI-asiantuntija"
                value={accountForm.description}
                onChange={(e) =>
                  setAccountForm((prev) => ({ ...prev, description: e.target.value }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="includeReplies">Vastaukset mukaan</Label>
              <Switch
                id="includeReplies"
                checked={accountForm.includeReplies}
                onCheckedChange={(checked) =>
                  setAccountForm((prev) => ({ ...prev, includeReplies: checked }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minLikes">Min. tykkaysta</Label>
              <Input
                id="minLikes"
                type="number"
                min={0}
                value={accountForm.minLikes}
                onChange={(e) =>
                  setAccountForm((prev) => ({ ...prev, minLikes: Number(e.target.value) }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccountDialogOpen(false)}>
              Peruuta
            </Button>
            <Button onClick={handleSaveAccount} disabled={accountSaving}>
              {accountSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingAccount ? 'Tallenna' : 'Lisaa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Search Add/Edit Dialog */}
      <Dialog open={searchDialogOpen} onOpenChange={setSearchDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSearch ? 'Muokkaa hakua' : 'Lisaa uusi haku'}</DialogTitle>
            <DialogDescription>
              {editingSearch
                ? 'Paivita hakusanan asetukset'
                : 'Lisaa uusi avainsanahaku X:sta'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="query">Hakusana</Label>
              <Input
                id="query"
                placeholder="esim. tekoaly Suomi"
                value={searchForm.query}
                onChange={(e) => setSearchForm((prev) => ({ ...prev, query: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientSelect">Asiakas</Label>
              <Select
                value={searchForm.clientId}
                onValueChange={(value) => setSearchForm((prev) => ({ ...prev, clientId: value }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Valitse asiakas" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={String(client.id)}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="language">Kieli</Label>
              <Input
                id="language"
                placeholder="fi"
                value={searchForm.language}
                onChange={(e) => setSearchForm((prev) => ({ ...prev, language: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSearchDialogOpen(false)}>
              Peruuta
            </Button>
            <Button onClick={handleSaveSearch} disabled={searchSaving}>
              {searchSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingSearch ? 'Tallenna' : 'Lisaa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vahvista poisto</DialogTitle>
            <DialogDescription>
              Haluatko varmasti poistaa {deleteTarget?.type === 'account' ? 'tilin' : 'haun'}{' '}
              &quot;{deleteTarget?.name}&quot;? Tata toimintoa ei voi perua.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Peruuta
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Poista
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
