import React, { useEffect, useState } from 'react';
import {
  CircleDollarSign,
  Download,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  CreditCard,
  Banknote,
  FileText,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/App';
import { UserRole } from '@/types';
import { AXIOS_INSTANCE } from '@/lib/http';
import { useBaseControllerFindAll } from '@/api/generated/基地管理/基地管理';

const SALARY_STATUS_LABEL: Record<number, string> = {
  0: '待审核',
  1: '已确认',
  2: '已发放',
};

const PAY_TYPE_LABEL: Record<number, string> = {
  1: '固定',
  2: '时薪',
  3: '计件',
};

interface SalaryRecord {
  id: number;
  signupId: number;
  workerName: string;
  workerUid: string;
  baseId: number;
  baseName: string;
  jobTitle: string;
  payType: number;
  workDate: string;
  workDuration: number;
  pieceCount: number;
  unitPriceSnapshot: number;
  totalAmount: number;
  status: number;
  payoutType: number | null;
  createdAt: string;
}

interface SalaryStats {
  totalPaid: number;
  totalPending: number;
  paidCount: number;
  pendingCount: number;
}

function formatVolume(record: SalaryRecord): string {
  if (record.payType === 2) return `${record.workDuration} 小时`;
  if (record.payType === 3) return `${record.pieceCount} 件`;
  return '1 天';
}

/** CSV 字段转义（含逗号、换行、双引号时用双引号包裹） */
function escapeCsvField(value: string | number): string {
  const s = String(value ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** 将工资记录列表导出为 CSV 并触发下载 */
function exportSalaryToCsv(records: SalaryRecord[], filename?: string) {
  const headers = [
    '单号',
    '日期',
    '采摘工',
    '工号',
    '基地',
    '岗位',
    '工作量/时长',
    '单价',
    '结算金额',
    '支付状态',
    '创建时间',
  ];
  const rows = records.map((r) => [
    r.id,
    r.workDate,
    r.workerName,
    r.workerUid,
    r.baseName,
    r.jobTitle,
    formatVolume(r),
    r.unitPriceSnapshot,
    r.totalAmount,
    SALARY_STATUS_LABEL[r.status] ?? '未知',
    r.createdAt,
  ]);
  const csvLines = [
    headers.map(escapeCsvField).join(','),
    ...rows.map((row) => row.map(escapeCsvField).join(',')),
  ];
  const BOM = '\uFEFF';
  const csv = BOM + csvLines.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `工资结算报表_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PayrollView() {
  const { user } = useAuth();
  const [list, setList] = useState<SalaryRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<SalaryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterBaseId, setFilterBaseId] = useState<number | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterStatus, setFilterStatus] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  const { data: rawBases = [] } = useBaseControllerFindAll({
    request:
      user?.role === UserRole.BASE_MANAGER
        ? { params: { ownerId: user.id } }
        : user?.role === UserRole.SUPER_ADMIN
          ? { params: { showAll: true } }
          : undefined,
  });
  const bases = Array.isArray(rawBases) ? rawBases : [];

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {};
      if (filterBaseId) params.baseId = filterBaseId;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (filterStatus !== null) params.status = filterStatus;

      const [listRes, statsRes] = await Promise.all([
        AXIOS_INSTANCE.get<{ list: SalaryRecord[]; total: number }>('/api/salary/list', { params }),
        AXIOS_INSTANCE.get<SalaryStats>('/api/salary/stats', { params }),
      ]);

      setList(listRes.data.list || []);
      setTotal(listRes.data.total ?? 0);
      setStats(statsRes.data || null);
    } catch (e: any) {
      console.error('获取薪资数据失败:', e);
      setError(e?.response?.data?.message || '获取数据失败，请检查后端是否启动');
      setList([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterBaseId, dateFrom, dateTo, filterStatus]);

  const filteredList = searchKeyword.trim()
    ? list.filter(
        (r) =>
          r.workerName.includes(searchKeyword.trim()) ||
          r.workerUid.toLowerCase().includes(searchKeyword.trim().toLowerCase()) ||
          String(r.id).includes(searchKeyword.trim()),
      )
    : list;

  const handleExportReport = () => {
    if (filteredList.length === 0) {
      alert('当前无数据可导出，请先筛选或刷新后再试。');
      return;
    }
    setExporting(true);
    try {
      const dateRange =
        dateFrom && dateTo ? `${dateFrom}_${dateTo}` : new Date().toISOString().slice(0, 10);
      exportSalaryToCsv(filteredList, `工资结算报表_${dateRange}.csv`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">工资结算</h2>
          <p className="text-slate-400 text-sm">核算并审放采摘工劳动报酬。</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl transition-all border border-slate-700/50 disabled:opacity-50"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            刷新
          </button>
          <button
            onClick={handleExportReport}
            disabled={loading || exporting || filteredList.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl transition-all border border-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
            title={filteredList.length === 0 ? '当前无数据可导出' : '导出当前筛选结果为 CSV'}
          >
            <Download size={18} className={exporting ? 'animate-pulse' : ''} />
            <span>{exporting ? '导出中...' : '导出报表'}</span>
          </button>
          <button className="flex items-center gap-2 px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95">
            <CircleDollarSign size={18} />
            <span>发起新结算</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="glass-card rounded-3xl p-4 border border-rose-500/50 bg-rose-500/10">
          <div className="flex items-center gap-2 text-rose-400">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 rounded-3xl border border-slate-800/60 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <TrendingUp size={28} />
          </div>
          <div>
            <p className="text-slate-500 text-xs uppercase tracking-widest font-bold">已发放总额</p>
            <h3 className="text-2xl font-bold text-white">
              ¥{stats ? stats.totalPaid.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : '0.00'}
            </h3>
          </div>
        </div>
        <div className="glass-card p-6 rounded-3xl border border-slate-800/60 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <Clock size={28} />
          </div>
          <div>
            <p className="text-slate-500 text-xs uppercase tracking-widest font-bold">待发放金额</p>
            <h3 className="text-2xl font-bold text-white">
              ¥{stats ? stats.totalPending.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : '0.00'}
            </h3>
          </div>
        </div>
        <div className="glass-card p-6 rounded-3xl border border-slate-800/60 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
            <CheckCircle2 size={28} />
          </div>
          <div>
            <p className="text-slate-500 text-xs uppercase tracking-widest font-bold">已发放笔数</p>
            <h3 className="text-2xl font-bold text-white">{stats ? stats.paidCount : 0}</h3>
          </div>
        </div>
      </div>

      <div className="glass-card rounded-3xl p-6 border border-slate-800/60">
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              type="text"
              placeholder="搜索工人姓名、UID或单号..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl py-2 pl-10 pr-4 text-sm text-slate-100"
            />
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <select
              value={filterBaseId ?? ''}
              onChange={(e) => setFilterBaseId(e.target.value ? Number(e.target.value) : null)}
              className="bg-slate-800 border border-slate-700/50 rounded-xl px-4 py-2 text-sm text-slate-300"
            >
              <option value="">全部基地</option>
              {bases.map((b: any) => (
                <option key={b.id} value={b.id}>
                  {b.baseName ?? b.name ?? b.id}
                </option>
              ))}
            </select>
            <input
              type="date"
              placeholder="开始日期"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-slate-800 border border-slate-700/50 rounded-xl px-4 py-2 text-sm text-slate-300"
            />
            <input
              type="date"
              placeholder="结束日期"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-slate-800 border border-slate-700/50 rounded-xl px-4 py-2 text-sm text-slate-300"
            />
            <select
              value={filterStatus ?? ''}
              onChange={(e) => setFilterStatus(e.target.value === '' ? null : Number(e.target.value))}
              className="bg-slate-800 border border-slate-700/50 rounded-xl px-4 py-2 text-sm text-slate-300"
            >
              <option value="">全部状态</option>
              <option value={0}>待审核</option>
              <option value={1}>已确认</option>
              <option value={2}>已发放</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="animate-spin text-emerald-500" size={32} />
              <span className="ml-3 text-slate-400">加载中...</span>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="text-center py-16 text-slate-500">暂无工资记录</div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-800/60 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="pb-4 font-semibold px-4">单号 / 日期</th>
                  <th className="pb-4 font-semibold">采摘工</th>
                  <th className="pb-4 font-semibold">工作内容</th>
                  <th className="pb-4 font-semibold">工作量 / 时长</th>
                  <th className="pb-4 font-semibold">结算金额</th>
                  <th className="pb-4 font-semibold">支付状态</th>
                  <th className="pb-4 font-semibold text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {filteredList.map((row) => (
                  <tr key={row.id} className="group hover:bg-slate-800/20 transition-colors">
                    <td className="py-5 px-4">
                      <div className="flex flex-col">
                        <span className="text-slate-100 font-mono text-xs">#{row.id}</span>
                        <span className="text-slate-500 text-xs mt-1">{row.workDate}</span>
                      </div>
                    </td>
                    <td className="py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-emerald-400">
                          {row.workerName[0] || '-'}
                        </div>
                        <div>
                          <span className="text-slate-100 font-medium">{row.workerName}</span>
                          <span className="text-slate-500 text-xs block font-mono">{row.workerUid}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-5 text-slate-400 text-sm">
                      {row.jobTitle} · {row.baseName}
                    </td>
                    <td className="py-5 text-slate-400 text-sm">{formatVolume(row)}</td>
                    <td className="py-5">
                      <span className="text-emerald-400 font-bold">
                        ¥{Number(row.totalAmount).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="py-5">
                      <span
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 w-fit ${
                          row.status === 2
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : row.status === 0
                              ? 'bg-amber-500/10 text-amber-400'
                              : 'bg-blue-500/10 text-blue-400'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            row.status === 2 ? 'bg-emerald-500' : row.status === 0 ? 'bg-amber-500' : 'bg-blue-500'
                          }`}
                        />
                        {SALARY_STATUS_LABEL[row.status] ?? '未知'}
                      </span>
                    </td>
                    <td className="py-5 text-right px-4">
                      <div className="flex justify-end gap-2">
                        <button
                          className="p-2 text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all"
                          title="查看明细"
                        >
                          <FileText size={18} />
                        </button>
                        {row.status === 0 && (
                          <button
                            className="p-2 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all"
                            title="确认发放"
                          >
                            <Banknote size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
