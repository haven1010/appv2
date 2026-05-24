/**
 * Layer: Frontend View
 * Responsibility: Implements the Job Management screen and coordinates user interaction, page state, and API-driven data binding.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Filter,
  Briefcase,
  Calendar,
  Users,
  DollarSign,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  MoreVertical,
  UserCheck,
  Eye,
  ArrowRight,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../App';
import { UserRole } from '../types';
import {
  useBaseControllerFindAll,
  useBaseControllerGetJobsByBase,
  useBaseControllerCreateJob,
} from '@/api/generated/基地管理/基地管理';
import type { CreateJobDto } from '@/api/model';
import { AXIOS_INSTANCE } from '@/lib/http';

const JOB_STATUS_LABEL: Record<number, string> = {
  0: '已下架',
  1: '招聘中',
  2: '已招满',
  3: '已过期',
};

const PAY_TYPE_LABEL: Record<number, string> = {
  1: '固定',
  2: '时薪',
  3: '计件',
};

const APPLICATION_STATUS_LABEL: Record<number, string> = {
  0: '待审核',
  1: '已录取',
  2: '已拒绝',
  3: '已取消',
};

function formatJobSalary(job: any): string {
  if (!job) return '面议';
  switch (job.payType) {
    case 1:
      return job.salaryAmount != null ? `¥${job.salaryAmount}/天` : '固定工资';
    case 2:
      return job.hourlyRate != null ? `¥${job.hourlyRate}/小时` : '时薪';
    case 3:
      return job.unitPrice != null ? `¥${job.unitPrice}/件` : '计件';
    default:
      return '面议';
  }
}

export default function JobManagement() {
  const { user } = useAuth();
  const [showCandidates, setShowCandidates] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [manageJob, setManageJob] = useState<any>(null);
  const [activeBaseId, setActiveBaseId] = useState<number | null>(null);
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [showCreateJobModal, setShowCreateJobModal] = useState(false);
  const [jobKeyword, setJobKeyword] = useState('');
  const [jobStatusFilter, setJobStatusFilter] = useState<number | ''>('');

  const { data: rawBases = [], isLoading: basesLoading } = useBaseControllerFindAll({
    request:
      user?.role === UserRole.BASE_MANAGER
        ? { params: { ownerId: user.id } }
        : user?.role === UserRole.SUPER_ADMIN
        ? { params: { showAll: true } }
        : undefined,
  });

  const bases = useMemo(() => {
    if (!Array.isArray(rawBases)) return [];
    return rawBases
      .filter((b: any) => b.auditStatus === 1)
      .map((b: any) => ({
        id: b.id,
        name: b.baseName ?? b.name ?? '-',
      }));
  }, [rawBases]);

  useEffect(() => {
    if (activeBaseId == null && bases.length > 0) {
      setActiveBaseId(bases[0].id);
    }
  }, [activeBaseId, bases]);

  const { data: rawJobs, isLoading: jobsLoading, refetch: refetchJobs } = useBaseControllerGetJobsByBase(
    activeBaseId ?? 0,
    { query: { enabled: !!activeBaseId } },
  );

  const jobs = useMemo(() => {
    if (!Array.isArray(rawJobs)) return [];
    const baseName = bases.find((b) => b.id === activeBaseId)?.name;
    return rawJobs.map((j: any) => ({
      id: j.id,
      title: j.jobTitle ?? j.title ?? '-',
      base: j.base?.baseName ?? baseName ?? '-',
      count: j.recruitCount ?? 0,
      applied: j.applicantCount ?? 0,
      salary: formatJobSalary(j),
      period:
        j.workStartDate && j.workEndDate
          ? `${j.workStartDate} - ${j.workEndDate}`
          : '详见详情',
      statusCode: j.status,
      statusLabel: JOB_STATUS_LABEL[j.status] ?? '—',
      typeLabel: PAY_TYPE_LABEL[j.payType] ?? '—',
    }));
  }, [rawJobs, bases, activeBaseId]);

  const {
    data: applicationsRaw = [],
    isLoading: applicationsLoading,
    refetch: refetchApplications,
  } = useQuery({
    queryKey: ['jobApplications', selectedJob?.id],
    enabled: !!selectedJob,
    queryFn: async () => {
      if (!selectedJob?.id) return [];
      const res = await AXIOS_INSTANCE.get(`/api/base/jobs/${selectedJob.id}/applications`);
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  const applications = useMemo(
    () =>
      (Array.isArray(applicationsRaw) ? applicationsRaw : []).map((app: any) => ({
        id: app.id,
        name: app.user?.name ?? '未命名',
        phone: app.user?.phone ?? '—',
        appliedAt: app.createdAt ? new Date(app.createdAt).toLocaleString() : '',
        statusCode: app.status,
        statusLabel: APPLICATION_STATUS_LABEL[app.status] ?? '待审核',
      })),
    [applicationsRaw],
  );

  const {
    data: manageJobDetail,
    isLoading: manageJobLoading,
    refetch: refetchManageJob,
  } = useQuery({
    queryKey: ['jobDetail', manageJob?.id],
    enabled: !!manageJob?.id,
    queryFn: async () => {
      const res = await AXIOS_INSTANCE.get(`/api/base/jobs/${manageJob.id}`);
      return res.data;
    },
  });

  const visibleJobs = useMemo(() => {
    const keyword = jobKeyword.trim().toLowerCase();
    return jobs.filter((job) => {
      const matchKeyword =
        !keyword || job.title.toLowerCase().includes(keyword) || job.base.toLowerCase().includes(keyword);
      const matchStatus = jobStatusFilter === '' || job.statusCode === jobStatusFilter;
      return matchKeyword && matchStatus;
    });
  }, [jobs, jobKeyword, jobStatusFilter]);

  const handleOpenCandidates = (job: any) => {
    setSelectedJob(job);
    setShowCandidates(true);
  };

  const handleReview = async (applicationId: number, status: 1 | 2) => {
    setReviewingId(applicationId);
    try {
      await AXIOS_INSTANCE.patch(`/api/base/applications/${applicationId}/review`, {
        status,
      });
      await refetchApplications();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? '操作失败';
      alert(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setReviewingId(null);
    }
  };

  const handleUpdateJobStatus = async (jobId: number, status: number) => {
    try {
      await AXIOS_INSTANCE.patch(`/api/base/jobs/${jobId}/status`, { status });
      await Promise.all([refetchManageJob(), refetchApplications(), refetchJobs()]);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? '岗位状态更新失败';
      alert(Array.isArray(msg) ? msg[0] : msg);
    }
  };

  const handleRenewJob = async (jobId: number) => {
    try {
      await AXIOS_INSTANCE.patch(`/api/base/jobs/${jobId}/renew`);
      await Promise.all([refetchManageJob(), refetchJobs()]);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? '岗位续期失败';
      alert(Array.isArray(msg) ? msg[0] : msg);
    }
  };

  return (
    <div className="space-y-6 warm-business warm-business-jobs">
      <section className="soft-card-strong p-6 md:p-8">
        <p className="section-label">Hiring Pipeline</p>
        <h2 className="page-title">招聘管理页已切换到浅绿蓝白统一视觉</h2>
        <p className="page-subtitle">
          原有招聘筛选、候选人审核、岗位状态流转和续期操作全部保留，这里主要升级为更轻盈的阅读节奏和信息层级。
        </p>
        <div className="warm-business-summary mt-6">
          <article className="paper-panel p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#6b93ab]">岗位数量</p>
            <p className="mt-3 text-3xl font-extrabold tracking-tight text-[var(--ink)]">{jobs.length}</p>
          </article>
          <article className="paper-panel p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#6b93ab]">筛选结果</p>
            <p className="mt-3 text-3xl font-extrabold tracking-tight text-[var(--ink)]">{visibleJobs.length}</p>
          </article>
          <article className="paper-panel p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#6b93ab]">当前基地</p>
            <p className="mt-3 truncate text-xl font-bold text-[var(--ink)]">
              {bases.find((item) => item.id === activeBaseId)?.name ?? '未选择'}
            </p>
          </article>
        </div>
      </section>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">智慧用工 · 招聘管理</h2>
          <p className="text-slate-400 text-sm">
            基地管理员在这里集中管理本基地的招聘岗位与候选人筛选。
          </p>
        </div>
        {user?.role === UserRole.BASE_MANAGER ? (
          <button
            className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-2xl transition-all shadow-xl shadow-emerald-500/20 active:scale-95"
            disabled={!activeBaseId}
            onClick={() => setShowCreateJobModal(true)}
          >
            <Plus size={18} />
            <span>发布新需求</span>
          </button>
        ) : null}
      </div>

      <div className="glass-card rounded-[32px] p-8 border border-slate-800/60">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />
            <input
              type="text"
              placeholder="搜索岗位关键字或所属基地名称"
              value={jobKeyword}
              onChange={(e) => setJobKeyword(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-sm text-slate-100 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>
          <div className="flex gap-2">
            <label className="relative">
              <Filter className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <select
                value={jobStatusFilter}
                onChange={(e) => setJobStatusFilter(e.target.value === '' ? '' : Number(e.target.value))}
                className="rounded-2xl border border-slate-700/50 bg-slate-800 py-3 pl-11 pr-8 text-sm font-bold text-slate-300 transition-colors hover:bg-slate-700"
              >
                <option value="">全部状态</option>
                <option value={1}>招聘中</option>
                <option value={0}>已下架</option>
                <option value={2}>已招满</option>
                <option value={3}>已过期</option>
              </select>
            </label>
          </div>
        </div>

        {basesLoading ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-6">
            <Loader2 className="animate-spin" size={18} />
            正在加载基地信息...
          </div>
        ) : bases.length === 0 ? (
          <p className="text-slate-400 text-sm mb-4">
            暂无可用基地。请先在「基地管理」中申请入驻并通过审核后，再进行招聘管理。
          </p>
        ) : (
          <div className="flex items-center gap-3 mb-6">
            <span className="text-xs text-slate-400">当前基地：</span>
            <select
              value={activeBaseId ?? ''}
              onChange={(e) => setActiveBaseId(Number(e.target.value))}
              className="bg-slate-900 border border-slate-700 text-slate-100 text-sm rounded-xl px-3 py-2"
            >
              {bases.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6">
          {jobsLoading ? (
            <div className="col-span-full flex items-center justify-center py-16 text-slate-400 gap-3">
              <Loader2 className="animate-spin" size={24} />
              正在加载岗位数据...
            </div>
          ) : visibleJobs.length === 0 ? (
            <div className="col-span-full text-center py-12 text-slate-400 text-sm">
              当前筛选下暂无岗位记录。
            </div>
          ) : null}

          {!jobsLoading &&
            visibleJobs.map((job) => (
              <div
                key={job.id}
                className="glass-card p-6 rounded-[32px] border-slate-800/40 hover:border-emerald-500/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6 group relative overflow-hidden"
              >
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all" />
                <div className="flex-1 space-y-5">
                  <div className="flex items-center gap-4">
                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-emerald-500 group-hover:shadow-[0_0_20px_rgba(16,185,129,0.15)] transition-all">
                      <Briefcase size={28} />
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors leading-tight">
                        {job.title}
                      </h4>
                      <div className="flex items-center gap-4 mt-2">
                        <p className="text-xs text-slate-400 flex items-center gap-1.5">
                          <MapPin size={14} className="text-emerald-500" /> {job.base}
                        </p>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400 font-bold uppercase tracking-widest">
                          {job.typeLabel}结算
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
                        <Users size={12} /> 岗位定员
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-bold text-slate-100">
                          {job.applied}
                        </span>
                        <span className="text-slate-400 text-xs">/ {job.count} 人</span>
                        <div className="w-full max-w-[60px] h-1 bg-slate-800 rounded-full ml-1 overflow-hidden">
                          <div
                            className="h-full bg-emerald-500"
                            style={{
                              width: `${job.count ? (job.applied / job.count) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
                        <DollarSign size={12} /> 薪资标准
                      </span>
                      <span className="text-lg font-bold text-emerald-400">
                        {job.salary}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
                        <Calendar size={12} /> 工作周期
                      </span>
                      <span className="text-sm font-bold text-slate-300">{job.period}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
                        <Clock size={12} /> 状态
                      </span>
                      <span
                        className={`text-xs font-bold w-fit px-2 py-0.5 rounded-lg ${
                          job.statusCode === 1
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : job.statusCode === 2
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : job.statusCode === 3
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-slate-800 text-slate-400 border border-slate-700/50'
                        }`}
                      >
                        {job.statusLabel}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-row md:flex-col items-center md:items-end gap-3 min-w-[140px]">
                  <button
                    onClick={() => handleOpenCandidates(job)}
                    className="flex-1 md:w-full py-3 px-4 rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 text-xs font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2 group/btn"
                  >
                    <UserCheck size={16} className="text-emerald-500" />
                    查看候选人
                    <ArrowRight
                      size={14}
                      className="opacity-0 group-hover/btn:opacity-100 group-hover/btn:translate-x-1 transition-all"
                    />
                  </button>
                  {user?.role === UserRole.BASE_MANAGER ? (
                    <button
                      onClick={() => setManageJob(job)}
                      className="flex-1 md:w-full py-3 px-4 rounded-2xl bg-slate-950 border border-slate-800 text-slate-400 text-xs font-bold hover:text-slate-100 hover:border-slate-700 transition-all flex items-center justify-center gap-2"
                    >
                      <MoreVertical size={16} />
                      管理岗位
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* 候选人弹窗 */}
      <AnimatePresence>
        {showCandidates && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCandidates(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="max-w-4xl w-full bg-slate-900 border border-slate-800 rounded-[40px] shadow-2xl relative z-10 overflow-hidden"
            >
              <div className="p-8 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-2xl">
                    <UserCheck size={28} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">申请人列表</h3>
                    <p className="text-sm text-slate-400 mt-0.5">
                      {selectedJob?.title} - {selectedJob?.base}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCandidates(false)}
                  className="p-2 text-slate-400 hover:text-white transition-colors"
                >
                  <XCircle size={32} />
                </button>
              </div>

              <div className="p-8">
                <div className="grid grid-cols-1 gap-4">
                  {applicationsLoading ? (
                    <div className="flex items-center justify-center py-10 gap-2 text-slate-400">
                      <Loader2 className="animate-spin" size={20} />
                      正在加载候选人...
                    </div>
                  ) : applications.length === 0 ? (
                    <p className="text-center text-slate-400 text-sm py-8">
                      暂无报名记录。采摘工可在「采摘工工作台」中申请该岗位后出现在此处。
                    </p>
                  ) : (
                    applications.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between p-5 bg-slate-950/50 border border-slate-800/60 rounded-3xl hover:border-emerald-500/30 transition-all"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-xl font-bold text-emerald-500">
                            {c.name[0]}
                          </div>
                          <div>
                            <h5 className="font-bold text-slate-100 text-lg">{c.name}</h5>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-slate-400">{c.phone}</span>
                              <span className="flex items-center gap-1 text-xs text-amber-400">
                                <CheckCircle2 size={12} /> {c.statusLabel}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-8">
                          <div className="text-right">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">
                              当前状态
                            </p>
                            <span
                              className={`text-xs font-bold ${
                                c.statusCode === 1
                                  ? 'text-emerald-400'
                                  : c.statusCode === 2
                                  ? 'text-rose-400'
                                  : 'text-amber-400'
                              }`}
                            >
                              {c.statusLabel}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <button className="p-3 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-2xl border border-slate-800 transition-all">
                              <Eye size={18} />
                            </button>
                            <button
                              disabled={reviewingId === c.id}
                              onClick={() => handleReview(c.id, 2)}
                              className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-2xl border border-slate-700 active:scale-95 transition-all disabled:opacity-50"
                            >
                              拒绝
                            </button>
                            <button
                              disabled={reviewingId === c.id}
                              onClick={() => handleReview(c.id, 1)}
                              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-bold rounded-2xl shadow-lg shadow-emerald-500/10 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                              {reviewingId === c.id && (
                                <Loader2 className="animate-spin" size={14} />
                              )}
                              录取
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="p-6 bg-slate-950/50 border-t border-slate-800 text-center">
                <p className="text-xs text-slate-600">
                  共有 {applications.length} 位采摘工申请了此岗位，可在此完成「录取 / 拒绝」筛选。
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 发布招聘弹窗 */}
      <AnimatePresence>
        {showCreateJobModal && activeBaseId != null && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateJobModal(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <CreateJobInlineModal
              baseId={activeBaseId}
              onClose={() => setShowCreateJobModal(false)}
              onSuccess={() => setShowCreateJobModal(false)}
            />
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {manageJob && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setManageJob(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative z-10 w-full max-w-2xl rounded-[32px] border border-slate-800 bg-slate-900 p-6 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-bold text-white">岗位管理</h3>
                  <p className="mt-1 text-sm text-slate-400">{manageJob.title}</p>
                </div>
                <button onClick={() => setManageJob(null)} className="text-slate-400 transition hover:text-white">
                  <XCircle size={28} />
                </button>
              </div>

              {manageJobLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="animate-spin text-emerald-400" size={28} />
                </div>
              ) : manageJobDetail ? (
                <div className="mt-6 space-y-5">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">当前状态</p>
                      <p className="mt-3 text-lg font-bold text-white">
                        {JOB_STATUS_LABEL[manageJobDetail.status as number] ?? '未知'}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">有效期</p>
                      <p className="mt-3 text-lg font-bold text-white">
                        {manageJobDetail.validUntil ? String(manageJobDetail.validUntil).slice(0, 10) : '未设置'}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">浏览量</p>
                      <p className="mt-3 text-lg font-bold text-white">{manageJobDetail.viewCount ?? 0}</p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      onClick={() => handleUpdateJobStatus(manageJob.id, 1)}
                      className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
                    >
                      上架招聘
                    </button>
                    <button
                      onClick={() => handleUpdateJobStatus(manageJob.id, 0)}
                      className="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-700"
                    >
                      下架岗位
                    </button>
                    <button
                      onClick={() => handleUpdateJobStatus(manageJob.id, 2)}
                      className="rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm font-semibold text-blue-200 transition hover:bg-blue-500/20"
                    >
                      标记招满
                    </button>
                    <button
                      onClick={() => handleRenewJob(manageJob.id)}
                      className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-200 transition hover:bg-amber-500/20"
                    >
                      <span className="inline-flex items-center gap-2">
                        <RefreshCw size={15} />
                        岗位续期
                      </span>
                    </button>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">岗位说明</p>
                    <p className="mt-3 text-sm leading-7 text-slate-300">
                      {manageJobDetail.workContent || manageJobDetail.requirements || '暂无补充说明'}
                    </p>
                  </div>
                </div>
              ) : null}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CreateJobInlineModal({
  baseId,
  onClose,
  onSuccess,
}: {
  baseId: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState<Partial<CreateJobDto>>({
    jobTitle: '',
    payType: 2,
    recruitCount: 1,
    hourlyRate: 25,
    requirements: '',
    workContent: '',
  });

  const createJobMutation = useBaseControllerCreateJob({
    mutation: {
      onSuccess: () => {
        alert('发布成功，可前往「基地管理 → 基地详情」查看岗位列表。');
        onSuccess();
      },
      onError: (e: any) => alert(e?.response?.data?.message ?? '发布失败'),
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createJobMutation.mutate({ id: baseId, data: form as CreateJobDto });
  };

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.9, opacity: 0, y: 20 }}
      onClick={(e) => e.stopPropagation()}
      className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-xl relative z-10"
    >
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold text-white">发布招聘岗位</h3>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white"
        >
          <XCircle size={20} />
        </button>
      </div>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm text-slate-400 mb-1.5">岗位名称</label>
          <input
            required
            placeholder="如：采摘工、包装工"
            value={form.jobTitle ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1.5">薪资类型</label>
          <select
            value={form.payType ?? 2}
            onChange={(e) =>
              setForm((f) => ({ ...f, payType: Number(e.target.value) as 1 | 2 | 3 }))
            }
            className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white"
          >
            <option value={1}>固定工资</option>
            <option value={2}>时薪</option>
            <option value={3}>计件</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1.5">招聘人数</label>
          <input
            type="number"
            min={1}
            placeholder="计划招聘的总人数，如 20"
            value={form.recruitCount ?? ''}
            onChange={(e) =>
              setForm((f) => ({ ...f, recruitCount: Number(e.target.value) || 1 }))
            }
            className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500"
          />
        </div>
        {form.payType === 1 && (
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">固定工资</label>
            <input
              type="number"
              min={0}
              step={0.01}
              placeholder="元/天，如 200"
              value={form.salaryAmount ?? ''}
              onChange={(e) =>
                setForm((f) => ({ ...f, salaryAmount: Number(e.target.value) }))
              }
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500"
            />
          </div>
        )}
        {(form.payType === 2 || !form.payType) && (
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">时薪</label>
            <input
              type="number"
              min={0}
              step={0.01}
              placeholder="元/小时，如 25"
              value={form.hourlyRate ?? ''}
              onChange={(e) =>
                setForm((f) => ({ ...f, hourlyRate: Number(e.target.value) }))
              }
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500"
            />
          </div>
        )}
        {form.payType === 3 && (
          <>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">计件单价</label>
              <input
                type="number"
                min={0}
                step={0.01}
                placeholder="元/件，如 1.5"
                value={form.unitPrice ?? ''}
                onChange={(e) =>
                  setForm((f) => ({ ...f, unitPrice: Number(e.target.value) }))
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">目标数量</label>
              <input
                type="number"
                min={1}
                step={1}
                placeholder="计件用，如 100"
                value={form.targetCount ?? ''}
                onChange={(e) =>
                  setForm((f) => ({ ...f, targetCount: Number(e.target.value) }))
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500"
              />
            </div>
          </>
        )}
        <div>
          <label className="block text-sm text-slate-400 mb-1.5">工作内容</label>
          <textarea
            placeholder="描述具体的工作内容和职责"
            value={form.workContent ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, workContent: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500"
            rows={2}
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1.5">招聘要求</label>
          <textarea
            placeholder="描述对候选人的要求和条件"
            value={form.requirements ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, requirements: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500"
            rows={2}
          />
        </div>
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 font-medium"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={createJobMutation.isPending}
            className="flex-1 py-2 rounded-xl bg-emerald-500 text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {createJobMutation.isPending && <Loader2 className="animate-spin" size={18} />}
            发布
          </button>
        </div>
      </form>
    </motion.div>
  );
}
