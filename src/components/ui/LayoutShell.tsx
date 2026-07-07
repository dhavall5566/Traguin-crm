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
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
  CheckCheck,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { prefetchCrmNavRoute } from '@/lib/api/crm-prefetch';
import { useAuditLogFeed } from '@/hooks/useAuditLogFeed';
import { usePendingLeadAssignments } from '@/hooks/usePendingLeadAssignments';
import { useLeadRealtimeNotifications, CRM_LEAD_INBOUND_EVENT } from '@/hooks/useLeadRealtimeNotifications';
import { useLeadNotifications, type LeadNotificationItem } from '@/lib/lead-notifications';
import { LeadAssignmentNotificationEntry } from '@/components/crm/LeadAssignmentNotificationEntry';
import {
  formatAuditLogDetails,
  getAuditNotificationHref,
  isAuditNotificationClickable,
} from '@/lib/audit-notification-routes';
import { CRM_NAV_GROUPS, type CrmNavGroup, type CrmNavItem } from '@/lib/crm-nav-config';
import { getCrmBreadcrumbLabel } from '@/lib/crm-breadcrumbs';
import { traguinLogo, TRAGUIN_LOGO_SRC } from '@/lib/brand/traguin-logo';

function navItemIsActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === href;
  if (href.endsWith('/general') && pathname === '/dashboard/settings') return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function navTreeHasActive(pathname: string, item: CrmNavItem): boolean {
  const onLanding =
    pathname === item.href ||
    (item.href.endsWith('/general') && pathname === '/dashboard/settings');
  if (!item.children?.length) return navItemIsActive(pathname, item.href);
  return onLanding || item.children.some((child) => navTreeHasActive(pathname, child));
}

function navParentLinkIsActive(pathname: string, item: CrmNavItem): boolean {
  return (
    pathname === item.href ||
    (item.href.endsWith('/general') && pathname === '/dashboard/settings')
  );
}

function filterNavItems(items: CrmNavItem[], canViewItem: (item: CrmNavItem) => boolean): CrmNavItem[] {
  return items
    .map((item) => {
      if (item.children?.length) {
        const children = filterNavItems(item.children, canViewItem);
        if (children.length === 0) return null;
        return { ...item, children };
      }
      return canViewItem(item) ? item : null;
    })
    .filter((item): item is CrmNavItem => item !== null);
}

function prefetchNavTree(item: CrmNavItem, onPrefetch: (href: string) => void) {
  onPrefetch(item.href);
  if (item.children?.length) {
    item.children.forEach((child) => prefetchNavTree(child, onPrefetch));
  }
}

function CrmAccountBar({
  name,
  role,
  initials,
  onLogout,
  className,
}: {
  name: string;
  role: string;
  initials: string;
  onLogout: () => void;
  className?: string;
}) {
  return (
    <div className={`crm-account-bar${className ? ` ${className}` : ''}`}>
      <div className="crm-account-bar__identity">
        <span className="crm-account-bar__avatar" aria-hidden>
          {initials}
        </span>
        <div className="crm-account-bar__meta">
          <span className="crm-account-bar__name">{name}</span>
          <span className="crm-account-bar__role">{role}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={onLogout}
        className="crm-account-bar__logout"
        title="Sign out"
        aria-label="Sign out"
      >
        <LogOut className="w-4 h-4" aria-hidden />
      </button>
    </div>
  );
}

