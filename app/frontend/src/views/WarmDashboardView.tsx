/**
 * Layer: Frontend View
 * Responsibility: Implements the redesigned admin dashboard screen and coordinates API-driven data binding.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CircleDollarSign,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Sparkles,
  Sprout,
  Users,
  CalendarCheck,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AXIOS_INSTANCE } from '@/lib/http';
import { useAuth } from '@/App';
import { UserRole, isSuperAdminRole } from '@/types';

interface DashboardStats {
  totalWorkers: number;
  totalBases: number;
  allBases: number;
  todayCheckedIn: number;
  todaySignedUp: number;
  monthlyPaid: number;
  monthlyPending: number;
  monthlyTotal: number;
  pendingAuditUsers: number;
  pendingAuditBases: number;
}

interface TrendDay {
  date: string;
  label: string;
  checkedIn: number;
  signedUp: number;
  salary: number;
}

interface CategoryItem {
  name: string;
  value: number;
  count: number;
  color: string;
}

interface RecentBase {
  id: number;
  name: string;
  category: string;
  regionCode: number;
  address: string;
  auditStatus: number;
  auditStatusText: string;
  createdAt: string;
}

const tooltipStyle = {
  backgroundColor: 'rgba(255, 250, 242, 0.96)',
  border: '1px solid rgba(191, 145, 68, 0.16)',
  borderRadius: '18px',
  color: '#231a12',
  boxShadow: '0 16px 40px rgba(181, 121, 23, 0.14)',
};

function formatMoney(value: number) {
  if (value >= 10000) return `¥ ${(value / 10000).toFixed(1)} 万`;
  if (value >= 1000) return `¥ ${(value / 1000).toFixed(1)}k`;
  return `¥ ${value}`;
}

function formatDate(dateStr: string) {
  return dateStr ? dateStr.slice(0, 10) : '-';
}

function getAuditTone(status: number) {
  if (status === 1) {
    return {
      dot: 'status-dot-success',
      text: 'text-[#2f9e69]',
      badge: 'bg-[#edf9f2] text-[#2f9e69]',
    };
  }

  if (status === 2) {
    return {
      dot: 'status-dot-danger',
      text: 'text-[#d8644f]',
      badge: 'bg-[#fff1ee] text-[#d8644f]',
    };
  }

  return {
    dot: 'status-dot-warn',
    text: 'text-[#c57e11]',
    badge: 'bg-[#fff4dd] text-[#c57e11]',
  };
}

export default function WarmDashboardView() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role as string;
  const isGlobal = isSuperAdminRole(role);

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trend, setTrend] = useState<TrendDay[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [recentBases, setRecentBases] = useState<RecentBase[]>([]);

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);

      try {
        const [statsRes, trendRes, categoryRes, baseRes] = await Promise.all([
          AXIOS_INSTANCE.get('/api/dashboard/stats'),
          AXIOS_INSTANCE.get('/api/dashboard/trend'),
          AXIOS_INSTANCE.get('/api/dashboard/category'),
          AXIOS_INSTANCE.get('/api/dashboard/recent-bases'),
        ]);

        setStats(statsRes.data);
        setTrend(trendRes.data);
        setCategories(categoryRes.data);
        setRecentBases(baseRes.data);
      } catch (error) {
        console.error('Failed to load dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="soft-card flex h-64 items-center justify-center gap-3 p-6">
        <Loader2 size={24} className="animate-spin text-[#c57e11]" />
        <span className="text-sm text-[var(--muted)]">正在加载首页数据...</span>
      </div>
    );
  }

  const statCards = stats
    ? [
        {
          icon: Users,
          label: '活跃工人',
          value: stats.totalWorkers.toLocaleString(),
          meta: `${stats.pendingAuditUsers} 人待审核`,
        },
        {
          icon: Sprout,
          label: '合作基地',
          value: `${stats.totalBases}`,
          meta: `共 ${stats.allBases} 个基地`,
        },
        {
          icon: CircleDollarSign,
          label: '本月结算',
          value: formatMoney(stats.monthlyTotal),
          meta: `已发 ${formatMoney(stats.monthlyPaid)}`,
        },
        {
          icon: CalendarCheck,
          label: '今日签到',
          value: `${stats.todayCheckedIn}`,
          meta: `报名 ${stats.todaySignedUp} 人`,
        },
      ]
    : [];

  return (
    <div className="app-grid pb-8">
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="soft-card-strong p-6 md:p-8"
      >
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="mini-badge">
              <Sparkles size={14} />
              {isGlobal ? 'Platform Overview' : role === UserRole.BASE_MANAGER ? 'Base Overview' : 'Work Overview'}
            </div>
            <h2 className="page-title max-w-3xl">
              把关键数据做成像产品海报一样清楚的首页，而不是一堆堆挤在一起的模块。
            </h2>
            <p className="page-subtitle">
              欢迎回来{user?.name ? `，${user.name}` : ''}。这块区域借用了参考图的轻柔暖橙质感，但用更适合后台的方式重组了信息层级。
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate('/dashboard/attendance')}
                className="app-button"
              >
                查看今日考勤
              </button>
              {(isGlobal || role === UserRole.BASE_MANAGER) && (
                <button
                  type="button"
                  onClick={() => navigate('/dashboard/bases')}
                  className="app-button app-button-secondary"
                >
                  管理基地与岗位
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="paper-panel p-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a2814a]">
                今日节奏
              </p>
              <p className="mt-3 text-3xl font-extrabold tracking-tight text-[var(--ink)]">
                {stats?.todayCheckedIn ?? 0}
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">已签到工人</p>
            </div>

            <div className="paper-panel p-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a2814a]">
                月度薪资
              </p>
              <p className="mt-3 text-3xl font-extrabold tracking-tight text-[var(--ink)]">
                {formatMoney(stats?.monthlyTotal ?? 0)}
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">结算总额</p>
            </div>

            <div className="paper-panel p-5 sm:col-span-2">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a2814a]">
                灵感转译
              </p>
              <div className="mt-4 phone-stack">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="phone-tile">
                    <div className="phone-screen">
                      <div className="phone-bar" />
                      <div className="phone-chip" />
                      <div className="phone-line" style={{ width: `${84 - item * 12}%` }} />
                      <div className="phone-line" style={{ width: `${60 + item * 8}%` }} />
                      <div className="phone-grid">
                        <span />
                        <span />
                        <span />
                        <span />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((item) => (
          <div key={item.label} className="soft-card metric-card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[var(--muted)]">{item.label}</p>
                <p className="metric-value mt-4 text-[var(--ink)]">{item.value}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[#2b221b] text-[#ffd16d]">
                <item.icon size={22} />
              </div>
            </div>
            <p className="metric-muted mt-4">{item.meta}</p>
          </div>
        ))}
      </section>

      {stats && (stats.pendingAuditUsers > 0 || stats.pendingAuditBases > 0) ? (
        <section className="grid gap-4 lg:grid-cols-2">
          {stats.pendingAuditUsers > 0 ? (
            <button
              type="button"
              onClick={() => navigate(isGlobal ? '/dashboard/audit' : '/dashboard/workers')}
              className="soft-card flex items-center gap-4 p-5 text-left transition hover:-translate-y-[1px]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff4dd] text-[#c57e11]">
                <AlertTriangle size={22} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-[var(--ink)]">用户审核提醒</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  当前有 {stats.pendingAuditUsers} 位用户资料等待处理。
                </p>
              </div>
              <ArrowUpRight size={18} className="text-[#c57e11]" />
            </button>
          ) : null}

          {stats.pendingAuditBases > 0 ? (
            <button
              type="button"
              onClick={() => navigate(isGlobal ? '/dashboard/audit' : '/dashboard/bases')}
              className="soft-card flex items-center gap-4 p-5 text-left transition hover:-translate-y-[1px]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef2ff] text-[#6177d6]">
                <ShieldCheck size={22} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-[var(--ink)]">基地入驻提醒</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  当前有 {stats.pendingAuditBases} 个基地等待审核入驻。
                </p>
              </div>
              <ArrowUpRight size={18} className="text-[#6177d6]" />
            </button>
          ) : null}
        </section>
      ) : null}

      <section className={`grid gap-4 ${isGlobal || role === UserRole.BASE_MANAGER ? 'xl:grid-cols-[1.5fr_0.9fr]' : ''}`}>
        <div className="soft-card chart-card p-6">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="section-label">Attendance Trend</p>
              <h3 className="mt-3 text-xl font-bold text-[var(--ink)]">签到与报名趋势</h3>
            </div>
          </div>

          <div className="h-[320px]">
            {trend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="warmCheckedIn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f4b233" stopOpacity={0.36} />
                      <stop offset="95%" stopColor="#f4b233" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="warmSignedUp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6177d6" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="#6177d6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#8f7b63', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8f7b63', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number, name: string) => [
                      value,
                      name === 'checkedIn' ? '签到人数' : '报名人数',
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="signedUp"
                    stroke="#6177d6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#warmSignedUp)"
                  />
                  <Area
                    type="monotone"
                    dataKey="checkedIn"
                    stroke="#f4b233"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#warmCheckedIn)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
                暂无趋势数据
              </div>
            )}
          </div>
        </div>

        {(isGlobal || role === UserRole.BASE_MANAGER) && (
          <div className="soft-card chart-card p-6">
            <p className="section-label">Category Mix</p>
            <h3 className="mt-3 text-xl font-bold text-[var(--ink)]">基地类型分布</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
              用更轻的图表和更少的装饰，保留信息密度，但减少压迫感。
            </p>

            <div className="mt-6 h-[250px]">
              {categories.length > 0 && categories.some((item) => item.count > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categories} layout="vertical">
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#8f7b63', fontSize: 12 }}
                      width={68}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(244, 178, 51, 0.08)' }}
                      contentStyle={tooltipStyle}
                      formatter={(value: number) => [`${value}%`, '占比']}
                    />
                    <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={18}>
                      {categories.map((item) => (
                        <Cell key={item.name} fill={item.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
                  暂无分类数据
                </div>
              )}
            </div>

            <div className="list-rows mt-5">
              {categories.map((item) => (
                <div key={item.name} className="list-row">
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-sm font-semibold text-[var(--ink)]">{item.name}</span>
                  </div>
                  <span className="text-sm text-[var(--muted)]">
                    {item.count} 个 / {item.value}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {(isGlobal || role === UserRole.BASE_MANAGER) && (
        <section className="soft-card p-6">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="section-label">Recent Bases</p>
              <h3 className="mt-3 text-xl font-bold text-[var(--ink)]">最新入驻基地</h3>
            </div>
            <button
              type="button"
              onClick={() => navigate('/dashboard/bases')}
              className="mini-badge"
            >
              查看全部
              <ExternalLink size={14} />
            </button>
          </div>

          <div className="list-rows">
            {recentBases.length > 0 ? (
              recentBases.map((base) => {
                const tone = getAuditTone(base.auditStatus);

                return (
                  <div key={base.id} className="list-row">
                    <div className="flex min-w-0 flex-1 items-center gap-4">
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-[#2b221b] text-[#ffd16d]">
                        <Building2 size={20} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[var(--ink)]">{base.name}</p>
                        <p className="truncate text-sm text-[var(--muted)]">{base.address}</p>
                      </div>
                    </div>

                    <div className="hidden text-sm text-[var(--muted)] lg:block">{base.category}</div>

                    <div className={`rounded-full px-3 py-2 text-sm font-semibold ${tone.badge}`}>
                      <span className={`mr-2 inline-block align-middle status-dot ${tone.dot}`} />
                      {base.auditStatusText}
                    </div>

                    <div className="hidden text-sm text-[var(--muted)] md:block">
                      {formatDate(base.createdAt)}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="list-row">
                <span className="text-sm text-[var(--muted)]">暂无最新入驻基地</span>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
