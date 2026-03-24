/**
 * Layer: Frontend View
 * Responsibility: Implements the Operation Log View screen and coordinates user interaction, page state, and API-driven data binding.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Clock3,
  DatabaseZap,
  Filter,
  Loader2,
  RefreshCw,
  ScanLine,
  ScrollText,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Wallet,
  X,
} from 'lucide-react';
import { AXIOS_INSTANCE } from '../lib/http';

interface LogItem {
  id: number;
  operationType: string;
  resourceType: string;
  resourceId: number;
  userId: number;
  description: string;
  beforeData: string | null;
  afterData: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

interface LogStats {
  total: number;
  todayCount: number;
  byType: { type: string; count: string }[];
}

type ParsedPayload = Record<string, unknown> | null;

const OP_TYPE_MAP: Record<
  string,
  {
    label: string;
    icon: React.ElementType;
    badgeClass: string;
    accentClass: string;
  }
> = {
  create: {
    label: '创建',
    icon: UserPlus,
    badgeClass: 'bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20',
    accentClass: 'text-emerald-300',
  },
  update: {
    label: '更新',
    icon: RefreshCw,
    badgeClass: 'bg-sky-500/10 text-sky-300 ring-1 ring-sky-500/20',
    accentClass: 'text-sky-300',
  },
  delete: {
    label: '删除',
    icon: Trash2,
    badgeClass: 'bg-rose-500/10 text-rose-300 ring-1 ring-rose-500/20',
    accentClass: 'text-rose-300',
  },
  audit: {
    label: '审核',
    icon: ShieldCheck,
    badgeClass: 'bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/20',
    accentClass: 'text-amber-300',
  },
  login: {
    label: '登录',
    icon: Clock3,
    badgeClass: 'bg-fuchsia-500/10 text-fuchsia-300 ring-1 ring-fuchsia-500/20',
    accentClass: 'text-fuchsia-300',
  },
  checkin: {
    label: '签到',
    icon: ScanLine,
    badgeClass: 'bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-500/20',
    accentClass: 'text-cyan-300',
  },
  payment: {
    label: '支付',
    icon: Wallet,
    badgeClass: 'bg-orange-500/10 text-orange-300 ring-1 ring-orange-500/20',
    accentClass: 'text-orange-300',
  },
};

const RESOURCE_TYPE_MAP: Record<string, string> = {
  user: '用户',
  base: '基地',
  job: '岗位',
  signup: '报名/签到',
  salary: '薪资',
  offline_event: '离线补签到事件',
};

function formatDateTime(dateStr: string) {
  if (!dateStr) return '-';
  return dateStr.slice(0, 19).replace('T', ' ');
}

function safeParse(raw: string | null | undefined): ParsedPayload {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function countFields(payload: ParsedPayload) {
  return payload ? Object.keys(payload).length : 0;
}

function PreviewJson({ title, payload }: { title: string; payload: ParsedPayload }) {
  return (
    <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-white">{title}</h4>
        <span className="text-xs text-slate-500">{countFields(payload)} 个字段</span>
      </div>
      {payload ? (
        <pre className="max-h-72 overflow-auto rounded-xl bg-slate-900/80 p-3 text-xs leading-6 text-slate-300">
          {JSON.stringify(payload, null, 2)}
        </pre>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-800 px-4 py-6 text-center text-sm text-slate-500">
          无结构化数据
        </div>
      )}
    </div>
  );
}

export default function OperationLogView() {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [selectedLog, setSelectedLog] = useState<LogItem | null>(null);

  const [opFilter, setOpFilter] = useState('');
  const [resFilter, setResFilter] = useState('');
  const [keyword, setKeyword] = useState('');

  const pageSize = 12;

  async function loadLogs() {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, pageSize };
      if (opFilter) params.operationType = opFilter;
      if (resFilter) params.resourceType = resFilter;
      if (keyword) params.keyword = keyword;

      const res = await AXIOS_INSTANCE.get('/api/operation-log/list', { params });
      const nextLogs = res.data.list || [];
      setLogs(nextLogs);
      setTotal(res.data.total || 0);
      setSelectedLog((current) => {
        if (!nextLogs.length) return null;
        if (current) {
          return nextLogs.find((item: LogItem) => item.id === current.id) || nextLogs[0];
        }
        return nextLogs[0];
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    try {
      const res = await AXIOS_INSTANCE.get('/api/operation-log/stats');
      setStats(res.data);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    loadLogs();
  }, [page, opFilter, resFilter, keyword]);

  useEffect(() => {
    loadStats();
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const byTypeMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of stats?.byType || []) {
      map.set(item.type, Number(item.count));
    }
    return map;
  }, [stats]);

  const selectedBefore = safeParse(selectedLog?.beforeData);
  const selectedAfter = safeParse(selectedLog?.afterData);

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[28px] border border-emerald-500/15 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.22),_transparent_34%),linear-gradient(180deg,rgba(15,23,42,0.94),rgba(2,6,23,0.98))] p-6 shadow-[0_24px_80px_rgba(3,7,18,0.45)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold tracking-[0.24em] text-emerald-200 uppercase">
              <DatabaseZap size={14} />
              Audit Console
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-white">操作日志与审计轨迹</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              这里汇总了登录、审核、支付、报名、签到等关键动作。新增的结构化日志会直接展示操作前后快照，
              便于追溯状态变化和定位问题。
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-white/6 bg-slate-950/40 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">总日志</p>
              <p className="mt-2 text-2xl font-bold text-white">{stats?.total?.toLocaleString() ?? '-'}</p>
            </div>
            <div className="rounded-2xl border border-white/6 bg-slate-950/40 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">今日新增</p>
              <p className="mt-2 text-2xl font-bold text-emerald-300">{stats?.todayCount?.toLocaleString() ?? '-'}</p>
            </div>
            <div className="rounded-2xl border border-white/6 bg-slate-950/40 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">签到事件</p>
              <p className="mt-2 text-2xl font-bold text-cyan-300">{byTypeMap.get('checkin')?.toLocaleString() ?? '0'}</p>
            </div>
            <div className="rounded-2xl border border-white/6 bg-slate-950/40 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">支付事件</p>
              <p className="mt-2 text-2xl font-bold text-orange-300">{byTypeMap.get('payment')?.toLocaleString() ?? '0'}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_420px]">
        <div className="space-y-5">
          <div className="rounded-[26px] border border-slate-800/70 bg-slate-950/65 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">筛选与检索</h3>
                <p className="mt-1 text-sm text-slate-400">按操作类型、资源类型和关键字快速定位关键链路。</p>
              </div>
              <button
                onClick={() => {
                  setKeyword('');
                  setOpFilter('');
                  setResFilter('');
                  setPage(1);
                  loadLogs();
                  loadStats();
                }}
                className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-700/70 bg-slate-900/70 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-emerald-500/40 hover:text-white"
              >
                <RefreshCw size={16} />
                刷新面板
              </button>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px]">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  type="text"
                  placeholder="搜索描述、资源 ID、操作人 ID"
                  value={keyword}
                  onChange={(e) => {
                    setKeyword(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900/80 py-3 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/40 focus:outline-none"
                />
              </label>

              <label className="relative block">
                <Filter className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <select
                  value={opFilter}
                  onChange={(e) => {
                    setOpFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full appearance-none rounded-2xl border border-slate-800 bg-slate-900/80 py-3 pl-10 pr-4 text-sm text-white focus:border-emerald-500/40 focus:outline-none"
                >
                  <option value="">全部操作</option>
                  {Object.entries(OP_TYPE_MAP).map(([key, item]) => (
                    <option key={key} value={key}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="relative block">
                <Activity className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <select
                  value={resFilter}
                  onChange={(e) => {
                    setResFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full appearance-none rounded-2xl border border-slate-800 bg-slate-900/80 py-3 pl-10 pr-4 text-sm text-white focus:border-emerald-500/40 focus:outline-none"
                >
                  <option value="">全部资源</option>
                  {Object.entries(RESOURCE_TYPE_MAP).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="overflow-hidden rounded-[26px] border border-slate-800/70 bg-slate-950/65">
            {loading ? (
              <div className="flex min-h-[420px] items-center justify-center">
                <Loader2 className="animate-spin text-emerald-300" size={28} />
                <span className="ml-3 text-slate-400">正在加载审计日志...</span>
              </div>
            ) : logs.length === 0 ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center px-6 text-center">
                <ScrollText className="mb-4 text-slate-700" size={42} />
                <p className="text-lg font-semibold text-slate-300">没有匹配的审计记录</p>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                  试试放宽筛选条件，或者先在系统里执行一次登录、审核、支付或签到操作后再回来查看。
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left">
                    <thead className="border-b border-slate-800/70 bg-slate-950/80 text-xs uppercase tracking-[0.22em] text-slate-500">
                      <tr>
                        <th className="px-5 py-4 font-semibold">时间</th>
                        <th className="px-5 py-4 font-semibold">动作</th>
                        <th className="px-5 py-4 font-semibold">资源</th>
                        <th className="px-5 py-4 font-semibold">描述</th>
                        <th className="px-5 py-4 font-semibold">变更</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {logs.map((log) => {
                        const opInfo = OP_TYPE_MAP[log.operationType] || {
                          label: log.operationType,
                          icon: Clock3,
                          badgeClass: 'bg-slate-500/10 text-slate-300 ring-1 ring-slate-500/20',
                          accentClass: 'text-slate-300',
                        };
                        const beforePayload = safeParse(log.beforeData);
                        const afterPayload = safeParse(log.afterData);
                        const OpIcon = opInfo.icon;
                        const isActive = selectedLog?.id === log.id;

                        return (
                          <tr
                            key={log.id}
                            className={`cursor-pointer transition ${isActive ? 'bg-emerald-500/6' : 'hover:bg-slate-900/70'}`}
                            onClick={() => setSelectedLog(log)}
                          >
                            <td className="px-5 py-4 align-top">
                              <div className="text-sm text-slate-300">{formatDateTime(log.createdAt)}</div>
                              <div className="mt-1 text-xs text-slate-500">操作人 #{log.userId || '-'}</div>
                            </td>
                            <td className="px-5 py-4 align-top">
                              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${opInfo.badgeClass}`}>
                                <OpIcon size={13} />
                                {opInfo.label}
                              </span>
                            </td>
                            <td className="px-5 py-4 align-top">
                              <div className="text-sm text-slate-200">
                                {RESOURCE_TYPE_MAP[log.resourceType] || log.resourceType}
                              </div>
                              <div className="mt-1 font-mono text-xs text-slate-500">#{log.resourceId}</div>
                            </td>
                            <td className="px-5 py-4 align-top">
                              <div className="max-w-[360px] text-sm leading-6 text-slate-300">{log.description || '-'}</div>
                            </td>
                            <td className="px-5 py-4 align-top">
                              <div className="flex flex-wrap gap-2">
                                <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs text-slate-400">
                                  前镜像 {countFields(beforePayload)}
                                </span>
                                <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs text-slate-400">
                                  后镜像 {countFields(afterPayload)}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col gap-3 border-t border-slate-800/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-500">
                    共 {total} 条，当前第 {page} / {totalPages} 页
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage((current) => current - 1)}
                      className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm text-slate-300 transition hover:border-slate-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      上一页
                    </button>
                    <button
                      disabled={page >= totalPages}
                      onClick={() => setPage((current) => current + 1)}
                      className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm text-slate-300 transition hover:border-slate-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      下一页
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <aside className="overflow-hidden rounded-[26px] border border-slate-800/70 bg-slate-950/65">
          {selectedLog ? (
            <div className="flex h-full flex-col">
              <div className="border-b border-slate-800/70 px-5 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">审计详情</p>
                    <h3 className="mt-2 text-xl font-semibold text-white">
                      {RESOURCE_TYPE_MAP[selectedLog.resourceType] || selectedLog.resourceType}
                      <span className="ml-2 font-mono text-base text-slate-500">#{selectedLog.resourceId}</span>
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedLog(null)}
                    className="rounded-xl border border-slate-800 bg-slate-900/80 p-2 text-slate-400 transition hover:border-slate-700 hover:text-white"
                    title="关闭详情"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(() => {
                    const opInfo = OP_TYPE_MAP[selectedLog.operationType] || {
                      label: selectedLog.operationType,
                      icon: Clock3,
                      badgeClass: 'bg-slate-500/10 text-slate-300 ring-1 ring-slate-500/20',
                      accentClass: 'text-slate-300',
                    };
                    const OpIcon = opInfo.icon;
                    return (
                      <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${opInfo.badgeClass}`}>
                        <OpIcon size={13} />
                        {opInfo.label}
                      </span>
                    );
                  })()}
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-xs text-slate-400">
                    {formatDateTime(selectedLog.createdAt)}
                  </span>
                </div>
              </div>

              <div className="space-y-5 overflow-auto px-5 py-5">
                <div className="rounded-2xl border border-slate-800/70 bg-slate-950/55 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">操作摘要</p>
                  <p className="mt-3 text-sm leading-7 text-slate-300">{selectedLog.description || '-'}</p>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-slate-900/80 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">操作人</p>
                      <p className="mt-2 font-mono text-slate-200">#{selectedLog.userId || '-'}</p>
                    </div>
                    <div className="rounded-xl bg-slate-900/80 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">资源类型</p>
                      <p className="mt-2 text-slate-200">
                        {RESOURCE_TYPE_MAP[selectedLog.resourceType] || selectedLog.resourceType}
                      </p>
                    </div>
                  </div>
                </div>

                <PreviewJson title="操作前快照" payload={selectedBefore} />
                <PreviewJson title="操作后快照" payload={selectedAfter} />

                <div className="rounded-2xl border border-slate-800/70 bg-slate-950/55 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">请求线索</p>
                  <div className="mt-4 space-y-3 text-sm text-slate-300">
                    <div>
                      <p className="text-xs text-slate-500">IP 地址</p>
                      <p className="mt-1 font-mono text-slate-200">{selectedLog.ipAddress || '未记录'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">User-Agent</p>
                      <p className="mt-1 break-all text-xs leading-6 text-slate-400">
                        {selectedLog.userAgent || '未记录'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[720px] flex-col items-center justify-center px-6 text-center">
              <ScrollText className="mb-4 text-slate-700" size={42} />
              <p className="text-lg font-semibold text-slate-300">选择一条日志查看详情</p>
              <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                右侧会展示操作前后数据、操作者和请求线索，适合排查审核覆盖、支付流转和签到异常。
              </p>
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}
