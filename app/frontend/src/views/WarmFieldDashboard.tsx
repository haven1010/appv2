/**
 * Layer: Frontend View
 * Responsibility: Implements the redesigned field manager dashboard.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarCheck,
  Camera,
  CheckCircle2,
  Loader2,
  MapPin,
  Phone,
  RefreshCw,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AXIOS_INSTANCE } from '@/lib/http';
import { useAuth } from '@/App';

interface BaseInfo {
  id: number;
  baseName: string;
  category: number | string;
  address: string;
  contactPhone: string;
  auditStatus: number;
  createdAt: string;
  description: string;
}

interface BaseStatistics {
  baseId: number;
  baseName: string;
  statistics: {
    jobs: { total: number; active: number; recruiting: number; full: number };
    recruitment: { target: number; applied: number; completionRate: string };
  };
}

interface AttendanceStats {
  checkedIn: number;
  absent: number;
  signedUp: number;
  total: number;
  attendanceRate: number;
  date: string;
}

interface AttendanceRecord {
  id: number;
  workerName: string;
  workerUid: string;
  jobTitle: string;
  status: number;
  checkinTime: string | null;
}

interface TrendDay {
  date: string;
  label: string;
  checkedIn: number;
  signedUp: number;
}

const tooltipStyle = {
  backgroundColor: 'rgba(255, 250, 242, 0.96)',
  border: '1px solid rgba(191, 145, 68, 0.16)',
  borderRadius: '18px',
  color: '#231a12',
  boxShadow: '0 16px 40px rgba(181, 121, 23, 0.14)',
};

function getStatusLabel(status: number) {
  switch (status) {
    case 1:
      return '已签到';
    case 2:
      return '缺勤';
    case 3:
      return '已取消';
    default:
      return '已报名';
  }
}

function getStatusStyle(status: number) {
  switch (status) {
    case 1:
      return 'bg-[#edf9f2] text-[#2f9e69]';
    case 2:
      return 'bg-[#fff1ee] text-[#d8644f]';
    case 3:
      return 'bg-[#f5f0e6] text-[#7f6d55]';
    default:
      return 'bg-[#fff4dd] text-[#c57e11]';
  }
}

function formatTime(value: string | null) {
  return value
    ? new Date(value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    : '-';
}

function getCategoryLabel(category: number | string) {
  if (category === 1 || category === 'FRUIT') return '水果种植';
  if (category === 2 || category === 'VEGETABLE') return '蔬菜种植';
  if (category === 3 || category === 'OTHER') return '综合农业';
  return '未分类';
}

export default function WarmFieldDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [baseInfo, setBaseInfo] = useState<BaseInfo | null>(null);
  const [baseStats, setBaseStats] = useState<BaseStatistics | null>(null);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [trend, setTrend] = useState<TrendDay[]>([]);
  const [availableBases, setAvailableBases] = useState<Array<{ id: number; baseName: string }>>([]);
  const [bindingBaseId, setBindingBaseId] = useState('');
  const [bindLoading, setBindLoading] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      let resolvedBaseId: number | null = (user as any)?.assignedBaseId
        ? Number((user as any).assignedBaseId)
        : null;

      if (!resolvedBaseId) {
        try {
          const profileRes = await AXIOS_INSTANCE.get('/api/user/profile');
          if (profileRes.data?.assignedBaseId) {
            resolvedBaseId = Number(profileRes.data.assignedBaseId);
          }
        } catch {
          // Ignore the profile fallback when unavailable.
        }
      }

      const requests: Promise<any>[] = [
        AXIOS_INSTANCE.get('/api/attendance/stats', { params: { date: today } }),
        AXIOS_INSTANCE.get('/api/attendance/records', { params: { date: today } }),
        AXIOS_INSTANCE.get('/api/dashboard/trend'),
      ];

      if (resolvedBaseId) {
        requests.push(
          AXIOS_INSTANCE.get(`/api/base/${resolvedBaseId}`).catch(() => null),
          AXIOS_INSTANCE.get(`/api/base/${resolvedBaseId}/statistics`).catch(() => null),
        );
      }

      const [statsRes, recordsRes, trendRes, baseRes, baseStatRes] = await Promise.all(requests);

      setStats(statsRes.data);
      setRecords(recordsRes.data.records || []);
      setTrend(trendRes.data || []);
      if (baseRes?.data) setBaseInfo(baseRes.data);
      if (baseStatRes?.data) setBaseStats(baseStatRes.data);
    } catch (error) {
      console.error('Failed to load field dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, [today, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!loading && !baseInfo) {
      AXIOS_INSTANCE.get('/api/base', { params: { showAll: true } })
        .then((response) => {
          const list = Array.isArray(response.data)
            ? response.data.filter((item: any) => item.auditStatus === 1)
            : [];
          setAvailableBases(list);
        })
        .catch(() => undefined);
    }
  }, [baseInfo, loading]);

  const handleBindBase = async () => {
    if (!bindingBaseId) return;

    setBindLoading(true);
    try {
      await AXIOS_INSTANCE.patch('/api/user/profile', { assignedBaseId: Number(bindingBaseId) });

      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        parsed.assignedBaseId = Number(bindingBaseId);
        localStorage.setItem('user', JSON.stringify(parsed));
      }

      window.location.reload();
    } catch (error: any) {
      alert(error?.response?.data?.message || '绑定失败，请稍后重试。');
    } finally {
      setBindLoading(false);
    }
  };

  const pendingRecords = records.filter((record) => record.status === 0);

  if (loading) {
    return (
      <div className="soft-card flex h-64 items-center justify-center gap-3 p-6">
        <Loader2 size={24} className="animate-spin text-[#c57e11]" />
        <span className="text-sm text-[var(--muted)]">正在加载现场工作台...</span>
      </div>
    );
  }

  if (!baseInfo) {
    return (
      <div className="app-grid pb-8">
        <section className="soft-card-strong p-6 md:p-8">
          <p className="section-label">Field Assignment</p>
          <h2 className="page-title">当前账号还没有关联到有效基地。</h2>
          <p className="page-subtitle">
            请选择一个已审核通过的基地进行绑定，或者联系超级管理员分配基地后再进入现场工作台。
          </p>
        </section>

        <section className="soft-card p-6">
          <div className="max-w-xl">
            {availableBases.length > 0 ? (
              <>
                <select
                  value={bindingBaseId}
                  onChange={(event) => setBindingBaseId(event.target.value)}
                  className="app-select px-4"
                >
                  <option value="">请选择要关联的基地</option>
                  {availableBases.map((base) => (
                    <option key={base.id} value={base.id}>
                      {base.baseName} (ID: {base.id})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleBindBase}
                  disabled={!bindingBaseId || bindLoading}
                  className="app-button mt-4"
                >
                  {bindLoading ? <Loader2 size={18} className="animate-spin" /> : null}
                  {bindLoading ? '正在绑定' : '确认绑定'}
                </button>
              </>
            ) : (
              <p className="text-sm leading-7 text-[var(--muted)]">
                暂无可绑定基地，请先让基地管理员创建并通过审核。
              </p>
            )}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="app-grid pb-8">
      <section className="soft-card-strong p-6 md:p-8">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="section-label">Field Desk</p>
            <h2 className="page-title">现场工作台把签到、人员和基地状态集中到一屏里。</h2>
            <p className="page-subtitle">
              欢迎回来{user?.name ? `，${user.name}` : ''}。当前负责基地为 {baseInfo.baseName}，你可以直接从这里进入扫码签到、人员查看和当天进度检查。
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate('/dashboard/attendance')}
                className="app-button"
              >
                <Camera size={18} />
                扫码签到
              </button>
              <button
                type="button"
                onClick={loadData}
                className="app-button app-button-secondary"
              >
                <RefreshCw size={18} />
                刷新数据
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="paper-panel p-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a2814a]">
                今日签到
              </p>
              <p className="mt-3 text-3xl font-extrabold tracking-tight text-[var(--ink)]">
                {stats?.checkedIn ?? 0}
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">已到岗人数</p>
            </div>

            <div className="paper-panel p-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a2814a]">
                到岗率
              </p>
              <p className="mt-3 text-3xl font-extrabold tracking-tight text-[var(--ink)]">
                {stats?.attendanceRate ?? 0}%
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">签到 / 总报名</p>
            </div>

            <div className="paper-panel p-5 sm:col-span-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a2814a]">
                    当前基地
                  </p>
                  <p className="mt-3 text-xl font-bold text-[var(--ink)]">{baseInfo.baseName}</p>
                  <p className="mt-2 text-sm text-[var(--muted)]">{baseInfo.address || '暂无地址信息'}</p>
                </div>
                <div className="mini-badge">{getCategoryLabel(baseInfo.category)}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="soft-card metric-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[var(--muted)]">已签到</p>
              <p className="metric-value mt-4 text-[var(--ink)]">{stats?.checkedIn ?? 0}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[#edf9f2] text-[#2f9e69]">
              <CheckCircle2 size={22} />
            </div>
          </div>
        </div>

        <div className="soft-card metric-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[var(--muted)]">待签到</p>
              <p className="metric-value mt-4 text-[var(--ink)]">{stats?.signedUp ?? 0}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[#fff4dd] text-[#c57e11]">
              <CalendarCheck size={22} />
            </div>
          </div>
        </div>

        <div className="soft-card metric-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[var(--muted)]">缺勤</p>
              <p className="metric-value mt-4 text-[var(--ink)]">{stats?.absent ?? 0}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[#fff1ee] text-[#d8644f]">
              <XCircle size={22} />
            </div>
          </div>
        </div>

        <div className="soft-card metric-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[var(--muted)]">报名总数</p>
              <p className="metric-value mt-4 text-[var(--ink)]">{stats?.total ?? 0}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[#eef2ff] text-[#6177d6]">
              <Users size={22} />
            </div>
          </div>
        </div>
      </section>

      {pendingRecords.length > 0 ? (
        <button
          type="button"
          onClick={() => navigate('/dashboard/attendance')}
          className="soft-card flex items-center gap-4 p-5 text-left transition hover:-translate-y-[1px]"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff4dd] text-[#c57e11]">
            <AlertTriangle size={22} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-[var(--ink)]">签到提醒</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              今天还有 {pendingRecords.length} 位工人已报名但未完成签到，建议尽快扫码核验。
            </p>
          </div>
          <ArrowRight size={18} className="text-[#c57e11]" />
        </button>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.4fr_0.95fr]">
        <div className="soft-card chart-card p-6">
          <p className="section-label">Trend</p>
          <h3 className="mt-3 text-xl font-bold text-[var(--ink)]">近一周签到走势</h3>

          <div className="mt-6 h-[320px]">
            {trend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="fieldTrendChecked" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f4b233" stopOpacity={0.34} />
                      <stop offset="95%" stopColor="#f4b233" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="fieldTrendSigned" x1="0" y1="0" x2="0" y2="1">
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
                    fill="url(#fieldTrendSigned)"
                  />
                  <Area
                    type="monotone"
                    dataKey="checkedIn"
                    stroke="#f4b233"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#fieldTrendChecked)"
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

        <div className="app-grid">
          <div className="soft-card p-6">
            <p className="section-label">Base Profile</p>
            <h3 className="mt-3 text-xl font-bold text-[var(--ink)]">基地信息</h3>
            <div className="list-rows mt-6">
              <div className="list-row">
                <div className="flex items-center gap-3">
                  <Building2 size={18} className="text-[#c57e11]" />
                  <span className="text-sm font-semibold text-[var(--ink)]">基地名称</span>
                </div>
                <span className="text-sm text-[var(--muted)]">{baseInfo.baseName}</span>
              </div>
              <div className="list-row">
                <div className="flex items-center gap-3">
                  <MapPin size={18} className="text-[#c57e11]" />
                  <span className="text-sm font-semibold text-[var(--ink)]">基地地址</span>
                </div>
                <span className="max-w-[12rem] truncate text-sm text-[var(--muted)]">
                  {baseInfo.address || '暂无'}
                </span>
              </div>
              <div className="list-row">
                <div className="flex items-center gap-3">
                  <Phone size={18} className="text-[#c57e11]" />
                  <span className="text-sm font-semibold text-[var(--ink)]">联系电话</span>
                </div>
                <span className="text-sm text-[var(--muted)]">
                  {baseInfo.contactPhone || '暂无'}
                </span>
              </div>
              <div className="list-row">
                <div className="flex items-center gap-3">
                  <Wallet size={18} className="text-[#c57e11]" />
                  <span className="text-sm font-semibold text-[var(--ink)]">招聘进度</span>
                </div>
                <span className="text-sm text-[var(--muted)]">
                  {baseStats?.statistics.recruitment.completionRate ?? '0%'}
                </span>
              </div>
            </div>
          </div>

          <div className="soft-card p-6">
            <p className="section-label">Quick Actions</p>
            <h3 className="mt-3 text-xl font-bold text-[var(--ink)]">快捷操作</h3>
            <div className="list-rows mt-6">
              <button
                type="button"
                onClick={() => navigate('/dashboard/attendance')}
                className="list-row text-left transition hover:-translate-y-[1px]"
              >
                <div className="flex items-center gap-3">
                  <Camera size={18} className="text-[#c57e11]" />
                  <span className="text-sm font-semibold text-[var(--ink)]">扫码签到</span>
                </div>
                <ArrowRight size={16} className="text-[#c57e11]" />
              </button>

              <button
                type="button"
                onClick={() => navigate('/dashboard/field-workers')}
                className="list-row text-left transition hover:-translate-y-[1px]"
              >
                <div className="flex items-center gap-3">
                  <Users size={18} className="text-[#c57e11]" />
                  <span className="text-sm font-semibold text-[var(--ink)]">查看基地人员</span>
                </div>
                <ArrowRight size={16} className="text-[#c57e11]" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="soft-card p-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="section-label">Today Records</p>
            <h3 className="mt-3 text-xl font-bold text-[var(--ink)]">今日签到记录</h3>
          </div>
          <button
            type="button"
            onClick={() => navigate('/dashboard/attendance')}
            className="mini-badge"
          >
            查看全部
            <ArrowRight size={14} />
          </button>
        </div>

        <div className="list-rows">
          {records.length > 0 ? (
            records.slice(0, 10).map((record) => (
              <div key={record.id} className="list-row">
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#2b221b] text-sm font-bold text-[#ffd16d]">
                    {record.workerName?.slice(0, 1) ?? '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[var(--ink)]">{record.workerName}</p>
                    <p className="truncate text-sm text-[var(--muted)]">{record.jobTitle}</p>
                  </div>
                </div>

                <div className="hidden rounded-full bg-[#fff8ea] px-3 py-2 text-sm text-[#8b6d3f] md:block">
                  {record.workerUid}
                </div>

                <div className={`rounded-full px-3 py-2 text-sm font-semibold ${getStatusStyle(record.status)}`}>
                  {getStatusLabel(record.status)}
                </div>

                <div className="hidden text-sm text-[var(--muted)] md:block">
                  {formatTime(record.checkinTime)}
                </div>
              </div>
            ))
          ) : (
            <div className="list-row">
              <span className="text-sm text-[var(--muted)]">今日暂无签到记录</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