function SidebarNavItem({
  item,
  pathname,
  onNavigate,
  onPrefetch,
  depth = 0,
}: {
  item: CrmNavItem;
  pathname: string;
  onNavigate?: () => void;
  onPrefetch: (href: string) => void;
  depth?: number;
}) {
  const children = item.children ?? [];
  const hasChildren = children.length > 0;
  const parentLinkActive = hasChildren && navParentLinkIsActive(pathname, item);
  const childBranchActive =
    hasChildren && children.some((child) => navTreeHasActive(pathname, child));
  const branchActive = hasChildren && navTreeHasActive(pathname, item);
  const [expanded, setExpanded] = useState(() => Boolean(branchActive));

  useEffect(() => {
    if (branchActive) setExpanded(true);
  }, [branchActive]);

  if (hasChildren) {
    const Icon = item.icon;
    const sectionActive = Boolean(parentLinkActive);
    const sectionOpen = Boolean(childBranchActive && !parentLinkActive);

    return (
      <div
        className={`crm-nav-section ${expanded ? 'crm-nav-section--open' : ''} ${sectionOpen ? 'crm-nav-section--open-branch' : ''}`}
      >
        <div className="crm-nav-section__header">
          <Link
            href={item.href}
            onClick={onNavigate}
            onMouseEnter={() => onPrefetch(item.href)}
            onFocus={() => onPrefetch(item.href)}
            className={`crm-nav-link crm-nav-section__link ${sectionActive ? 'crm-nav-link--active' : sectionOpen ? 'crm-nav-section__link--branch' : ''}`}
            aria-current={sectionActive ? 'page' : undefined}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span>{item.name}</span>
          </Link>
          <button
            type="button"
            className="crm-nav-section__toggle"
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${item.name}`}
            onClick={() => setExpanded((open) => !open)}
          >
            {expanded ? (
              <ChevronDown className="w-4 h-4" aria-hidden />
            ) : (
              <ChevronRight className="w-4 h-4" aria-hidden />
            )}
          </button>
        </div>
        {expanded ? (
          <div className="crm-nav-section__panel" role="group" aria-label={`${item.name} subtabs`}>
            {children.map((child) => (
              <SidebarNavItem
                key={`${item.name}-${child.name}`}
                item={child}
                pathname={pathname}
                onNavigate={onNavigate}
                onPrefetch={onPrefetch}
                depth={depth + 1}
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <SidebarNavLink
      item={item}
      pathname={pathname}
      onNavigate={onNavigate}
      onPrefetch={onPrefetch}
      nested={depth > 0}
    />
  );
}

function SidebarNavLink({
  item,
  pathname,
  onNavigate,
  onPrefetch,
  nested = false,
}: {
  item: CrmNavItem;
  pathname: string;
  onNavigate?: () => void;
  onPrefetch: (href: string) => void;
  nested?: boolean;
}) {
  const isActive = navItemIsActive(pathname, item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      onMouseEnter={() => onPrefetch(item.href)}
      onFocus={() => onPrefetch(item.href)}
      className={`${nested ? 'crm-nav-subtab' : 'crm-nav-link group'} ${isActive ? (nested ? 'crm-nav-subtab--active' : 'crm-nav-link--active') : ''}`}
      aria-current={isActive ? 'page' : undefined}
    >
      {!nested && <Icon className="w-4 h-4 shrink-0" />}
      <span>{item.name}</span>
    </Link>
  );
}

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
            {group.items.map((item) => (
              <SidebarNavItem
                key={`${group.label}-${item.name}`}
                item={item}
                pathname={pathname}
                onNavigate={onNavigate}
                onPrefetch={onPrefetch}
              />
            ))}
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
      return 'crm-notif-item__badge--create';
    case 'UPDATE':
      return 'crm-notif-item__badge--update';
    case 'DELETE':
      return 'crm-notif-item__badge--delete';
    case 'LOGIN':
      return 'crm-notif-item__badge--login';
    default:
      return 'crm-notif-item__badge--default';
  }
}

function formatActionLabel(action: string): string {
  if (!action) return 'Activity';
  return action.charAt(0) + action.slice(1).toLowerCase();
}

function initialsFromName(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || '?'
  );
}

/** Shorten raw UUIDs in audit copy for scan-friendly notifications. */
function formatAuditDetails(details: string): string {
  return formatAuditLogDetails(details);
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

function LeadNotificationEntry({
  item,
  onOpen,
}: {
  item: LeadNotificationItem;
  onOpen: () => void;
}) {
  return (
    <button type="button" onClick={onOpen} className="crm-notif-item crm-notif-item--clickable">
      <span
        className={`crm-notif-item__avatar ${item.kind === 'new' ? 'crm-notif-item__avatar--lead-new' : 'crm-notif-item__avatar--lead-return'}`}
        aria-hidden
      >
        {item.kind === 'new' ? 'N' : 'R'}
      </span>
      <div className="crm-notif-item__body">
        <div className="crm-notif-item__top">
          <span className="crm-notif-item__actor">Live alert</span>
          <span
            className={`crm-notif-item__badge ${item.kind === 'new' ? 'crm-notif-item__badge--create' : 'crm-notif-item__badge--update'}`}
          >
            {item.kind === 'new' ? 'New lead' : 'Returning'}
          </span>
          <span className="crm-notif-item__entity">Lead</span>
        </div>
        <p className="crm-notif-item__detail">{item.message}</p>
      </div>
      <div className="crm-notif-item__aside">
        <time className="crm-notif-item__time" title={new Date(item.createdAt).toLocaleString()}>
          {formatLogTime(item.createdAt)}
        </time>
        <ArrowUpRight className="crm-notif-item__chevron" aria-hidden />
      </div>
    </button>
  );
}

function AuditLogEntry({
  log,
  onOpen,
}: {
  log: AuditLog;
  onOpen?: () => void;
}) {
  const clickable = Boolean(onOpen && isAuditNotificationClickable(log));
  const shellClass = `crm-notif-item${clickable ? ' crm-notif-item--clickable' : ''}`;

  const inner = (
    <>
      <span className="crm-notif-item__avatar" aria-hidden>
        {initialsFromName(log.userName)}
      </span>
      <div className="crm-notif-item__body">
        <div className="crm-notif-item__top">
          <span className="crm-notif-item__actor">{log.userName}</span>
          <span className={`crm-notif-item__badge ${getActionBadgeClass(log.action)}`}>
            {formatActionLabel(log.action)}
          </span>
          <span className="crm-notif-item__entity">{log.entityType}</span>
        </div>
        <p className="crm-notif-item__detail">{formatAuditDetails(log.details)}</p>
      </div>
      <div className="crm-notif-item__aside">
        <time className="crm-notif-item__time" title={new Date(log.createdAt).toLocaleString()}>
          {formatLogTime(log.createdAt)}
        </time>
        {clickable ? <ArrowUpRight className="crm-notif-item__chevron" aria-hidden /> : null}
      </div>
    </>
  );

  if (!clickable) {
    return <div className={shellClass}>{inner}</div>;
  }

  return (
    <button type="button" onClick={onOpen} className={shellClass}>
      {inner}
    </button>
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
  const authStatus = useStore((state) => state.authStatus);
  const clearAuthSession = useStore((state) => state.clearAuthSession);
  const roleDefinitions = useStore((state) => state.roleDefinitions);
  const { auditLogs, refresh: refreshAuditLogs } = useAuditLogFeed(Boolean(currentUser));
  const leadNotifications = useLeadNotifications();
  const {
    items: pendingAssignments,
    accept: acceptAssignment,
    reject: rejectAssignment,
    actionId: assignmentActionId,
    refresh: refreshPendingAssignments,
  } = usePendingLeadAssignments(authStatus === 'authenticated' && Boolean(currentUser));

  const isDashboardRoute = pathname.startsWith('/dashboard');
  useLeadRealtimeNotifications(authStatus === 'authenticated' && isDashboardRoute);

  const agencyAuditLogs = useMemo(
    () =>
      auditLogs
        .filter((log) => log.agencyId === currentAgency.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [auditLogs, currentAgency.id]
  );

  const notificationFeed = useMemo(() => {
    type FeedItem =
      | { kind: 'assignment'; sortAt: string; assignment: (typeof pendingAssignments)[number] }
      | { kind: 'lead'; sortAt: string; lead: LeadNotificationItem }
      | { kind: 'audit'; sortAt: string; log: AuditLog };

    const items: FeedItem[] = [
      ...pendingAssignments.map((assignment) => ({
        kind: 'assignment' as const,
        sortAt: assignment.updatedAt,
        assignment,
      })),
      ...leadNotifications.map((lead) => ({
        kind: 'lead' as const,
        sortAt: lead.createdAt,
        lead,
      })),
      ...agencyAuditLogs.map((log) => ({
        kind: 'audit' as const,
        sortAt: log.createdAt,
        log,
      })),
    ];

    return items
      .sort((a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime())
      .slice(0, 12);
  }, [agencyAuditLogs, leadNotifications, pendingAssignments]);

  const unreadCount = useMemo(() => {
    const assignmentCount = pendingAssignments.length;
    if (!lastSeenAt) return assignmentCount;
    const unreadAudits = agencyAuditLogs.filter((log) => log.createdAt > lastSeenAt).length;
    const unreadLeads = leadNotifications.filter((item) => item.createdAt > lastSeenAt).length;
    return assignmentCount + unreadAudits + unreadLeads;
  }, [agencyAuditLogs, lastSeenAt, leadNotifications, pendingAssignments]);

  const filteredNavGroups = useMemo((): CrmNavGroup[] => {
    if (!currentUser) return [];
    const agencyId = currentAgency.id;

    const canViewItem = (item: CrmNavItem) => {
      if (item.rbacModule === 'workspace_settings') {
        return canAccessModuleView(
          currentUser.role,
          agencyId,
          'workspace_settings',
          roleDefinitions,
        );
      }
      return canAccessModuleView(currentUser.role, agencyId, item.rbacModule, roleDefinitions);
    };

    return CRM_NAV_GROUPS.map((group) => ({
      ...group,
      items: filterNavItems(group.items, canViewItem),
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
      void refreshPendingAssignments();
      refreshAuditLogs();
      window.dispatchEvent(new CustomEvent(CRM_LEAD_INBOUND_EVENT));
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
      group.items.forEach((item) => prefetchNavTree(item, prefetchCrmNavRoute)),
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

  const handleOpenLeadNotification = (leadId: string) => {
    handleDismissNotifications();
    router.push(`/dashboard/crm?openLead=${encodeURIComponent(leadId)}`);
  };

  const handleOpenAuditNotification = (log: AuditLog) => {
    const href = getAuditNotificationHref(log);
    if (!href) return;
    handleDismissNotifications();
    router.push(href);
  };

  const handleAcceptAssignment = async (leadId: string) => {
    await acceptAssignment(leadId);
    handleDismissNotifications();
    router.push(`/dashboard/crm?openLead=${encodeURIComponent(leadId)}`);
  };

  const handleRejectAssignment = async (leadId: string) => {
    await rejectAssignment(leadId);
  };

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
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-[9px] font-bold text-white flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="crm-notif-panel" role="dialog" aria-label="Recent activity">
                  <header className="crm-notif-panel__head">
                    <div className="crm-notif-panel__intro">
                      <p className="crm-notif-panel__eyebrow">Activity feed</p>
                      <h2 className="crm-notif-panel__title">Recent Activity</h2>
                      <p className="crm-notif-panel__meta">
                        {notificationFeed.length} update{notificationFeed.length === 1 ? '' : 's'} ·{' '}
                        {currentAgency.name}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleDismissNotifications}
                      className="crm-notif-panel__mark-read"
                      title="Mark all as read"
                    >
                      <CheckCheck className="w-3.5 h-3.5" aria-hidden />
                      Mark read
                    </button>
                  </header>

                  <div className="crm-notif-panel__list">
                    {notificationFeed.length > 0 ? (
                      notificationFeed.map((entry, i) =>
                        entry.kind === 'assignment' ? (
                          <LeadAssignmentNotificationEntry
                            key={`assignment-${entry.assignment.id}-${i}`}
                            item={entry.assignment}
                            busy={assignmentActionId === entry.assignment.id}
                            onAccept={() => void handleAcceptAssignment(entry.assignment.id)}
                            onReject={() => void handleRejectAssignment(entry.assignment.id)}
                          />
                        ) : entry.kind === 'lead' ? (
                          <LeadNotificationEntry
                            key={`lead-${entry.lead.id}-${i}`}
                            item={entry.lead}
                            onOpen={() => handleOpenLeadNotification(entry.lead.leadId)}
                          />
                        ) : (
                          <AuditLogEntry
                            key={`audit-${entry.log.id}-${i}`}
                            log={entry.log}
                            onOpen={() => handleOpenAuditNotification(entry.log)}
                          />
                        ),
                      )
                    ) : (
                      <div className="crm-notif-panel__empty">
                        <Bell className="crm-notif-panel__empty-icon" aria-hidden />
                        <p>No activity yet</p>
                        <span>New leads, assignments, and CRM actions will appear here.</span>
                      </div>
                    )}
                  </div>

                  {canViewStaffPortal && agencyAuditLogs.length > 0 && (
                    <footer className="crm-notif-panel__foot">
                      <button
                        type="button"
                        onClick={() => {
                          handleDismissNotifications();
                          router.push('/dashboard/employees');
                        }}
                        className="crm-notif-panel__trail"
                      >
                        View full audit trail
                        <ArrowUpRight className="w-3.5 h-3.5" aria-hidden />
                      </button>
                    </footer>
                  )}
                </div>
              )}
            </div>

            <CrmAccountBar
              className="crm-account-bar--topbar"
              name={currentUser?.name ?? 'Account'}
              role={currentUser?.role ?? ''}
              initials={userInitials}
              onLogout={() => void handleLogout()}
            />
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
              <CrmAccountBar
                name={currentUser?.name ?? 'Account'}
                role={currentUser?.role ?? ''}
                initials={userInitials}
                onLogout={() => {
                  setMobileMenuOpen(false);
                  void handleLogout();
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
