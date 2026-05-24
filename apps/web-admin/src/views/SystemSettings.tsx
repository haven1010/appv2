/**
 * Layer: Frontend View
 * Responsibility: Implements the System Settings screen and coordinates user interaction, page state, and API-driven data binding.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Clock3,
  Loader2,
  RefreshCw,
  ScrollText,
  Shield,
  ShieldCheck,
  Siren,
  Sprout,
  Users,
} from 'lucide-react';
import { AXIOS_INSTANCE } from '../lib/http';

interface SystemStats {
  users: { total: number; workers: number; admins: number; pending: number };
  bases: { total: number; approved: number; pending: number };
  logs: { total: number; today: number; byType: { type: string; count: string }[] };
}

interface BaseOption {
  id: number;
  baseName: string;
  auditStatus?: number;
}

interface ExpiringJob {
  id: number;
  jobTitle: string;
  validUntil?: string;
  base?: { baseName?: string };
}

interface CooperationRecord {
  id: number;
  baseId: number;
  applicantId: number;
  requirement: string;
  status: number;
  rejectReason?: string | null;
  createdAt: string;
  applicant?: { name?: string };
}

const COOP_STATUS_MAP: Record<number, { label: string; badgeClass: string }> = {
  0: { label: '待审核', badgeClass: 'bg-amber-500/10 text-white ring-1 ring-amber-500/20' },
  1: { label: '已同意', badgeClass: 'bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20' },
  2: { label: '已拒绝', badgeClass: 'bg-rose-500/10 text-rose-300 ring-1 ring-rose-500/20' },
};

export default function SystemSettings() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [bases, setBases] = useState<BaseOption[]>([]);
  const [selectedBaseId, setSelectedBaseId] = useState<number | null>(null);
  const [cooperations, setCooperations] = useState<CooperationRecord[]>([]);
  const [coopLoading, setCoopLoading] = useState(false);
  const [expiringJobs, setExpiringJobs] = useState<ExpiringJob[]>([]);
  const [expiringDays, setExpiringDays] = useState(3);
  const [expiringLoading, setExpiringLoading] = useState(false);
  const [deactivateLoading, setDeactivateLoading] = useState(false);
  const [creatingSuperAdmin, setCreatingSuperAdmin] = useState(false);
  const [creatingCooperation, setCreatingCooperation] = useState(false);
  const [reviewingCooperationId, setReviewingCooperationId] = useState<number | null>(null);
  const [superAdminForm, setSuperAdminForm] = useState({
    name: '',
    idCard: '',
    phone: '',
    emergencyContact: '',
    emergencyPhone: '',
    regionCode: '',
  });
  const [cooperationRequirement, setCooperationRequirement] = useState('');

  const loadOverview = async () => {
    setLoading(true);
    try {
      const [userStats, dashStats, logStats, baseList] = await Promise.all([
        AXIOS_INSTANCE.get('/api/user/stats').catch(() => ({ data: {} })),
        AXIOS_INSTANCE.get('/api/dashboard/stats').catch(() => ({ data: {} })),
        AXIOS_INSTANCE.get('/api/operation-log/stats').catch(() => ({
          data: { total: 0, todayCount: 0, byType: [] },
        })),
        AXIOS_INSTANCE.get('/api/base', { params: { showAll: true } }).catch(() => ({ data: [] })),
      ]);

      const nextBases = (Array.isArray(baseList.data) ? baseList.data : []) as BaseOption[];
      setStats({
        users: {
          total: userStats.data.totalUsers || 0,
          workers: userStats.data.totalWorkers || 0,
          admins: userStats.data.totalAdmins || 0,
          pending: userStats.data.pendingAudit || 0,
        },
        bases: {
          total: dashStats.data.allBases || 0,
          approved: dashStats.data.totalBases || 0,
          pending: dashStats.data.pendingAuditBases || 0,
        },
        logs: {
          total: logStats.data.total || 0,
          today: logStats.data.todayCount || 0,
          byType: Array.isArray(logStats.data.byType) ? logStats.data.byType : [],
        },
      });
      setBases(nextBases);
      setSelectedBaseId((current) => current ?? nextBases[0]?.id ?? null);
    } finally {
      setLoading(false);
    }
  };

  const loadExpiringJobs = async (days = expiringDays) => {
    setExpiringLoading(true);
    try {
      const res = await AXIOS_INSTANCE.get('/api/base/jobs/expiring', { params: { days } });
      setExpiringJobs(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error(e);
      setExpiringJobs([]);
    } finally {
      setExpiringLoading(false);
    }
  };

  const loadCooperations = async (baseId: number | null) => {
    if (!baseId) {
      setCooperations([]);
      return;
    }
    setCoopLoading(true);
    try {
      const res = await AXIOS_INSTANCE.get(`/api/base/${baseId}/cooperations`);
      setCooperations(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error(e);
      setCooperations([]);
    } finally {
      setCoopLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  useEffect(() => {
    loadExpiringJobs(expiringDays);
  }, [expiringDays]);

  useEffect(() => {
    loadCooperations(selectedBaseId);
  }, [selectedBaseId]);

  const logTypeMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of stats?.logs.byType || []) {
      map.set(item.type, Number(item.count));
    }
    return map;
  }, [stats]);

  const handleCreateSuperAdmin = async () => {
    if (!superAdminForm.name.trim() || !superAdminForm.idCard.trim() || !superAdminForm.phone.trim()) {
      alert('请完整填写次级超级管理员资料');
      return;
    }

    setCreatingSuperAdmin(true);
    try {
      const res = await AXIOS_INSTANCE.post('/api/user/admin/super-admin', {
        name: superAdminForm.name.trim(),
        idCard: superAdminForm.idCard.trim(),
        phone: superAdminForm.phone.trim(),
        emergencyContact: superAdminForm.emergencyContact.trim() || undefined,
        emergencyPhone: superAdminForm.emergencyPhone.trim() || undefined,
        regionCode: superAdminForm.regionCode ? Number(superAdminForm.regionCode) : undefined,
      });
      alert(`创建成功，UID：${res.data?.uid || '-'}`);
      setSuperAdminForm({
        name: '',
        idCard: '',
        phone: '',
        emergencyContact: '',
        emergencyPhone: '',
        regionCode: '',
      });
      await loadOverview();
    } catch (e: any) {
      const msg = e?.response?.data?.message || '创建失败';
      alert(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setCreatingSuperAdmin(false);
    }
  };

  const handleCreateCooperation = async () => {
    if (!selectedBaseId) {
      alert('请先选择基地');
      return;
    }
    if (!cooperationRequirement.trim()) {
      alert('请输入合作需求');
      return;
    }

    setCreatingCooperation(true);
    try {
      await AXIOS_INSTANCE.post('/api/base/cooperation', {
        baseId: selectedBaseId,
        requirement: cooperationRequirement.trim(),
      });
      setCooperationRequirement('');
      await loadCooperations(selectedBaseId);
      alert('合作申请已提交');
    } catch (e: any) {
      const msg = e?.response?.data?.message || '提交失败';
      alert(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setCreatingCooperation(false);
    }
  };

  const handleReviewCooperation = async (cooperationId: number, status: 1 | 2) => {
    const rejectReason = status === 2 ? window.prompt('请输入拒绝原因（可选）') || undefined : undefined;
    setReviewingCooperationId(cooperationId);
    try {
      await AXIOS_INSTANCE.patch(`/api/base/cooperation/${cooperationId}/review`, {
        status,
        rejectReason,
      });
      await loadCooperations(selectedBaseId);
    } catch (e: any) {
      const msg = e?.response?.data?.message || '审核失败';
      alert(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setReviewingCooperationId(null);
    }
  };

  const handleDeactivateExpired = async () => {
    setDeactivateLoading(true);
    try {
      const res = await AXIOS_INSTANCE.post('/api/base/jobs/deactivate-expired');
      alert(`本次已停用 ${res.data?.deactivated ?? 0} 个过期岗位`);
      await loadExpiringJobs(expiringDays);
    } catch (e: any) {
      const msg = e?.response?.data?.message || '批量停用失败';
      alert(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setDeactivateLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-emerald-400" size={32} />
        <span className="ml-3 text-slate-400">加载运营控制台...</span>
      </div>
    );
  }

  return (
    <div className="space-y-7 pb-8">
      <section className="overflow-hidden rounded-[30px] border border-cyan-500/15 bg-[radial-gradient(circle_at_top_right,_rgba(34,211,238,0.18),_transparent_30%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] p-6 shadow-[0_24px_80px_rgba(2,6,23,0.52)]">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">
              <ShieldCheck size={14} />
              Operations Console
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-white">系统运营控制台</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              这里直接接入超管创建、岗位到期维护、合作申请与审核。页面只展示可执行能力，不保留静态说明卡。
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-white/6 bg-slate-950/45 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">总用户</p>
              <p className="mt-2 text-2xl font-bold text-white">{stats?.users.total ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-white/6 bg-slate-950/45 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">基地</p>
              <p className="mt-2 text-2xl font-bold text-white">{stats?.bases.total ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-white/6 bg-slate-950/45 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">今日日志</p>
              <p className="mt-2 text-2xl font-bold text-emerald-300">{stats?.logs.today ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-white/6 bg-slate-950/45 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">支付日志</p>
              <p className="mt-2 text-2xl font-bold text-orange-300">{logTypeMap.get('payment') ?? 0}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-4">
        {[
          { title: '管理员', value: stats?.users.admins ?? 0, icon: Shield, tone: 'text-amber-200' },
          { title: '采摘工', value: stats?.users.workers ?? 0, icon: Users, tone: 'text-emerald-300' },
          { title: '待审核基地', value: stats?.bases.pending ?? 0, icon: Siren, tone: 'text-rose-300' },
          { title: '审计总量', value: stats?.logs.total ?? 0, icon: ScrollText, tone: 'text-cyan-300' },
        ].map((item) => (
          <article key={item.title} className="rounded-[26px] border border-slate-800/70 bg-slate-950/65 p-5">
            <div className={`rounded-2xl bg-slate-900/80 p-3 ${item.tone} w-fit`}>
              <item.icon size={22} />
            </div>
            <h3 className="mt-5 text-sm font-medium text-slate-400">{item.title}</h3>
            <p className="mt-2 text-3xl font-bold text-white">{item.value}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_1fr]">
        <article className="rounded-[28px] border border-slate-800/70 bg-slate-950/65 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-white">创建次级超级管理员</h3>
              <p className="mt-1 text-sm text-slate-400">直接调用后端 `admin/super-admin` 接口，不再停留在说明文案。</p>
            </div>
            <button
              onClick={loadOverview}
              className="rounded-2xl border border-slate-700/70 bg-slate-950/55 px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-cyan-500/30 hover:text-white"
            >
              <span className="inline-flex items-center gap-2">
                <RefreshCw size={16} />
                刷新
              </span>
            </button>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <input
              value={superAdminForm.name}
              onChange={(e) => setSuperAdminForm((current) => ({ ...current, name: e.target.value }))}
              placeholder="真实姓名"
              className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-white focus:border-cyan-500/40 focus:outline-none"
            />
            <input
              value={superAdminForm.phone}
              onChange={(e) => setSuperAdminForm((current) => ({ ...current, phone: e.target.value }))}
              placeholder="手机号"
              className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-white focus:border-cyan-500/40 focus:outline-none"
            />
            <input
              value={superAdminForm.idCard}
              onChange={(e) => setSuperAdminForm((current) => ({ ...current, idCard: e.target.value }))}
              placeholder="身份证号"
              className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-white focus:border-cyan-500/40 focus:outline-none"
            />
            <input
              value={superAdminForm.regionCode}
              onChange={(e) => setSuperAdminForm((current) => ({ ...current, regionCode: e.target.value }))}
              placeholder="区域代码（选填）"
              className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-white focus:border-cyan-500/40 focus:outline-none"
            />
            <input
              value={superAdminForm.emergencyContact}
              onChange={(e) => setSuperAdminForm((current) => ({ ...current, emergencyContact: e.target.value }))}
              placeholder="紧急联系人"
              className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-white focus:border-cyan-500/40 focus:outline-none"
            />
            <input
              value={superAdminForm.emergencyPhone}
              onChange={(e) => setSuperAdminForm((current) => ({ ...current, emergencyPhone: e.target.value }))}
              placeholder="紧急联系人电话"
              className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-white focus:border-cyan-500/40 focus:outline-none"
            />
          </div>

          <button
            onClick={handleCreateSuperAdmin}
            disabled={creatingSuperAdmin}
            className="mt-5 rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
          >
            {creatingSuperAdmin ? '创建中...' : '创建次级超级管理员'}
          </button>
        </article>

        <article className="rounded-[28px] border border-slate-800/70 bg-slate-950/65 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-white">岗位到期维护</h3>
              <p className="mt-1 text-sm text-slate-400">查看即将过期岗位，并触发后端批量停用过期岗位。</p>
            </div>
            <button
              onClick={handleDeactivateExpired}
              disabled={deactivateLoading}
              className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
            >
              {deactivateLoading ? '处理中...' : '停用已过期岗位'}
            </button>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <label className="text-sm text-slate-400">预警天数</label>
            <select
              value={expiringDays}
              onChange={(e) => setExpiringDays(Number(e.target.value))}
              className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-white focus:border-amber-500/40 focus:outline-none"
            >
              <option value={3}>3 天</option>
              <option value={7}>7 天</option>
              <option value={14}>14 天</option>
            </select>
          </div>

          <div className="mt-5 space-y-3">
            {expiringLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-amber-400" size={24} />
              </div>
            ) : expiringJobs.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-8 text-center text-sm text-slate-400">
                当前窗口内没有即将过期岗位
              </div>
            ) : (
              expiringJobs.map((job) => (
                <div key={job.id} className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{job.jobTitle}</p>
                      <p className="mt-1 text-sm text-slate-400">{job.base?.baseName ?? '-'}</p>
                    </div>
                    <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs text-white">
                      {job.validUntil ? String(job.validUntil).slice(0, 10) : '未设置'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="rounded-[28px] border border-slate-800/70 bg-slate-950/65 p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">基地合作申请与审核</h3>
            <p className="mt-1 text-sm text-slate-400">选择基地后可直接提交合作需求，并在同页审核历史记录。</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <select
              value={selectedBaseId ?? ''}
              onChange={(e) => setSelectedBaseId(e.target.value ? Number(e.target.value) : null)}
              className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-white focus:border-emerald-500/40 focus:outline-none"
            >
              {bases.map((base) => (
                <option key={base.id} value={base.id}>
                  {base.baseName}
                </option>
              ))}
            </select>
            <button
              onClick={() => loadCooperations(selectedBaseId)}
              className="rounded-2xl border border-slate-700/70 bg-slate-950/55 px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-emerald-500/30 hover:text-white"
            >
              刷新记录
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[420px_1fr]">
          <div className="rounded-[24px] border border-slate-800 bg-slate-950/70 p-5">
            <div className="flex items-center gap-3 text-emerald-300">
              <Sprout size={20} />
              <span className="text-sm font-medium">发起合作申请</span>
            </div>
            <textarea
              value={cooperationRequirement}
              onChange={(e) => setCooperationRequirement(e.target.value)}
              placeholder="填写工种、人数、周期、结算要求等合作需求"
              rows={8}
              className="mt-4 w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-white focus:border-emerald-500/40 focus:outline-none"
            />
            <button
              onClick={handleCreateCooperation}
              disabled={creatingCooperation}
              className="mt-4 w-full rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
            >
              {creatingCooperation ? '提交中...' : '提交合作申请'}
            </button>
          </div>

          <div className="rounded-[24px] border border-slate-800 bg-slate-950/70 p-5">
            <div className="flex items-center gap-3 text-cyan-300">
              <Clock3 size={20} />
              <span className="text-sm font-medium">合作记录</span>
            </div>

            <div className="mt-5 space-y-4">
              {coopLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="animate-spin text-cyan-400" size={24} />
                </div>
              ) : cooperations.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-10 text-center text-sm text-slate-400">
                  当前基地暂无合作记录
                </div>
              ) : (
                cooperations.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-white">
                          申请人：{item.applicant?.name || `#${item.applicantId}`}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          提交于 {String(item.createdAt).slice(0, 19).replace('T', ' ')}
                        </p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${COOP_STATUS_MAP[item.status]?.badgeClass || 'bg-slate-800 text-slate-300'}`}>
                        {COOP_STATUS_MAP[item.status]?.label || '未知'}
                      </span>
                    </div>
                    <p className="mt-4 text-sm leading-7 text-slate-300">{item.requirement}</p>
                    {item.rejectReason && (
                      <p className="mt-3 rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                        拒绝原因：{item.rejectReason}
                      </p>
                    )}
                    {item.status === 0 && (
                      <div className="mt-4 flex gap-3">
                        <button
                          onClick={() => handleReviewCooperation(item.id, 1)}
                          disabled={reviewingCooperationId === item.id}
                          className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
                        >
                          通过
                        </button>
                        <button
                          onClick={() => handleReviewCooperation(item.id, 2)}
                          disabled={reviewingCooperationId === item.id}
                          className="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-700 disabled:opacity-50"
                        >
                          驳回
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
