'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useStore, AuditLog, hydrateWorkspacePreferences, hydrateRoleDefinitions } from '@/lib/store';
import { RBAC_NAV_MODULE, canAccessModuleView, type RbacModuleKey } from '@/lib/rbac';
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  DollarSign, 
  ShieldAlert, 
  Map, 
  Moon, 
  Sun, 
  Menu, 
  X, 
  Layers,
  ChevronDown,
  LogOut,
  Bell,
  CalendarRange,
  Settings,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { CrmProductSwitcher } from '@/components/ui/CrmProductSwitcher';

interface SidebarItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  rbacModule: RbacModuleKey;
}

const navigationItems: SidebarItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, rbacModule: RBAC_NAV_MODULE['/dashboard'] },
  { name: 'Weekly schedule', href: '/dashboard/operations', icon: CalendarRange, rbacModule: RBAC_NAV_MODULE['/dashboard/operations'] },
  { name: 'Leads', href: '/dashboard/crm', icon: Layers, rbacModule: RBAC_NAV_MODULE['/dashboard/crm'] },
  { name: 'Customers', href: '/dashboard/customers', icon: Users, rbacModule: RBAC_NAV_MODULE['/dashboard/customers'] },
  { name: 'Trip planner', href: '/dashboard/itinerary', icon: Map, rbacModule: RBAC_NAV_MODULE['/dashboard/itinerary'] },
  { name: 'Vendors', href: '/dashboard/vendors', icon: Building2, rbacModule: RBAC_NAV_MODULE['/dashboard/vendors'] },
  { name: 'Billing', href: '/dashboard/finance', icon: DollarSign, rbacModule: RBAC_NAV_MODULE['/dashboard/finance'] },
  { name: 'Team access', href: '/dashboard/employees', icon: ShieldAlert, rbacModule: RBAC_NAV_MODULE['/dashboard/employees'] },
];

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
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const theme = useStore((state) => state.theme);
  const setTheme = useStore((state) => state.setTheme);
  const workspacePreferences = useStore((state) => state.workspacePreferences);
  const currentAgency = useStore((state) => state.currentAgency);
  const currentUser = useStore((state) => state.currentUser);
  const clearAuthSession = useStore((state) => state.clearAuthSession);
  const auditLogs = useStore((state) => state.auditLogs);
  const roleDefinitions = useStore((state) => state.roleDefinitions);

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

  const filteredNavigation = useMemo(() => {
    if (!currentUser) return [];
    const agencyId = currentAgency.id;
    return navigationItems.filter((item) =>
      canAccessModuleView(currentUser.role, agencyId, item.rbacModule, roleDefinitions),
    );
  }, [currentAgency.id, currentUser, roleDefinitions]);

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

  const showWorkspaceSettingsNav = !!(
    currentUser &&
    canAccessModuleView(
      currentUser.role,
      currentAgency.id,
      'workspace_settings',
      roleDefinitions,
    )
  );

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
      <header className="md:hidden flex items-center justify-between border-b border-border bg-card p-4 z-40 shrink-0">
        <div className="flex items-center space-x-2">
          <AgencyLogo
            name={currentAgency.name}
            logoUrl={currentAgency.logoUrl}
            className="w-8 h-8 rounded object-cover shrink-0"
          />
          <span className="font-semibold text-xs truncate max-w-[120px]">{currentAgency.name}</span>
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

      {/* Desktop top bar — matches CMS admin */}
      <header className="crm-topbar hidden md:flex">
        <div className="crm-topbar__section crm-topbar__section--start" aria-hidden="true" />

        <div className="crm-topbar__section crm-topbar__section--center">
          <p className="crm-brand">Traguin Admin CRM</p>
        </div>

        <div className="crm-topbar__section crm-topbar__section--end">
          <CrmProductSwitcher />

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

          <div className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={showProfileDropdown}
              aria-label="Account menu"
              onClick={() => setShowProfileDropdown(!showProfileDropdown)}
              className={`group flex max-w-[min(100%,16rem)] items-center gap-2 rounded-xl border border-border bg-secondary/40 py-1.5 pl-2 pr-2 transition-all hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                showProfileDropdown ? 'border-primary/40 ring-1 ring-primary/25' : ''
              }`}
            >
              <span className="crm-avatar h-8 w-8 text-[11px] shrink-0">
                {currentUser?.name?.charAt(0) ?? '?'}
              </span>
              <div className="hidden min-w-0 flex-1 text-left sm:block">
                <span className="block max-w-[9rem] truncate text-[11px] font-semibold leading-tight text-foreground">
                  {(currentUser?.name ?? '').split(/\s+/)[0] || 'Account'}
                </span>
                <span className="block max-w-[9rem] truncate text-[9px] font-medium leading-tight text-muted-foreground">
                  {currentUser?.role ?? ''}
                </span>
              </div>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background/50">
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                    showProfileDropdown ? 'rotate-180' : ''
                  }`}
                />
              </span>
            </button>

            {showProfileDropdown && (
              <div className="crm-dropdown w-48">
                <div className="px-3 py-2 border-b border-border bg-secondary/30">
                  <span className="block text-xs font-semibold">{currentUser?.name}</span>
                  <span className="block text-[10px] text-muted-foreground">{currentUser?.email}</span>
                </div>
                {showWorkspaceSettingsNav && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileDropdown(false);
                      router.push('/dashboard/settings');
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-secondary transition-colors flex items-center gap-2"
                  >
                    <Settings className="w-3.5 h-3.5 text-muted-foreground" />
                    Workspace settings
                  </button>
                )}
                {canViewStaffPortal && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileDropdown(false);
                      router.push('/dashboard/employees');
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-secondary transition-colors"
                  >
                    My Access Rights
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2 text-xs text-destructive hover:bg-destructive/10 transition-colors border-t border-border flex items-center space-x-2"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Logout Session</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="crm-body min-h-0 flex-1">
        {/* Sidebar - Desktop */}
        <aside className="crm-sidebar hidden md:flex md:h-full md:min-h-0 flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-0.5">
            <div className="flex items-center space-x-3 px-2 py-1">
              <AgencyLogo
                name={currentAgency.name}
                logoUrl={currentAgency.logoUrl}
                className="w-10 h-10 rounded-lg object-cover"
              />
              <div className="flex flex-col min-w-0">
                <span className="font-semibold tracking-tight text-sm truncate">{currentAgency.name}</span>
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                  {currentAgency.subscriptionPlan} PLAN
                </span>
              </div>
            </div>

            <nav className="space-y-0.5" aria-label="CRM navigation">
              {filteredNavigation.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`crm-nav-link group ${isActive ? 'crm-nav-link--active' : ''} ${
                      workspacePreferences.sidebarCompact ? 'crm-nav-link--compact' : ''
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 transition-transform ${isActive ? '' : 'group-hover:scale-110'}`} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="crm-sidebar-footer space-y-3 shrink-0">
            {showWorkspaceSettingsNav && (
              <Link
                href="/dashboard/settings"
                className={`crm-nav-link ${pathname === '/dashboard/settings' ? 'crm-nav-link--active' : ''} ${
                  workspacePreferences.sidebarCompact ? 'crm-nav-link--compact' : ''
                }`}
              >
                <Settings className="w-4 h-4 shrink-0" aria-hidden />
                <span>Settings</span>
              </Link>
            )}

            <div className="crm-user-chip">
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold truncate">{currentUser?.name}</span>
                <span className="text-[10px] text-muted-foreground truncate">{currentUser?.role}</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile Slide-over navigation panel */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 md:hidden flex justify-end">
            <div className="w-72 bg-card h-full p-4 flex flex-col border-l border-border animate-slide-in min-h-0">
              <div className="flex-1 min-h-0 overflow-y-auto space-y-6">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <span className="font-semibold text-sm">Menu Options</span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="crm-icon-btn"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <nav className="space-y-0.5">
                  {filteredNavigation.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`crm-nav-link ${isActive ? 'crm-nav-link--active' : ''}`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </nav>
              </div>

              <div className="crm-sidebar-footer space-y-2 shrink-0">
                {showWorkspaceSettingsNav && (
                  <Link
                    href="/dashboard/settings"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`crm-nav-link ${pathname === '/dashboard/settings' ? 'crm-nav-link--active' : ''}`}
                  >
                    <Settings className="w-4 h-4 shrink-0" />
                    <span>Settings</span>
                  </Link>
                )}
                <div className="crm-user-chip">
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold truncate">{currentUser?.name}</span>
                    <span className="text-[10px] text-muted-foreground">{currentUser?.role}</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="crm-icon-btn text-destructive hover:bg-destructive/10"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <main
          className={`crm-main ${
            workspacePreferences.densePagePadding ? 'p-3 md:p-4' : 'p-4 md:p-6'
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
