'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Users, Newspaper, FileText, LogOut, Rss, Search, Copy } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';

const navItems = [
  { title: 'Hallintapaneeli', href: '/', icon: LayoutDashboard },
  { title: 'Asiakkaat', href: '/clients', icon: Users },
  { title: 'Uutiset', href: '/news', icon: Newspaper },
  { title: 'Uutislähteet', href: '/sources', icon: Rss },
  { title: 'Verkkohaku', href: '/web-search', icon: Search },
  { title: 'Duplikaatit', href: '/deduplication', icon: Copy },
  { title: 'Kehotepohjat', href: '/templates', icon: FileText },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore errors on logout
    }
    router.push('/login');
  }

  function isActive(href: string): boolean {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  }

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>AI-Sanomat</SidebarGroupLabel>
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
