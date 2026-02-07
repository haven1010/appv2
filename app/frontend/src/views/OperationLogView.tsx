import React, { useState, useEffect, useCallback } from 'react';
import {
  ScrollText,
  Search,
  Filter,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Trash2,
  UserPlus,
  ScanLine,
  Wallet,
  RefreshCw,
  Clock,
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
  createdAt: string;
}

interface LogStats {
  total: number;
  todayCount: number;
  byType: { type: string; count: string }[];
}

const OP_TYPE_MAP: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  create: { label: '创建', color: 'emerald', icon: UserPlus },
  update: { label: '更新', color: 'blue', icon: RefreshCw },
  delete: { label: '删除', color: 'rose', icon: Trash2 },
  audit: { label: '审核', color: 'amber', icon: ShieldCheck },
  login: { label: '登录', color: 'purple', icon: Clock },
  checkin: { label: '签到', color: 'cyan', icon: ScanLine },
  payment: { label: '支付', color: 'orange', icon: Wallet },
};

const RESOURCE_TYPE_MAP: Record<string, string> = {
  user: '用户',
  base: '基地',
  job: '岗位',
  signup: '报名/签到',
  salary: '薪资',
};

export default function OperationLogView() {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<LogStats | null>(null);

  // Filters
  const [opFilter, setOpFilter] = useState('');
  const [resFilter, setResFilter] = useState('');
  const [keyword, setKeyword] = useState('');

  const pageSize = 15;

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, pageSize };
      if (opFilter) params.operationType = opFilter;
      if (resFilter) params.resourceType = resFilter;
      if (keyword) params.keyword = keyword;

      const res = await AXIOS_INSTANCE.get('/api/operation-log/list', { params });
      setLogs(res.data.list || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, opFilter, resFilter, keyword]);

  const loadStats = useCallback(async () => {
    try {
      const res = await AXIOS_INSTANCE.get('/api/operation-log/stats');
      setStats(res.data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const totalPages = Math.ceil(total / pageSize);

  function formatDateTime(dateStr: string) {
    if (!dateStr) return '-';
    return dateStr.slice(0, 19).replace('T', ' ');
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">操作日志</h2>
        <p className="text-slate-400">查看系统所有关键操作的审计记录</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-card p-5 rounded-2xl">
            <p className="text-slate-400 text-sm mb-1">总记录数</p>
            <p className="text-2xl font-bold text-white">{stats.total.toLocaleString()}</p>
          </div>
          <div className="glass-card p-5 rounded-2xl">
            <p className="text-slate-400 text-sm mb-1">今日操作</p>
            <p className="text-2xl font-bold text-emerald-400">{stats.todayCount.toLocaleString()}</p>
          </div>
          {stats.byType.slice(0, 2).map((t) => {
            const info = OP_TYPE_MAP[t.type] || { label: t.type, color: 'slate', icon: Clock };
            return (
              <div key={t.type} className="glass-card p-5 rounded-2xl">
                <p className="text-slate-400 text-sm mb-1">{info.label}操作</p>
                <p className={`text-2xl font-bold text-${info.color}-400`}>{Number(t.count).toLocaleString()}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input
            type="text"
            placeholder="搜索描述..."
            value={keyword}
            onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
            className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-2.5 pl-9 pr-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
        <select
          value={opFilter}
          onChange={(e) => { setOpFilter(e.target.value); setPage(1); }}
          className="bg-slate-900/50 border border-slate-700 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-emerald-500"
        >
          <option value="">全部操作类型</option>
          {Object.entries(OP_TYPE_MAP).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>
        <select
          value={resFilter}
          onChange={(e) => { setResFilter(e.target.value); setPage(1); }}
          className="bg-slate-900/50 border border-slate-700 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-emerald-500"
        >
          <option value="">全部资源类型</option>
          {Object.entries(RESOURCE_TYPE_MAP).map(([key, val]) => (
            <option key={key} value={key}>{val}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="glass-card rounded-3xl border border-slate-800/60 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-emerald-400" size={28} />
            <span className="ml-3 text-slate-400">加载中...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-20 text-center">
            <ScrollText className="mx-auto text-slate-600 mb-3" size={40} />
            <p className="text-slate-400">暂无操作日志</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-800/60 text-slate-500 text-xs uppercase tracking-wider">
                    <th className="px-6 py-4 font-semibold">时间</th>
                    <th className="px-6 py-4 font-semibold">操作类型</th>
                    <th className="px-6 py-4 font-semibold">资源</th>
                    <th className="px-6 py-4 font-semibold">操作描述</th>
                    <th className="px-6 py-4 font-semibold">操作人ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {logs.map((log) => {
                    const opInfo = OP_TYPE_MAP[log.operationType] || { label: log.operationType, color: 'slate', icon: Clock };
                    const OpIcon = opInfo.icon;
                    return (
                      <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4 text-slate-400 text-sm whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-${opInfo.color}-500/10 text-${opInfo.color}-400 text-xs font-medium`}>
                            <OpIcon size={12} />
                            {opInfo.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-slate-300 text-sm">{RESOURCE_TYPE_MAP[log.resourceType] || log.resourceType}</span>
                          <span className="text-slate-500 text-xs ml-1">#{log.resourceId}</span>
                        </td>
                        <td className="px-6 py-4 text-slate-300 text-sm max-w-[300px] truncate">{log.description || '-'}</td>
                        <td className="px-6 py-4 text-slate-500 text-sm font-mono">{log.userId || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800/60">
                <span className="text-sm text-slate-500">共 {total} 条</span>
                <div className="flex items-center gap-2">
                  <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30">
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-sm text-slate-300">{page} / {totalPages}</span>
                  <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30">
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
