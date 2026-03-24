/**
 * Layer: Frontend View
 * Responsibility: Implements the Payroll View screen and coordinates user interaction, page state, and API-driven data binding.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Download,
  FileText,
  Filter,
  Loader2,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldCheck,
  Wallet,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/App';
import { UserRole } from '@/types';
import { AXIOS_INSTANCE } from '@/lib/http';
import { useBaseControllerFindAll } from '@/api/generated/基地管理/基地管理';

const SALARY_STATUS_META: Record<
  number,
  {
    label: string;
    badgeClass: string;
    icon: React.ElementType;
    helper: string;
  }
> = {
  0: {
    label: '待确认',
    badgeClass: 'bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/20',
    icon: Clock3,
    helper: '等待工人确认，允许重新计薪。',
  },
  1: {
    label: '已确认',
    badgeClass: 'bg-sky-500/10 text-sky-300 ring-1 ring-sky-500/20',
    icon: ShieldCheck,
    helper: '已锁定重算，可以创建支付单并推进支付流程。',
  },
  2: {
    label: '已发放',
    badgeClass: 'bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20',
    icon: Banknote,
    helper: '支付单和工资状态都已闭环。',
  },
};

const PAY_TYPE_LABEL: Record<number, string> = {
  1: '固定',
  2: '时薪',
  3: '计件',
};

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: '现金',
  transfer: '转账',
};

const PAYMENT_STATUS_LABEL: Record<number, string> = {
  0: '待确认',
  1: '已确认',
  2: '已发放',
  3: '已取消',
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

interface PaymentRecord {
  id: number;
  salaryId: number;
  paymentMethod: 'cash' | 'transfer';
  status: number;
  confirmSignatureUrl?: string | null;
  paymentVoucherUrl?: string | null;
  paidAt?: string | null;
  createdAt: string;
}

type PaymentModalState =
  | { type: 'create'; salaryId: number }
  | { type: 'confirm'; paymentId: number }
  | { type: 'complete'; paymentId: number }
  | null;

function formatVolume(record: SalaryRecord): string {
  if (record.payType === 2) return `${record.workDuration} 小时`;
  if (record.payType === 3) return `${record.pieceCount} 件`;
  return '1 天';
}

function escapeCsvField(value: string | number): string {
  const s = String(value ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

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
    '状态',
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
    SALARY_STATUS_META[r.status]?.label ?? '未知',
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
  const navigate = useNavigate();
  const { user } = useAuth();
  const [list, setList] = useState<SalaryRecord[]>([]);
  const [stats, setStats] = useState<SalaryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterBaseId, setFilterBaseId] = useState<number | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterStatus, setFilterStatus] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [paymentModal, setPaymentModal] = useState<PaymentModalState>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('transfer');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  const { data: rawBases = [] } = useBaseControllerFindAll({
    request:
      user?.role === UserRole.BASE_MANAGER
        ? { params: { ownerId: user.id } }
        : user?.role === UserRole.SUPER_ADMIN
          ? { params: { showAll: true } }
          : undefined,
  });
  const bases = useMemo(() => {
    const list = Array.isArray(rawBases) ? rawBases : [];
    if (user?.role === UserRole.FIELD_MANAGER) {
      return list.filter((base: any) => Number(base.id) === Number(user?.assignedBaseId));
    }
    return list;
  }, [rawBases, user?.assignedBaseId, user?.role]);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, string | number> = {};
      if (filterBaseId) params.baseId = filterBaseId;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (filterStatus !== null) params.status = filterStatus;

      const [listRes, statsRes] = await Promise.all([
        AXIOS_INSTANCE.get<{ list: SalaryRecord[]; total: number }>('/api/salary/list', { params }),
        AXIOS_INSTANCE.get<SalaryStats>('/api/salary/stats', { params }),
      ]);

      const nextList = listRes.data.list || [];
      setList(nextList);
      setStats(statsRes.data || null);
      setSelectedId((current) => {
        if (!nextList.length) return null;
        return nextList.find((item) => item.id === current)?.id ?? nextList[0].id;
      });
    } catch (e: any) {
      console.error('获取薪资数据失败:', e);
      setError(e?.response?.data?.message || '获取数据失败，请检查后端是否启动');
      setList([]);
      setStats(null);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [filterBaseId, dateFrom, dateTo, filterStatus]);

  const filteredList = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    if (!keyword) return list;
    return list.filter(
      (item) =>
        item.workerName.toLowerCase().includes(keyword) ||
        item.workerUid.toLowerCase().includes(keyword) ||
        String(item.id).includes(keyword) ||
        item.baseName.toLowerCase().includes(keyword),
    );
  }, [list, searchKeyword]);

  const selectedRecord = useMemo(() => {
    return filteredList.find((item) => item.id === selectedId) || filteredList[0] || null;
  }, [filteredList, selectedId]);

  const {
    data: payments = [],
    isLoading: paymentsLoading,
    refetch: refetchPayments,
  } = useQuery({
    queryKey: ['salaryPayments', selectedRecord?.id],
    enabled: !!selectedRecord?.id,
    queryFn: async () => {
      const res = await AXIOS_INSTANCE.get<PaymentRecord[]>(`/api/salary/${selectedRecord?.id}/payments`);
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  const latestPayment = payments[0] || null;

  const statusCards = useMemo(() => {
    const base = [
      { status: 0, count: 0, amount: 0 },
      { status: 1, count: 0, amount: 0 },
      { status: 2, count: 0, amount: 0 },
    ];
    for (const item of filteredList) {
      const target = base.find((entry) => entry.status === item.status);
      if (target) {
        target.count += 1;
        target.amount += Number(item.totalAmount);
      }
    }
    return base;
  }, [filteredList]);

  function handleExportReport() {
    if (filteredList.length === 0) {
      window.alert('当前无数据可导出，请先筛选后再试。');
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
  }

  const closePaymentModal = () => {
    setPaymentModal(null);
    setPaymentMethod('transfer');
    setAttachmentUrl('');
    setPaymentSubmitting(false);
  };

  const handleSubmitPaymentAction = async () => {
    if (!paymentModal) return;
    if (paymentModal.type !== 'create' && !attachmentUrl.trim()) {
      alert('请填写附件 URL');
      return;
    }

    setPaymentSubmitting(true);
    try {
      if (paymentModal.type === 'create') {
        await AXIOS_INSTANCE.post(`/api/salary/${paymentModal.salaryId}/payment`, {
          paymentMethod,
        });
      } else if (paymentModal.type === 'confirm') {
        await AXIOS_INSTANCE.patch(`/api/salary/payment/${paymentModal.paymentId}/confirm`, {
          confirmSignatureUrl: attachmentUrl.trim(),
        });
      } else if (paymentModal.type === 'complete') {
        await AXIOS_INSTANCE.patch(`/api/salary/payment/${paymentModal.paymentId}/complete`, {
          paymentVoucherUrl: attachmentUrl.trim(),
        });
      }

      await Promise.all([fetchData(), refetchPayments()]);
      closePaymentModal();
    } catch (e: any) {
      const msg = e?.response?.data?.message || '支付操作失败';
      alert(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const actionButton = (() => {
    if (!selectedRecord) return null;
    if (selectedRecord.status === 0) {
      return (
        <button
          onClick={() => navigate('/dashboard/attendance')}
          className="w-full rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-200 transition hover:bg-amber-500/20"
        >
          等待工人确认，去考勤页调整草稿
        </button>
      );
    }
    if (selectedRecord.status === 1 && !latestPayment) {
      return (
        <button
          onClick={() => setPaymentModal({ type: 'create', salaryId: selectedRecord.id })}
          className="w-full rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400"
        >
          创建支付单
        </button>
      );
    }
    if (latestPayment?.status === 0) {
      return (
        <button
          onClick={() => setPaymentModal({ type: 'confirm', paymentId: latestPayment.id })}
          className="w-full rounded-2xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-400"
        >
          确认支付
        </button>
      );
    }
    if (latestPayment?.status === 1) {
      return (
        <button
          onClick={() => setPaymentModal({ type: 'complete', paymentId: latestPayment.id })}
          className="w-full rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400"
        >
          完成发放
        </button>
      );
    }
    return null;
  })();

  return (
    <div className="space-y-7 pb-8">
      <section className="overflow-hidden rounded-[30px] border border-emerald-500/15 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_30%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] p-6 shadow-[0_24px_80px_rgba(2,6,23,0.52)]">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-100">
              <ReceiptText size={14} />
              Payroll Workflow
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-white">工资结算与支付闭环</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              这页直接接入支付单创建、确认、完成发放。发起新结算会跳转到考勤页，从签到记录生成工资草稿。
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={fetchData}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-700/70 bg-slate-950/55 px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-emerald-500/30 hover:text-white disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              刷新
            </button>
            <button
              onClick={handleExportReport}
              disabled={loading || exporting || filteredList.length === 0}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-700/70 bg-slate-950/55 px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-cyan-500/30 hover:text-white disabled:opacity-50"
            >
              <Download size={16} />
              {exporting ? '导出中...' : '导出报表'}
            </button>
            <button
              onClick={() => navigate('/dashboard/attendance')}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/20 transition hover:bg-emerald-400"
            >
              <CircleDollarSign size={16} />
              发起新结算
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-[24px] border border-rose-500/40 bg-rose-500/10 px-5 py-4 text-sm text-rose-200">
          {error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[26px] border border-slate-800/70 bg-slate-950/65 p-5">
          <div className="flex items-center gap-3 text-emerald-300">
            <Wallet size={20} />
            <span className="text-sm font-medium">已发放总额</span>
          </div>
          <p className="mt-4 text-3xl font-bold text-white">
            ¥{stats ? stats.totalPaid.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : '0.00'}
          </p>
        </article>

        <article className="rounded-[26px] border border-slate-800/70 bg-slate-950/65 p-5">
          <div className="flex items-center gap-3 text-amber-300">
            <Clock3 size={20} />
            <span className="text-sm font-medium">待流转金额</span>
          </div>
          <p className="mt-4 text-3xl font-bold text-white">
            ¥{stats ? stats.totalPending.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : '0.00'}
          </p>
        </article>

        <article className="rounded-[26px] border border-slate-800/70 bg-slate-950/65 p-5">
          <div className="flex items-center gap-3 text-sky-300">
            <ShieldCheck size={20} />
            <span className="text-sm font-medium">已确认笔数</span>
          </div>
          <p className="mt-4 text-3xl font-bold text-white">{statusCards.find((item) => item.status === 1)?.count ?? 0}</p>
        </article>

        <article className="rounded-[26px] border border-slate-800/70 bg-slate-950/65 p-5">
          <div className="flex items-center gap-3 text-emerald-300">
            <CheckCircle2 size={20} />
            <span className="text-sm font-medium">已发放笔数</span>
          </div>
          <p className="mt-4 text-3xl font-bold text-white">{stats?.paidCount ?? 0}</p>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        {statusCards.map(({ status, count, amount }) => {
          const meta = SALARY_STATUS_META[status];
          const StatusIcon = meta.icon;
          return (
            <article key={status} className="rounded-[26px] border border-slate-800/70 bg-slate-950/65 p-5">
              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${meta.badgeClass}`}>
                  <StatusIcon size={14} />
                  {meta.label}
                </span>
                <span className="text-xs uppercase tracking-[0.2em] text-slate-500">{count} 笔</span>
              </div>
              <p className="mt-5 text-3xl font-bold text-white">
                ¥{amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-400">{meta.helper}</p>
            </article>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_420px]">
        <div className="space-y-5 rounded-[28px] border border-slate-800/70 bg-slate-950/65 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">结算记录</h3>
              <p className="mt-1 text-sm text-slate-400">按基地、时间和状态筛选，查看当前结算队列。</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-100">
              <FileText size={13} />
              已确认后禁止重算
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_160px_160px_160px]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input
                type="text"
                placeholder="搜索工人姓名、UID、基地或单号"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="w-full rounded-2xl border border-slate-800 bg-slate-900/80 py-3 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/40 focus:outline-none"
              />
            </label>

            <select
              value={filterBaseId ?? ''}
              onChange={(e) => setFilterBaseId(e.target.value ? Number(e.target.value) : null)}
              className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-sm text-white focus:border-emerald-500/40 focus:outline-none"
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
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-sm text-white focus:border-emerald-500/40 focus:outline-none"
            />

            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-sm text-white focus:border-emerald-500/40 focus:outline-none"
            />

            <label className="relative block">
              <Filter className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <select
                value={filterStatus ?? ''}
                onChange={(e) => setFilterStatus(e.target.value === '' ? null : Number(e.target.value))}
                className="w-full appearance-none rounded-2xl border border-slate-800 bg-slate-900/80 py-3 pl-10 pr-4 text-sm text-white focus:border-emerald-500/40 focus:outline-none"
              >
                <option value="">全部状态</option>
                <option value={0}>待确认</option>
                <option value={1}>已确认</option>
                <option value={2}>已发放</option>
              </select>
            </label>
          </div>

          <div className="overflow-hidden rounded-[24px] border border-slate-800/70">
            {loading ? (
              <div className="flex min-h-[520px] items-center justify-center">
                <Loader2 className="animate-spin text-emerald-300" size={28} />
                <span className="ml-3 text-slate-400">加载工资记录...</span>
              </div>
            ) : filteredList.length === 0 ? (
              <div className="flex min-h-[520px] items-center justify-center text-slate-500">暂无工资记录</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left">
                  <thead className="border-b border-slate-800/70 bg-slate-950/90 text-xs uppercase tracking-[0.22em] text-slate-500">
                    <tr>
                      <th className="px-5 py-4 font-semibold">单号 / 日期</th>
                      <th className="px-5 py-4 font-semibold">采摘工</th>
                      <th className="px-5 py-4 font-semibold">岗位 / 基地</th>
                      <th className="px-5 py-4 font-semibold">工作量</th>
                      <th className="px-5 py-4 font-semibold">金额</th>
                      <th className="px-5 py-4 font-semibold">状态</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredList.map((row) => {
                      const meta = SALARY_STATUS_META[row.status];
                      const StatusIcon = meta.icon;
                      const active = selectedRecord?.id === row.id;
                      return (
                        <tr
                          key={row.id}
                          className={`cursor-pointer transition ${active ? 'bg-emerald-500/6' : 'hover:bg-slate-900/70'}`}
                          onClick={() => setSelectedId(row.id)}
                        >
                          <td className="px-5 py-4 align-top">
                            <div className="font-mono text-sm text-slate-200">#{row.id}</div>
                            <div className="mt-1 text-xs text-slate-500">{row.workDate}</div>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <div className="font-medium text-slate-100">{row.workerName}</div>
                            <div className="mt-1 text-xs font-mono text-slate-500">{row.workerUid}</div>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <div className="text-sm text-slate-200">{row.jobTitle}</div>
                            <div className="mt-1 text-xs text-slate-500">{row.baseName}</div>
                          </td>
                          <td className="px-5 py-4 align-top text-sm text-slate-300">{formatVolume(row)}</td>
                          <td className="px-5 py-4 align-top">
                            <span className="text-base font-bold text-emerald-300">
                              ¥{Number(row.totalAmount).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${meta.badgeClass}`}>
                              <StatusIcon size={13} />
                              {meta.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <aside className="overflow-hidden rounded-[28px] border border-slate-800/70 bg-slate-950/65">
          {selectedRecord ? (
            <div className="flex h-full flex-col">
              <div className="border-b border-slate-800/70 px-5 py-5">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">结算详情</p>
                <h3 className="mt-2 text-xl font-semibold text-white">
                  {selectedRecord.workerName}
                  <span className="ml-2 font-mono text-base text-slate-500">#{selectedRecord.id}</span>
                </h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(() => {
                    const meta = SALARY_STATUS_META[selectedRecord.status];
                    const StatusIcon = meta.icon;
                    return (
                      <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${meta.badgeClass}`}>
                        <StatusIcon size={13} />
                        {meta.label}
                      </span>
                    );
                  })()}
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-xs text-slate-400">
                    {PAY_TYPE_LABEL[selectedRecord.payType] ?? '未知计薪'}
                  </span>
                </div>
              </div>

              <div className="space-y-5 overflow-auto px-5 py-5">
                <div className="rounded-2xl border border-slate-800/70 bg-slate-950/80 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">当前规则</p>
                  <p className="mt-3 text-sm leading-7 text-slate-300">
                    {SALARY_STATUS_META[selectedRecord.status]?.helper}
                  </p>
                </div>

                <div className="grid gap-3">
                  <div className="rounded-2xl border border-slate-800/70 bg-slate-950/80 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">基地 / 岗位</p>
                    <p className="mt-3 text-sm text-slate-200">{selectedRecord.baseName}</p>
                    <p className="mt-1 text-sm text-slate-400">{selectedRecord.jobTitle}</p>
                  </div>

                  <div className="rounded-2xl border border-slate-800/70 bg-slate-950/80 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">工作量与单价</p>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl bg-slate-900/80 p-3">
                        <p className="text-xs text-slate-500">工作量</p>
                        <p className="mt-2 text-slate-200">{formatVolume(selectedRecord)}</p>
                      </div>
                      <div className="rounded-xl bg-slate-900/80 p-3">
                        <p className="text-xs text-slate-500">单价快照</p>
                        <p className="mt-2 text-slate-200">¥{Number(selectedRecord.unitPriceSnapshot).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-800/70 bg-slate-950/80 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">结算结果</p>
                    <p className="mt-3 text-3xl font-bold text-emerald-300">
                      ¥{Number(selectedRecord.totalAmount).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">创建于 {String(selectedRecord.createdAt).slice(0, 19).replace('T', ' ')}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800/70 bg-slate-950/80 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">支付流转</p>
                  <div className="mt-4 space-y-3">
                    {paymentsLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="animate-spin text-emerald-300" size={20} />
                      </div>
                    ) : latestPayment ? (
                      <>
                        <div className="rounded-xl bg-slate-900/80 p-3">
                          <p className="text-xs text-slate-500">支付方式</p>
                          <p className="mt-2 text-sm text-slate-200">{PAYMENT_METHOD_LABEL[latestPayment.paymentMethod] ?? latestPayment.paymentMethod}</p>
                        </div>
                        <div className="rounded-xl bg-slate-900/80 p-3">
                          <p className="text-xs text-slate-500">支付状态</p>
                          <p className="mt-2 text-sm text-slate-200">{PAYMENT_STATUS_LABEL[latestPayment.status] ?? '未知'}</p>
                        </div>
                        {latestPayment.confirmSignatureUrl && (
                          <div className="rounded-xl bg-slate-900/80 p-3">
                            <p className="text-xs text-slate-500">签字回执</p>
                            <a href={latestPayment.confirmSignatureUrl} target="_blank" rel="noreferrer" className="mt-2 block text-sm text-cyan-300 hover:text-cyan-200">
                              查看签字附件
                            </a>
                          </div>
                        )}
                        {latestPayment.paymentVoucherUrl && (
                          <div className="rounded-xl bg-slate-900/80 p-3">
                            <p className="text-xs text-slate-500">付款凭证</p>
                            <a href={latestPayment.paymentVoucherUrl} target="_blank" rel="noreferrer" className="mt-2 block text-sm text-cyan-300 hover:text-cyan-200">
                              查看付款凭证
                            </a>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="rounded-xl bg-slate-900/80 p-3 text-sm text-slate-500">
                        当前还没有支付单
                      </div>
                    )}
                  </div>
                </div>

                {actionButton}
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[720px] items-center justify-center px-6 text-center text-slate-500">
              选择一条工资记录查看详情
            </div>
          )}
        </aside>
      </section>

      {paymentModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={closePaymentModal} />
          <div className="relative z-10 w-full max-w-lg rounded-[28px] border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-white">
                  {paymentModal.type === 'create'
                    ? '创建支付单'
                    : paymentModal.type === 'confirm'
                      ? '确认支付'
                      : '完成发放'}
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                  {paymentModal.type === 'create'
                    ? '创建后进入支付确认环节'
                    : paymentModal.type === 'confirm'
                      ? '填写签字附件 URL'
                      : '填写付款凭证 URL'}
                </p>
              </div>
              <button onClick={closePaymentModal} className="text-slate-500 hover:text-white">
                <X size={22} />
              </button>
            </div>

            {paymentModal.type === 'create' ? (
              <div className="mt-6 space-y-4">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">支付方式</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'transfer')}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-white focus:border-emerald-500/40 focus:outline-none"
                >
                  <option value="transfer">转账</option>
                  <option value="cash">现金</option>
                </select>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {paymentModal.type === 'confirm' ? '签字附件 URL' : '付款凭证 URL'}
                </label>
                <input
                  value={attachmentUrl}
                  onChange={(e) => setAttachmentUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-white focus:border-emerald-500/40 focus:outline-none"
                />
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={closePaymentModal}
                className="flex-1 rounded-2xl bg-slate-800 px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-slate-700"
              >
                取消
              </button>
              <button
                onClick={handleSubmitPaymentAction}
                disabled={paymentSubmitting}
                className="flex-1 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
              >
                {paymentSubmitting ? '提交中...' : '确认提交'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
