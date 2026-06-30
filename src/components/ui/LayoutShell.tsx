'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useStore, AuditLog, hydrateWorkspacePreferences, hydrateRoleDefinitions } from '@/lib/store';
import { canAccessModuleView } from '@/lib/rbac';
import { 
  Moon, 
  Sun, 
  Menu, 
  X, 
  LogOut,
  Bell,
  Search,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { prefetchCrmNavRoute } from '@/lib/api/crm-prefetch';
import { useAuditLogFeed } from '@/hooks/useAuditLogFeed';
import { CRM_NAV_GROUPS, type CrmNavGroup } from '@/lib/crm-nav-config';
import { getCrmBreadcrumbLabel } from '@/lib/crm-breadcrumbs';
import { traguinLogo, TRAGUIN_LOGO_SRC } from '@/lib/brand/traguin-logo';

function SidebarNavGroups({
  groups,
  pathname,
  onNavigate,
  onPrefetch,
}: {
  groups: CrmNavGroup[];
  pathname: string;
  onNavigate?: () => void;
  onPrefetch: (href: string) => void;
}) {
  return (
    <>
      {groups.map((group) => (
        <div key={group.label} className="crm-nav-group">
          <p className="crm-nav-group__label">{group.label}</p>
          <nav className="crm-sidebar-nav" aria-label={`${group.label} navigation`}>
            {group.items.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={`${group.label}-${item.name}`}
                  href={item.href}
                  onClick={onNavigate}
                  onMouseEnter={() => onPrefetch(item.href)}
                  onFocus={() => onPrefetch(item.href)}
                  className={`crm-nav-link group ${isActive ? 'crm-nav-link--active' : ''}`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      ))}
    </>
  );
}

function AgencyLogo({ name, logoUrl, className }: { name: string; logoUrl?: string; className: string }) {
  const [failed, setFailed] = useState(false);

  if (!logoUrl || failed) {
    return (
      <div className={`${className} crm-agency-mark rounded-lg ring-2 ring-primary/20`}>
        {name.charAt(0)}
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={name}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}

function getActionBadgeClass(action: string) {
  switch (action) {
    case 'CREATE':
      return 'bg-emerald-500/10 text-emerald-500';
    case 'UPDATE':
      return 'bg-primary/10 text-primary';
    case 'DELETE':
      return 'bg-red-500/10 text-red-500';
    case 'LOGIN':
      return 'bg-sky-500/10 text-sky-500';
    default:
      return 'bg-secondary text-muted-foreground';
  }
}

function formatLogTime(iso: string) {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function AuditLogEntry({ log }: { log: AuditLog }) {
  return (
    <div className="p-2 rounded-lg bg-secondary/50 border border-border/30">
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center flex-wrap gap-1.5">
            <span className="font-semibold text-[10px] text-foreground">{log.userName}</span>
            <span className={`text-[8px] px-1 py-0.5 rounded font-bold ${getActionBadgeClass(log.action)}`}>
              {log.action}
            </span>
            <span className="text-[8px] px-1 py-0.5 rounded bg-secondary text-muted-foreground font-medium">
              {log.entityType}
            </span>
          </div>
          <p className="text-[11px] text-foreground leading-snug">{log.details}</p>
        </div>
        <span className="text-[9px] text-muted-foreground shrink-0" title={new Date(log.createdAt).toLocaleString()}>
          {formatLogTime(log.createdAt)}
        </span>
      </div>
    </div>
  );
}

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const theme = useStore((state) => state.theme);
  const setTheme = useStore((state) => state.setTheme);
  const workspacePreferences = useStore((state) => state.workspacePreferences);
  const currentAgency = useStore((state) => state.currentAgency);
  const currentUser = useStore((state) => state.currentUser);
  const clearAuthSession = useStore((state) => state.clearAuthSession);
  const roleDefinitions = useStore((state) => state.roleDefinitions);
  const { auditLogs } = useAuditLogFeed(Boolean(currentUser));

  const agencyAuditLogs = useMemo(
    () =>
      auditLogs
        .filter((log) => log.agencyId === currentAgency.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [auditLogs, currentAgency.id]
  );

  const unreadCount = useMemo(() => {
    if (!lastSeenAt) return 0;
    return agencyAuditLogs.filter((log) => log.createdAt > lastSeenAt).length;
  }, [agencyAuditLogs, lastSeenAt]);

  const filteredNavGroups = useMemo((): CrmNavGroup[] => {
    if (!currentUser) return [];
    const agencyId = currentAgency.id;
    const canSettings = canAccessModuleView(
      currentUser.role,
      agencyId,
      'workspace_settings',
      roleDefinitions,
    );

    return CRM_NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (item.rbacModule === 'workspace_settings') return canSettings;
        return canAccessModuleView(currentUser.role, agencyId, item.rbacModule, roleDefinitions);
      }),
    })).filter((group) => group.items.length > 0);
  }, [currentAgency.id, currentUser, roleDefinitions]);

  const breadcrumbLabel = getCrmBreadcrumbLabel(pathname);
  const userInitials =
    (currentUser?.name ?? '?')
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || '?';

  const markLogsSeen = () => setLastSeenAt(new Date().toISOString());

  const handleToggleNotifications = () => {
    if (!showNotifications) {
      markLogsSeen();
    }
    setShowNotifications((open) => !open);
  };

  const handleDismissNotifications = () => {
    markLogsSeen();
    setShowNotifications(false);
  };

  useEffect(() => {
    hydrateWorkspacePreferences();
  }, []);

  useEffect(() => {
    hydrateRoleDefinitions();
  }, [currentAgency.id]);

  /** Warm list caches for current + sidebar routes so tab switches feel instant. */
  useEffect(() => {
    prefetchCrmNavRoute(pathname);
    filteredNavGroups.forEach((group) =>
      group.items.forEach((item) => prefetchCrmNavRoute(item.href)),
    );
  }, [pathname, filteredNavGroups]);

  const handleNavPrefetch = (href: string) => {
    prefetchCrmNavRoute(href);
    router.prefetch(href);
  };

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    markLogsSeen();
  }, []);

  useEffect(() => {
    if (!showNotifications) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        handleDismissNotifications();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);

  // If path is auth or portal, bypass layout shell
  const isAuthPage = pathname.startsWith('/auth') || pathname.startsWith('/portal');
  if (isAuthPage || pathname === '/') {
    return <>{children}</>;
  }

  const canViewStaffPortal = !!(
    currentUser &&
    canAccessModuleView(currentUser.role, currentAgency.id, 'staff_control', roleDefinitions)
  );

  const handleLogout = async () => {
    await fetch('/api/crm/auth/logout', { method: 'POST', credentials: 'include' });
    clearAuthSession();
    router.push('/auth/login');
    router.refresh();
  };

  return (
    <div className="crm-shell md:h-[100dvh] md:max-h-[100dvh] md:overflow-hidden transition-colors duration-200">
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between border-b border-border bg-card p-4 z-40 shrink-0 w-full">
        <div className="flex items-center space-x-2">
          <AgencyLogo
            name={currentAgency.name || 'Traguin'}
            logoUrl={currentAgency.logoUrl || TRAGUIN_LOGO_SRC}
            className="h-8 w-auto max-w-[7rem] rounded object-contain shrink-0"
          />
          <span className="font-semibold text-xs truncate max-w-[120px]">
            {currentAgency.name || 'Traguin'}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="crm-icon-btn"
            title="Toggle theme"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setMobileMenuOpen(true)}
            className="crm-icon-btn"
            title="Open menu"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Sidebar - Desktop */}
      <aside className="crm-sidebar hidden md:flex md:h-full md:min-h-0 flex-col">
        <div className="crm-sidebar__header">
          <div className="crm-sidebar-brand">
            <Image
              src={traguinLogo}
              alt="TRAGUIN"
              className="crm-sidebar-brand__logo"
              priority
            />
            <span className="crm-sidebar-brand__badge">CRM</span>
          </div>
        </div>

        <div className="crm-sidebar__scroll">
          <SidebarNavGroups
            groups={filteredNavGroups}
            pathname={pathname}
            onPrefetch={handleNavPrefetch}
          />
        </div>

      </aside>

      <div className="crm-main-column min-h-0 flex-1 flex flex-col">
        {/* Desktop top bar */}
        <header className="crm-topbar hidden md:grid">
          <div className="crm-topbar__section crm-topbar__section--start">
            <nav className="crm-breadcrumbs" aria-label="Breadcrumb">
              <span>CRM</span>
              <ChevronRight className="w-3.5 h-3.5 crm-breadcrumbs__sep" aria-hidden />
              <span className="crm-breadcrumbs__current">{breadcrumbLabel}</span>
            </nav>
          </div>

          <div className="crm-topbar__section crm-topbar__section--center">
            <label className="crm-global-search">
              <Search className="crm-global-search__icon" aria-hidden />
              <input
                type="search"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Search leads, quotes, bookings..."
                className="crm-global-search__input"
                aria-label="Global CRM search"
              />
            </label>
          </div>

          <div className="crm-topbar__section crm-topbar__section--end">
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="crm-icon-btn"
              title="Toggle theme"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>

            <div className="relative" ref={notificationsRef}>
              <button
                type="button"
                onClick={handleToggleNotifications}
                className="crm-icon-btn relative"
                title="Security audit logs"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-[9px] font-bold text-white flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="crm-dropdown w-80 p-2 text-xs">
                  <div className="flex justify-between items-center border-b border-border pb-2 mb-2 px-1">
                    <div>
                      <span className="font-semibold block">Recent Security Audit Logs</span>
                      <span className="text-[9px] text-muted-foreground">
                        {agencyAuditLogs.length} event{agencyAuditLogs.length === 1 ? '' : 's'} for {currentAgency.name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleDismissNotifications}
                      className="text-[10px] text-primary hover:underline shrink-0"
                    >
                      Dismiss
                    </button>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {agencyAuditLogs.length > 0 ? (
                      agencyAuditLogs.slice(0, 8).map((log, i) => (
                        <AuditLogEntry key={`${log.id}-${i}`} log={log} />
                      ))
                    ) : (
                      <div className="py-6 text-center text-muted-foreground text-[11px]">
                        No audit activity yet. Actions across the CRM will appear here.
                      </div>
                    )}
                  </div>
                  {canViewStaffPortal && agencyAuditLogs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        handleDismissNotifications();
                        router.push('/dashboard/employees');
                      }}
                      className="w-full mt-2 pt-2 border-t border-border text-[10px] text-primary hover:underline"
                    >
                      View full audit trail
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="crm-topbar-profile">
              <span className="crm-avatar h-9 w-9 text-[11px] shrink-0">{userInitials}</span>
              <div className="crm-topbar-profile__copy">
                <span className="crm-topbar-profile__name">{currentUser?.name ?? 'Account'}</span>
                <span className="crm-topbar-profile__role">{currentUser?.role ?? ''}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="crm-icon-btn"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div
          className={`crm-body min-h-0 flex-1 ${
            workspacePreferences.densePagePadding ? 'crm-body--dense' : ''
          }`}
        >
          <main className="crm-main w-full">
            <div
              className={`crm-workspace ${
                workspacePreferences.densePagePadding ? 'crm-workspace--dense' : ''
              }`}
            >
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* Mobile Slide-over navigation panel */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 md:hidden flex justify-end">
          <div className="w-72 bg-card h-full p-4 flex flex-col border-l border-border animate-slide-in min-h-0">
            <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <span className="font-semibold text-sm">Menu</span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="crm-icon-btn"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <SidebarNavGroups
                groups={filteredNavGroups}
                pathname={pathname}
                onNavigate={() => setMobileMenuOpen(false)}
                onPrefetch={handleNavPrefetch}
              />
            </div>

            <div className="crm-sidebar-footer shrink-0">
              <button
                onClick={handleLogout}
                className="crm-switch-cms text-destructive"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
