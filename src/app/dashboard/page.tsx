'use client';

import React from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { useDashboardPage } from '@/hooks/useDashboardPage';
import { useClientPagination } from '@/hooks/useClientPagination';
import { CrmTablePagination } from '@/components/ui/CrmTablePagination';
import { CrmTablePanel } from '@/components/ui/CrmTablePanel';
import {
  Users,
  Compass,
  MapPin,
  DollarSign,
  CreditCard,
  TrendingUp,
  Activity,
  Calendar,
  Award,
} from 'lucide-react';
import { CrmChartTooltip } from '@/components/charts/CrmChartTooltip';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

export default function DashboardPage() {
  const currentAgency = useStore((state) => state.currentAgency);
  const {
    loading,
    backgroundLoading,
    error,
    auditLogs,
    totalLeadsCount,
    activeItinCount,
    bookingsCount,
    totalRevenue,
    pendingPayments,
    paymentCount,
    weeklyLeadGrowth,
    sentItineraries,
    processingBookings,
    conversionData,
    revenueTrendData,
    agentPerformance,
  } = useDashboardPage();

  const agentPagination = useClientPagination(agentPerformance);

  const activePeriodLabel = new Date().toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  if (loading && totalLeadsCount === 0 && !error) {
    return (
      <div className="crm-dashboard">
        <header className="crm-dashboard__header">
          <div>
            <p className="crm-page-eyebrow">Operations overview</p>
            <h1 className="crm-page-title">Agency Command Dashboard</h1>
            <p className="crm-page-subtitle">Loading workspace metrics…</p>
          </div>
        </header>
        <div className="crm-stat-grid">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="crm-stat-card min-h-[6.75rem] animate-pulse bg-secondary/30" />
          ))}
        </div>
        <div className="crm-panel-grid crm-panel-grid--charts">
          <section className="crm-panel min-h-[18rem] animate-pulse bg-secondary/20" />
          <section className="crm-panel min-h-[18rem] animate-pulse bg-secondary/20" />
        </div>
      </div>
    );
  }

  const finalPieData =
    conversionData.length > 0
      ? conversionData
      : [{ name: 'No Leads', value: 1, color: '#374151' }];

  const growthLabel =
    weeklyLeadGrowth >= 0
      ? `+${weeklyLeadGrowth}% weekly growth`
      : `${weeklyLeadGrowth}% weekly growth`;

  return (
    <div className="crm-dashboard">
      {error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <header className="crm-dashboard__header">
        <div>
          <p className="crm-page-eyebrow">Operations overview</p>
          <h1 className="crm-page-title">Agency Command Dashboard</h1>
          <p className="crm-page-subtitle">
            Client pipelines, active bookings, and ledger accounts for {currentAgency.name}.
            {backgroundLoading ? ' Syncing latest records…' : ''}
          </p>
        </div>
        <div className="crm-dashboard__period">
          <Calendar className="w-4 h-4 text-primary shrink-0" />
          <span>Active period: {activePeriodLabel}</span>
        </div>
      </header>

      <div className="crm-stat-grid">
        <Link href="/dashboard/crm" className="crm-stat-card crm-stat-card--indigo">
          <div className="crm-stat-card__head">
            <span className="crm-stat-card__label">Total Leads CRM</span>
            <span className="crm-stat-card__icon">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="crm-stat-card__value">{totalLeadsCount}</div>
            <div
              className={`crm-stat-card__meta ${
                weeklyLeadGrowth >= 0 ? 'crm-stat-card__meta--positive' : 'crm-stat-card__meta--warning'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{growthLabel}</span>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/itinerary" className="crm-stat-card crm-stat-card--sky">
          <div className="crm-stat-card__head">
            <span className="crm-stat-card__label">Active Plans</span>
            <span className="crm-stat-card__icon">
              <Compass className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="crm-stat-card__value">{activeItinCount}</div>
            <div className="crm-stat-card__meta">{sentItineraries} proposal drafts sent</div>
          </div>
        </Link>

        <Link href="/dashboard/operations" className="crm-stat-card crm-stat-card--emerald">
          <div className="crm-stat-card__head">
            <span className="crm-stat-card__label">Ops Bookings</span>
            <span className="crm-stat-card__icon">
              <MapPin className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="crm-stat-card__value">{bookingsCount}</div>
            <div className="crm-stat-card__meta">{processingBookings} in processing queue</div>
          </div>
        </Link>

        <Link href="/dashboard/finance" className="crm-stat-card crm-stat-card--emerald">
          <div className="crm-stat-card__head">
            <span className="crm-stat-card__label">Collected Revenue</span>
            <span className="crm-stat-card__icon">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="crm-stat-card__value">₹{totalRevenue.toLocaleString('en-IN')}</div>
            <div className="crm-stat-card__meta crm-stat-card__meta--positive">
              From {paymentCount} transactions
            </div>
          </div>
        </Link>

        <Link href="/dashboard/finance" className="crm-stat-card crm-stat-card--amber">
          <div className="crm-stat-card__head">
            <span className="crm-stat-card__label">Outstanding Dues</span>
            <span className="crm-stat-card__icon">
              <CreditCard className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="crm-stat-card__value">₹{pendingPayments.toLocaleString('en-IN')}</div>
            <div className="crm-stat-card__meta crm-stat-card__meta--warning">Unpaid invoices balance</div>
          </div>
        </Link>
      </div>

      <div className="crm-panel-grid crm-panel-grid--charts">
        <section className="crm-panel">
          <div className="crm-panel__head">
            <h2 className="crm-panel__title">Revenue vs. Expenses Trend</h2>
            <Activity className="crm-panel__icon" />
          </div>
          <div className="crm-panel__body crm-panel__chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ec4899" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ stroke: 'rgba(100, 116, 139, 0.35)', strokeWidth: 1 }}
                  content={<CrmChartTooltip format="currency" />}
                />
                <Area
                  type="monotone"
                  dataKey="Revenue"
                  stroke="#6366f1"
                  fillOpacity={1}
                  fill="url(#colorRev)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="Expenses"
                  stroke="#ec4899"
                  fillOpacity={1}
                  fill="url(#colorExp)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="crm-panel">
          <div className="crm-panel__head">
            <h2 className="crm-panel__title">Lead Conversion Pipeline</h2>
            <Award className="crm-panel__icon" />
          </div>
          <div className="crm-panel__body crm-panel__chart crm-panel__chart--donut">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={finalPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {finalPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CrmChartTooltip format="number" />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="crm-panel__donut-center">
              <span className="crm-panel__donut-value">{totalLeadsCount}</span>
              <span className="crm-panel__donut-label">Leads total</span>
            </div>
          </div>
          <div className="crm-panel__legend">
            {finalPieData.map((item, idx) => (
              <div key={idx} className="crm-panel__legend-item">
                <span className="crm-panel__legend-dot" style={{ backgroundColor: item.color }} />
                <span className="truncate">
                  {item.name} ({item.value})
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="crm-panel-grid crm-panel-grid--split">
        <section className="crm-panel">
          <div className="crm-panel__head">
            <h2 className="crm-panel__title">Sales Rep Performance</h2>
            <Award className="crm-panel__icon" />
          </div>
          <div className="crm-panel__body overflow-x-auto">
            <CrmTablePanel>
            <div className="crm-table-wrap">
            <table className="crm-data-table">
              <thead>
                <tr>
                  <th>Agent Name</th>
                  <th className="text-center">Assigned</th>
                  <th className="text-center">Won</th>
                  <th className="text-center">Conv. %</th>
                  <th className="text-right">Revenue Won</th>
                </tr>
              </thead>
              <tbody>
                {agentPerformance.length > 0 ? (
                  agentPagination.pageItems.map((rep, idx) => (
                    <tr key={idx}>
                      <td>
                        <div className="crm-agent-cell">
                          <span className="crm-agent-avatar">{rep.name.charAt(0)}</span>
                          <span>{rep.name}</span>
                        </div>
                      </td>
                      <td className="text-center text-muted-foreground">{rep.assigned}</td>
                      <td className="text-center font-semibold text-emerald-600">{rep.confirmed}</td>
                      <td className="text-center font-medium">{rep.rate}%</td>
                      <td className="text-right font-bold text-emerald-600">
                        ₹{rep.volume.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="crm-data-table__empty">
                      No Sales Agent metrics recorded for this tenant.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {agentPerformance.length > 0 ? (
              <CrmTablePagination
                label="Sales reps"
                rangeStart={agentPagination.rangeStart}
                rangeEnd={agentPagination.rangeEnd}
                total={agentPagination.total}
                page={agentPagination.page}
                totalPages={agentPagination.totalPages}
                hasPrev={agentPagination.hasPrev}
                hasNext={agentPagination.hasNext}
                onPrev={agentPagination.goPrev}
                onNext={agentPagination.goNext}
                backgroundLoading={backgroundLoading}
              />
            ) : null}
            </div>
            </CrmTablePanel>
          </div>
        </section>

        <section className="crm-panel">
          <div className="crm-panel__head">
            <h2 className="crm-panel__title">Recent Security Audit Trail</h2>
            <span className="crm-badge crm-badge--secure">RLS Secured</span>
          </div>
          <div className="crm-panel__body crm-audit-list">
            {auditLogs.length > 0 ? (
              auditLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="crm-audit-item">
                  <div className="crm-audit-item__copy">
                    <div className="crm-audit-item__row">
                      <span className="crm-audit-item__user">{log.userName}</span>
                      <span
                        className={`crm-badge ${
                          log.action === 'CREATE'
                            ? 'crm-badge--create'
                            : log.action === 'UPDATE'
                              ? 'crm-badge--update'
                              : 'crm-badge--delete'
                        }`}
                      >
                        {log.action}
                      </span>
                    </div>
                    <p className="crm-audit-item__detail">{log.details}</p>
                  </div>
                  <span className="crm-audit-item__time">
                    {new Date(log.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))
            ) : (
              <div className="crm-data-table__empty">No audit trails logged.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
