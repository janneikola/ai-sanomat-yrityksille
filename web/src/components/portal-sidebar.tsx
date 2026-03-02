'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Users, Archive, LogOut } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';

interface CompanyInfo {
  companyName: string;
  plan: string;
  contactEmail: string;
}

const navItems = [
  { title: 'Tiimin jasenet', href: '/tiimi', icon: Users },
  { title: 'Uutiskirjearkisto', href: '/arkisto', icon: Archive },
];

export function PortalSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);

  useEffect(() => {
    apiFetch<CompanyInfo>('/api/portal/me')
      .then(setCompanyInfo)
      .catch(() => {
        // If /me fails with 401, apiFetch redirects to /portal/login
      });
  }, []);

  async function handleLogout() {
    try {
      await apiFetch('/api/portal/logout', { method: 'POST' });
    } catch {
      // Ignore errors on logout
    }
    router.push('/portal/login');
  }

  function isActive(href: string): boolean {
    return pathname.startsWith(href);
  }

  const planLabel =
    companyInfo?.plan === 'ai_teams'
      ? 'AI Teams'
      : companyInfo?.plan === 'ai_pulse'
        ? 'AI Pulse'
        : companyInfo?.plan ?? '';

  return (
    <Sidebar className="border-r border-slate-200">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="flex flex-col items-start gap-1 px-2 py-3">
            <span className="text-sm font-semibold">
              {companyInfo?.companyName ?? 'Yritysportaali'}
            </span>
            {companyInfo && (
              <Badge variant="secondary" className="text-xs">
                {planLabel}
              </Badge>
            )}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isActive(item.href)}>
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Kirjaudu ulos
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
