import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  QrCode,
  MapPin,
  Clock,
  Briefcase,
  User,
  History,
  ChevronRight,
  LogOut,
  Star,
  Pencil,
  Sprout,
  CheckCircle2,
  CreditCard,
  Search,
  X,
  Loader2,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../App';
import { useRecommendationControllerGetRecommendedBases } from '@/api/generated/智能推荐/智能推荐';
import { useBaseControllerGetJobsByBase } from '@/api/generated/基地管理/基地管理';
import { AXIOS_INSTANCE } from '@/lib/http';

type WorkerStats = { workDays: number; pendingAmount: number };
type PendingItem = {
  id: number;
  workDate: string;
  baseName: string;
  jobTitle: string;
  workDuration: number;
  pieceCount: number;
  totalAmount: number;
  status: number;
};

type ProfileData = {
  id: number;
  uid: string;
  name: string;
  phone?: string;
  idCard?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  faceImgUrl?: string;
  infoAuditStatus?: number;
};

type WorkRecordItem = {
  id: number;
  baseName: string;
  jobTitle: string;
  workDate: string;
  status: number;
  statusText: string;
  checkinTime?: string;
  createdAt?: string;
};

function maskPhone(phone?: string) {
  if (!phone || phone.length < 7) return phone ?? '';
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}

function maskIdCard(id?: string) {
  if (!id || id.length < 8) return id ?? '';
  return id.slice(0, 4) + '**********' + id.slice(-4);
}

const APPLICATION_STATUS_MAP: Record<number, string> = {
  0: '审核中',
  1: '已录取',
  2: '已拒绝',
  3: '已取消',
};

function ProfileEditForm({
  profile,
  onSave,
  onCancel,
  loading,
}: {
  profile?: ProfileData | null;
  onSave: (data: { name?: string; phone?: string; emergencyContact?: string; emergencyPhone?: string }) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [name, setName] = useState(profile?.name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [emergencyContact, setEmergencyContact] = useState(profile?.emergencyContact ?? '');
  const [emergencyPhone, setEmergencyPhone] = useState(profile?.emergencyPhone ?? '');
  React.useEffect(() => {
    if (profile) {
      setName(profile.name ?? '');
      setPhone(profile.phone ?? '');
      setEmergencyContact(profile.emergencyContact ?? '');
      setEmergencyPhone(profile.emergencyPhone ?? '');
    }
  }, [profile]);
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name?.trim()) {
      alert('姓名不能为空');
      return;
    }
    onSave({ name: name.trim(), phone: phone || undefined, emergencyContact: emergencyContact || undefined, emergencyPhone: emergencyPhone || undefined });
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs text-slate-500 mb-1">姓名</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-100"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">手机号</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-100"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">紧急联系人</label>
        <input
          type="text"
          value={emergencyContact}
          onChange={(e) => setEmergencyContact(e.target.value)}
          placeholder="姓名及关系，如：张三-配偶"
          className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-100"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">紧急联系人电话</label>
        <input
          type="tel"
          value={emergencyPhone}
          onChange={(e) => setEmergencyPhone(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-100"
        />
      </div>
      <p className="text-xs text-amber-400">修改手机号或紧急联系人后需重新审核</p>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-400 font-bold">
          取消
        </button>
        <button type="submit" disabled={loading} className="flex-1 py-3 rounded-xl bg-emerald-500 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <Loader2 className="animate-spin" size={18} /> : null}
          保存
        </button>
      </div>
    </form>
  );
}

function formatJobSalary(job: { payType?: number; salaryAmount?: number; hourlyRate?: number; unitPrice?: number; targetCount?: number }): string {
  if (!job) return '面议';
  switch (job.payType) {
    case 1:
      return job.salaryAmount != null ? `¥${job.salaryAmount}/天` : '面议';
    case 2:
      return job.hourlyRate != null ? `¥${job.hourlyRate}/小时` : '面议';
    case 3:
      return job.unitPrice != null ? `¥${job.unitPrice}/件` : '面议';
    default:
      return '面议';
  }
}

export default function WorkerView() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('home');
  const [showQRModal, setShowQRModal] = useState(false);
  const [showApplySuccess, setShowApplySuccess] = useState(false);
  const [selectedBaseId, setSelectedBaseId] = useState<number | null>(null);
  const [applyLoading, setApplyLoading] = useState(false);
  const [selectedAppDetail, setSelectedAppDetail] = useState<any | null>(null);
  const [showProfileDetail, setShowProfileDetail] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [showWorkHistory, setShowWorkHistory] = useState(false);
  const [showBankCard, setShowBankCard] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const { data: recommendedBases = [], isLoading: basesLoading } = useRecommendationControllerGetRecommendedBases();
  const { data: baseJobs = [], isLoading: jobsLoading } = useBaseControllerGetJobsByBase(selectedBaseId ?? 0, {
    query: { enabled: !!selectedBaseId },
  });

  const { data: workerStats } = useQuery({
    queryKey: ['worker', 'stats'],
    queryFn: async () => {
      const res = await AXIOS_INSTANCE.get<WorkerStats>('/api/salary/worker/stats');
      return res.data;
    },
  });

  const { data: workerPending = [], refetch: refetchPending } = useQuery({
    queryKey: ['worker', 'pending'],
    queryFn: async () => {
      const res = await AXIOS_INSTANCE.get<PendingItem[]>('/api/salary/worker/pending');
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: activeTab === 'applications',
  });

  const { data: qrData, isLoading: qrLoading } = useQuery({
    queryKey: ['worker', 'qrcode'],
    queryFn: async () => {
      const res = await AXIOS_INSTANCE.get<{ content: string; validDuration: string }>('/api/attendance/qrcode');
      return res.data;
    },
    enabled: showQRModal,
  });

  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ['worker', 'profile'],
    queryFn: async () => {
      const res = await AXIOS_INSTANCE.get<ProfileData>('/api/user/profile');
      return res.data;
    },
    enabled: activeTab === 'profile' || showProfileDetail || showProfileEdit,
  });

  const { data: workRecords = [], isLoading: workRecordsLoading } = useQuery({
    queryKey: ['worker', 'workRecords'],
    queryFn: async () => {
      const res = await AXIOS_INSTANCE.get<WorkRecordItem[]>('/api/attendance/worker/records');
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: showWorkHistory,
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: { name?: string; phone?: string; emergencyContact?: string; emergencyPhone?: string }) =>
      AXIOS_INSTANCE.patch('/api/user/profile', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker', 'profile'] });
      setShowProfileEdit(false);
      setShowProfileDetail(true);
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message ?? '更新失败';
      alert(Array.isArray(msg) ? msg[0] : msg);
    },
  });

  const confirmSalaryMutation = useMutation({
    mutationFn: (salaryId: number) =>
      AXIOS_INSTANCE.post(`/api/salary/worker/${salaryId}/confirm`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker', 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['worker', 'stats'] });
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message ?? '确认失败';
      alert(Array.isArray(msg) ? msg[0] : msg);
    },
  });

  const { data: myApplicationsRaw = [], refetch: refetchApplications } = useQuery({
    queryKey: ['worker', 'myApplications'],
    queryFn: async () => {
      const res = await AXIOS_INSTANCE.get<unknown[]>('/api/base/applications/me');
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  const applications = myApplicationsRaw.map((app: any) => ({
    id: app.id,
    title: app.job?.jobTitle ?? '岗位',
    base: app.base?.baseName ?? '基地',
    status: APPLICATION_STATUS_MAP[app.status] ?? '审核中',
    step: app.status === 1 ? 3 : app.status === 2 ? 0 : 1,
    date: app.createdAt ? new Date(app.createdAt).toLocaleDateString() : '',
    raw: app,
  }));

  const handleApply = async (jobId: number, baseId: number) => {
    setApplyLoading(true);
    try {
      await AXIOS_INSTANCE.post(`/api/base/jobs/${jobId}/apply`, { baseId });
      setShowApplySuccess(true);
      setTimeout(() => setShowApplySuccess(false), 2000);
      refetchApplications();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? '报名失败';
      alert(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setApplyLoading(false);
    }
  };

  const renderHome = () => (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
           <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white">
             <Sprout size={18} />
           </div>
           <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">采摘智工</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-800/50 rounded-full text-slate-400">
            <Search size={20} />
          </div>
        </div>
      </div>

      {/* User Stats Card */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="glass-card p-6 rounded-[32px] bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border-emerald-500/20 shadow-xl shadow-emerald-500/5"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-emerald-500 p-0.5">
                <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-emerald-500 text-2xl font-bold">
                  {user?.name?.[0] ?? '?'}
                </div>
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-2 border-slate-950 flex items-center justify-center">
                <CheckCircle2 size={12} className="text-white" />
              </div>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{user?.name}</h2>
              <p className="text-xs text-slate-400 mt-0.5">编号: {user?.uid}</p>
            </div>
          </div>
          <button 
            onClick={() => setShowQRModal(true)}
            className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white border border-white/10 active:scale-95 transition-all"
          >
            <QrCode size={24} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/5">
          <div className="text-center">
            <p className="text-lg font-bold text-white">{workerStats?.workDays ?? '-'}</p>
            <p className="text-[10px] text-slate-500 font-bold uppercase">已做天数</p>
          </div>
          <div className="text-center border-x border-white/5">
            <p className="text-lg font-bold text-emerald-400">¥{(workerStats?.pendingAmount ?? 0).toLocaleString()}</p>
            <p className="text-[10px] text-slate-500 font-bold uppercase">待收工资</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-white">-</p>
            <p className="text-[10px] text-slate-500 font-bold uppercase">信用评分</p>
          </div>
        </div>
      </motion.div>

      {/* 推荐基地（计划书：浏览基地与岗位） */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">推荐基地</h3>
          <span className="text-xs text-slate-500">根据匹配度推荐</span>
        </div>
        {basesLoading ? (
          <div className="glass-card p-8 rounded-3xl border-slate-800/60 flex items-center justify-center gap-2 text-slate-400">
            <Loader2 className="animate-spin" size={20} />
            加载中…
          </div>
        ) : recommendedBases.length === 0 ? (
          <div className="glass-card p-8 rounded-3xl border-slate-800/60 text-center text-slate-500 text-sm">
            暂无推荐基地，请稍后再看
          </div>
        ) : (
          recommendedBases.map((base: any, idx: number) => (
            <motion.div
              key={base.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="glass-card p-5 rounded-3xl border-slate-800/60"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-bold text-slate-100 text-base">{base.baseName}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-lg">{base.categoryName}</span>
                    <span className="text-[10px] text-slate-500">在招 {base.activeJobsCount} 个岗位</span>
                  </div>
                </div>
                {base.score != null && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">匹配 {base.score}</span>
                )}
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-slate-800/40">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                    <Sprout size={12} />
                  </div>
                  <span className="text-xs text-slate-400">{base.baseName}</span>
                </div>
                <button
                  onClick={() => setSelectedBaseId(base.id)}
                  className="px-5 py-2 bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                >
                  查看岗位
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* 岗位列表抽屉（点击「查看岗位」后展示） */}
      <AnimatePresence>
        {selectedBaseId != null && (
          <div className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedBaseId(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="relative w-full max-w-md max-h-[80vh] glass-card rounded-t-3xl sm:rounded-3xl border border-slate-800 overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-800">
                <h3 className="text-lg font-bold text-white">在招岗位</h3>
                <button onClick={() => setSelectedBaseId(null)} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800">
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {jobsLoading ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-slate-400">
                    <Loader2 className="animate-spin" size={20} />
                    加载岗位…
                  </div>
                ) : (Array.isArray(baseJobs) ? baseJobs : []).length === 0 ? (
                  <p className="text-center text-slate-500 text-sm py-8">该基地暂无在招岗位</p>
                ) : (
                  (Array.isArray(baseJobs) ? baseJobs : []).map((job: any) => (
                    <div key={job.id} className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-slate-100">{job.jobTitle ?? job.title}</h4>
                        <span className="text-xs text-emerald-400 font-bold">{formatJobSalary(job)}</span>
                      </div>
                      {job.workContent && <p className="text-xs text-slate-500 line-clamp-2 mb-3">{job.workContent}</p>}
                      <button
                        disabled={applyLoading || hasAppliedForJob(job.id, selectedBaseId)}
                        onClick={() => handleApply(job.id, selectedBaseId)}
                        className="w-full py-2.5 bg-emerald-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {applyLoading ? <Loader2 className="animate-spin" size={16} /> : null}
                        {hasAppliedForJob(job.id, selectedBaseId) ? (applications.find((a) => a.raw?.jobId === job.id && a.raw?.baseId === selectedBaseId)?.status === 1 ? '已录取' : '已申请') : '立即报名'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );

  const hasAppliedForJob = (jobId: number, baseId: number) =>
    applications.some((a) => a.raw?.jobId === jobId && a.raw?.baseId === baseId && (a.raw?.status === 0 || a.raw?.status === 1));

  const renderApplications = () => (
    <div className="space-y-6 pb-24">
      <h3 className="text-xl font-bold text-white">我的报名进度</h3>
      {applications.length === 0 ? (
        <div className="glass-card p-8 rounded-3xl border-slate-800/60 text-center text-slate-500 text-sm">
          暂无报名记录，去广场看看推荐岗位吧
        </div>
      ) : (
      applications.map((app) => (
        <div key={app.id} className="glass-card p-5 rounded-3xl border-slate-800/60">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h4 className="font-bold text-slate-100">{app.title}</h4>
              <p className="text-xs text-slate-500 mt-1">{app.base}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${
              app.status === '已录取' ? 'bg-emerald-500/10 text-emerald-400' :
              app.status === '已拒绝' || app.status === '已取消' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'
            }`}>
              {app.status}
            </span>
          </div>
          
          {/* Progress Bar */}
          <div className="relative h-1 bg-slate-800 rounded-full mt-6 mb-8">
            <div 
              className="absolute top-0 left-0 h-full bg-emerald-500 rounded-full transition-all duration-1000"
              style={{ width: `${(app.step / 3) * 100}%` }}
            />
            <div className="absolute top-1/2 -translate-y-1/2 w-full flex justify-between px-1">
              {[1, 2, 3].map(s => (
                <div key={s} className={`w-3 h-3 rounded-full border-2 ${app.step >= s ? 'bg-emerald-500 border-emerald-400' : 'bg-slate-900 border-slate-700'}`}></div>
              ))}
            </div>
          </div>
          
          <div className="flex justify-between items-center text-[10px] text-slate-500">
            <span>报名日期: {app.date}</span>
            <button
              onClick={() => setSelectedAppDetail(app.raw)}
              className="flex items-center gap-1 text-emerald-400 font-bold hover:text-emerald-300 transition-colors"
            >
              查看详情 <ChevronRight size={12} />
            </button>
          </div>
        </div>
      ))
      )}

      {/* Salary Confirmation */}
      <div className="mt-8">
        <h3 className="text-lg font-bold text-white mb-4">待发放核对</h3>
        {workerPending.length === 0 ? (
          <div className="glass-card p-8 rounded-3xl border-slate-800/60 text-center text-slate-500 text-sm">
            暂无待确认工资
          </div>
        ) : (
          workerPending.map((item) => (
            <div key={item.id} className="glass-card p-5 rounded-3xl border-amber-500/20 bg-amber-500/5 mb-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
                  <CreditCard size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-100">
                    {item.baseName} · {item.jobTitle}
                  </h4>
                  <p className="text-xs text-slate-500">
                    {item.workDate ? new Date(item.workDate).toLocaleDateString() : '-'}
                    {item.workDuration > 0 ? ` · 共计 ${item.workDuration} 小时` : ''}
                    {item.pieceCount > 0 ? ` · ${item.pieceCount} 件` : ''}
                  </p>
                </div>
              </div>
              <div className="flex justify-between items-center bg-slate-950/50 p-4 rounded-2xl mb-4 border border-slate-800/60">
                <span className="text-slate-400 text-sm">核算总计</span>
                <span className="text-xl font-bold text-emerald-400">¥ {item.totalAmount?.toFixed(2) ?? '0.00'}</span>
              </div>
              <div className="flex gap-3">
                <button className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-400 text-xs font-bold border border-slate-700/50">
                  有疑问
                </button>
                <button
                  disabled={item.status === 1 || (confirmSalaryMutation.isPending && confirmSalaryMutation.variables === item.id)}
                  onClick={() => confirmSalaryMutation.mutate(item.id)}
                  className="flex-2 px-6 py-3 rounded-xl bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {confirmSalaryMutation.isPending && confirmSalaryMutation.variables === item.id ? (
                    <Loader2 className="animate-spin" size={14} />
                  ) : null}
                  {item.status === 1 ? '已确认' : '确认无误'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderProfile = () => (
    <div className="space-y-6 pb-24">
       <div className="flex flex-col items-center py-8">
          <div className="w-24 h-24 rounded-full bg-slate-800 border-4 border-slate-900 shadow-2xl flex items-center justify-center text-3xl font-bold text-emerald-500 mb-4">
            {user?.name?.[0] ?? '?'}
          </div>
          <h2 className="text-xl font-bold text-white">{user?.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">实名采摘工</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-500 border border-slate-700/50">{user?.uid}</span>
          </div>
       </div>
       
       <div className="glass-card rounded-[32px] overflow-hidden divide-y divide-slate-800/40">
          <button
            onClick={() => setShowProfileDetail(true)}
            className="w-full flex items-center justify-between p-5 hover:bg-slate-800/30 active:bg-slate-800 transition-colors text-left"
          >
            <div className="flex items-center gap-4">
              <div className="p-2.5 rounded-2xl bg-slate-900 text-blue-400 border border-slate-800/50">
                <User size={20} />
              </div>
              <span className="text-slate-200 font-medium">基本信息</span>
            </div>
            <div className="flex items-center gap-1 text-slate-500 text-sm">
              {profileData === undefined ? '-' : profileData?.infoAuditStatus === 1 ? '已认证' : profileData?.infoAuditStatus === 0 ? '待审核' : '未认证'}
              <ChevronRight size={16} />
            </div>
          </button>
          <button
            onClick={() => setShowBankCard(true)}
            className="w-full flex items-center justify-between p-5 hover:bg-slate-800/30 active:bg-slate-800 transition-colors text-left"
          >
            <div className="flex items-center gap-4">
              <div className="p-2.5 rounded-2xl bg-slate-900 text-amber-400 border border-slate-800/50">
                <CreditCard size={20} />
              </div>
              <span className="text-slate-200 font-medium">薪资卡号</span>
            </div>
            <div className="flex items-center gap-1 text-slate-500 text-sm">
              未绑定
              <ChevronRight size={16} />
            </div>
          </button>
          <button
            onClick={() => setShowWorkHistory(true)}
            className="w-full flex items-center justify-between p-5 hover:bg-slate-800/30 active:bg-slate-800 transition-colors text-left"
          >
            <div className="flex items-center gap-4">
              <div className="p-2.5 rounded-2xl bg-slate-900 text-purple-400 border border-slate-800/50">
                <History size={20} />
              </div>
              <span className="text-slate-200 font-medium">工作历程</span>
            </div>
            <div className="flex items-center gap-1 text-slate-500 text-sm">
              {workerStats?.workDays ?? 0} 天签到
              <ChevronRight size={16} />
            </div>
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="w-full flex items-center justify-between p-5 hover:bg-slate-800/30 active:bg-slate-800 transition-colors text-left"
          >
            <div className="flex items-center gap-4">
              <div className="p-2.5 rounded-2xl bg-slate-900 text-slate-400 border border-slate-800/50">
                <Star size={20} />
              </div>
              <span className="text-slate-200 font-medium">设置</span>
            </div>
            <div className="flex items-center gap-1 text-slate-500 text-sm">
              <ChevronRight size={16} />
            </div>
          </button>
       </div>

       <button 
        onClick={logout}
        className="w-full py-4 glass-card rounded-2xl flex items-center justify-center gap-3 text-rose-500 font-bold border-rose-500/10 hover:bg-rose-500/5 transition-all active:scale-95"
       >
         <LogOut size={20} />
         退出当前账号
       </button>
    </div>
  );

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#020617] text-slate-100 flex flex-col relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-emerald-500/10 to-transparent pointer-events-none"></div>

      <div className="flex-1 overflow-y-auto p-6 pt-10 custom-scrollbar relative z-10">
        {activeTab === 'home' && renderHome()}
        {activeTab === 'applications' && renderApplications()}
        {activeTab === 'profile' && renderProfile()}
      </div>

      {/* Toast Notification for Success */}
      <AnimatePresence>
        {showApplySuccess && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-6 py-3 rounded-2xl shadow-2xl font-bold flex items-center gap-2 z-[200]"
          >
            <CheckCircle2 size={20} />
            报名成功，待审核！
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Nav Bar */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md h-20 glass border-t border-slate-800/60 flex items-center justify-around px-4 z-50 rounded-t-[32px] shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
        <button 
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'home' ? 'text-emerald-400' : 'text-slate-500'}`}
        >
          <div className={`p-1 rounded-lg ${activeTab === 'home' ? 'bg-emerald-500/10' : ''}`}>
            <Briefcase size={22} />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest">广场</span>
        </button>
        
        <button 
          onClick={() => setActiveTab('applications')}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'applications' ? 'text-emerald-400' : 'text-slate-500'}`}
        >
          <div className={`p-1 rounded-lg ${activeTab === 'applications' ? 'bg-emerald-500/10' : ''}`}>
            <Clock size={22} />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest">我的报名</span>
        </button>

        <div className="relative -top-8 flex flex-col items-center">
          <button 
            onClick={() => setShowQRModal(true)}
            className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-[0_10px_25px_rgba(16,185,129,0.4)] border-4 border-[#020617] active:scale-90 transition-all active:shadow-none"
          >
            <QrCode size={32} />
          </button>
          <span className="text-[10px] font-bold uppercase tracking-widest mt-2 text-slate-500">签到码</span>
        </div>

        <button 
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'profile' ? 'text-emerald-400' : 'text-slate-500'}`}
        >
          <div className={`p-1 rounded-lg ${activeTab === 'profile' ? 'bg-emerald-500/10' : ''}`}>
            <User size={22} />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest">我的</span>
        </button>
      </nav>

      {/* QR Modal */}
      <AnimatePresence>
        {showQRModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
             <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               onClick={() => setShowQRModal(false)}
               className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
             />
             <motion.div 
               initial={{ scale: 0.9, opacity: 0, y: 20 }}
               animate={{ scale: 1, opacity: 1, y: 0 }}
               exit={{ scale: 0.9, opacity: 0, y: 20 }}
               className="w-full max-w-sm glass-card p-10 rounded-[40px] border-emerald-500/30 text-center relative z-10"
             >
                <div className="mb-6 flex flex-col items-center">
                   <div className="w-16 h-16 rounded-3xl bg-emerald-500 flex items-center justify-center text-white shadow-xl shadow-emerald-500/20 mb-4">
                     <QrCode size={32} />
                   </div>
                   <h3 className="text-2xl font-bold text-white">考勤签到码</h3>
                   <p className="text-slate-400 text-sm mt-1">请向现场管理员出示此码</p>
                </div>

                <div className="bg-white p-6 rounded-3xl mb-8 flex items-center justify-center shadow-2xl overflow-hidden min-h-[220px]">
                   {qrLoading ? (
                     <div className="flex items-center gap-2 text-slate-500">
                       <Loader2 className="animate-spin" size={24} />
                       生成中…
                     </div>
                   ) : qrData?.content ? (
                     <QRCodeSVG value={qrData.content} size={220} level="H" />
                   ) : (
                     <span className="text-slate-500 text-sm">加载失败</span>
                   )}
                </div>

                <div className="space-y-2 mb-8 bg-slate-900/50 py-4 rounded-2xl border border-slate-800">
                   <p className="text-emerald-400 font-mono text-2xl font-bold tracking-wider">{user?.uid}</p>
                   <div className="flex items-center justify-center gap-2 text-slate-500 text-[10px] font-medium">
                     <Clock size={12} />
                     <span>{qrData?.validDuration ? `有效期 ${qrData.validDuration}` : '请向现场管理员出示此码'}</span>
                   </div>
                </div>

                <button 
                  onClick={() => setShowQRModal(false)}
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-2xl shadow-xl shadow-emerald-500/20 active:scale-95 transition-all"
                >
                  返回
                </button>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Profile Detail Modal */}
      <AnimatePresence>
        {showProfileDetail && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowProfileDetail(false); setShowProfileEdit(false); }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md max-h-[85vh] glass-card rounded-t-3xl sm:rounded-3xl border border-slate-800 overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-800">
                <h3 className="text-lg font-bold text-white">基本信息</h3>
                <div className="flex items-center gap-2">
                  {!showProfileEdit && profileData && (
                    <button
                      onClick={() => setShowProfileEdit(true)}
                      className="p-2 rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-slate-800"
                    >
                      <Pencil size={18} />
                    </button>
                  )}
                  <button
                    onClick={() => { setShowProfileDetail(false); setShowProfileEdit(false); }}
                    className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-5">
                {profileLoading && !profileData ? (
                  <div className="flex justify-center py-12 gap-2 text-slate-400">
                    <Loader2 className="animate-spin" size={24} />
                    加载中…
                  </div>
                ) : showProfileEdit ? (
                  <ProfileEditForm
                    profile={profileData}
                    onSave={(data) => updateProfileMutation.mutate(data)}
                    onCancel={() => setShowProfileEdit(false)}
                    loading={updateProfileMutation.isPending}
                  />
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-2">
                      <span className="text-slate-500">姓名</span>
                      <span className="text-slate-200 font-medium">{profileData?.name ?? '-'}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-slate-500">工号</span>
                      <span className="text-slate-200 font-mono">{profileData?.uid ?? '-'}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-slate-500">手机号</span>
                      <span className="text-slate-200">{profileData?.phone ? maskPhone(profileData.phone) : '-'}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-slate-500">身份证</span>
                      <span className="text-slate-200">{profileData?.idCard ? maskIdCard(profileData.idCard) : '-'}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-slate-500">紧急联系人</span>
                      <span className="text-slate-200">{profileData?.emergencyContact ?? '-'}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-slate-500">紧急联系人电话</span>
                      <span className="text-slate-200">{profileData?.emergencyPhone ? maskPhone(profileData.emergencyPhone) : '-'}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-slate-500">认证状态</span>
                      <span className={`font-medium ${profileData?.infoAuditStatus === 1 ? 'text-emerald-400' : profileData?.infoAuditStatus === 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                        {profileData?.infoAuditStatus === 1 ? '已认证' : profileData?.infoAuditStatus === 0 ? '待审核' : '未通过'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Work History Modal */}
      <AnimatePresence>
        {showWorkHistory && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowWorkHistory(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md max-h-[85vh] glass-card rounded-t-3xl sm:rounded-3xl border border-slate-800 overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-800">
                <h3 className="text-lg font-bold text-white">工作历程</h3>
                <button onClick={() => setShowWorkHistory(false)} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800">
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {workRecordsLoading ? (
                  <div className="flex justify-center py-12 gap-2 text-slate-400">
                    <Loader2 className="animate-spin" size={24} />
                    加载中…
                  </div>
                ) : workRecords.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-sm">暂无签到记录</div>
                ) : (
                  workRecords.map((r) => (
                    <div key={r.id} className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-slate-100">{r.baseName} · {r.jobTitle}</h4>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                          r.status === 1 ? 'bg-emerald-500/10 text-emerald-400' :
                          r.status === 2 ? 'bg-rose-500/10 text-rose-400' :
                          r.status === 3 ? 'bg-slate-600 text-slate-400' : 'bg-amber-500/10 text-amber-400'
                        }`}>{r.statusText}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Clock size={12} />
                        {r.workDate ? new Date(r.workDate).toLocaleDateString() : '-'}
                        {r.checkinTime && ` · 签到 ${new Date(r.checkinTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bank Card Modal */}
      <AnimatePresence>
        {showBankCard && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBankCard(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm glass-card p-8 rounded-3xl border-slate-800 text-center"
            >
              <div className="p-4 bg-amber-500/10 rounded-2xl mb-6">
                <CreditCard size={48} className="text-amber-400 mx-auto mb-2" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">薪资卡号</h3>
              <p className="text-slate-400 text-sm mb-6">暂未绑定银行卡，该功能即将上线</p>
              <button onClick={() => setShowBankCard(false)} className="w-full py-3 bg-emerald-500 text-white font-bold rounded-xl">
                知道了
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md glass-card rounded-t-3xl sm:rounded-3xl border border-slate-800 overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-800">
                <h3 className="text-lg font-bold text-white">设置</h3>
                <button onClick={() => setShowSettings(false)} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800">
                  <X size={20} />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-400">版本</span>
                  <span className="text-slate-200">v1.0</span>
                </div>
                <button onClick={() => setShowSettings(false)} className="w-full py-3 bg-emerald-500 text-white font-bold rounded-xl">
                  关闭
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Application Detail Modal */}
      <AnimatePresence>
        {selectedAppDetail && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedAppDetail(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md max-h-[85vh] glass-card rounded-t-3xl sm:rounded-3xl border border-slate-800 overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-800">
                <h3 className="text-lg font-bold text-white">报名详情</h3>
                <button
                  onClick={() => setSelectedAppDetail(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                <div>
                  <h4 className="font-bold text-slate-100 text-base">{selectedAppDetail.job?.jobTitle ?? '岗位'}</h4>
                  <p className="text-sm text-slate-400 mt-1 flex items-center gap-1">
                    <MapPin size={14} />
                    {selectedAppDetail.base?.baseName ?? '基地'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    selectedAppDetail.status === 1 ? 'bg-emerald-500/10 text-emerald-400' :
                    selectedAppDetail.status === 2 || selectedAppDetail.status === 3 ? 'bg-rose-500/10 text-rose-400' :
                    'bg-amber-500/10 text-amber-400'
                  }`}>
                    {APPLICATION_STATUS_MAP[selectedAppDetail.status] ?? '审核中'}
                  </span>
                  {selectedAppDetail.job && (
                    <span className="text-emerald-400 text-sm font-bold">{formatJobSalary(selectedAppDetail.job)}</span>
                  )}
                </div>
                {selectedAppDetail.job?.workContent && (
                  <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                    <p className="text-xs text-slate-500 font-bold uppercase mb-2">工作内容</p>
                    <p className="text-sm text-slate-300">{selectedAppDetail.job.workContent}</p>
                  </div>
                )}
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">报名日期</span>
                    <span className="text-slate-200">
                      {selectedAppDetail.createdAt ? new Date(selectedAppDetail.createdAt).toLocaleString() : '-'}
                    </span>
                  </div>
                  {selectedAppDetail.note && (
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-slate-500">申请备注</span>
                      <span className="text-slate-200 text-right">{selectedAppDetail.note}</span>
                    </div>
                  )}
                  {selectedAppDetail.status === 2 && selectedAppDetail.rejectReason && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                      <p className="text-xs text-rose-400 font-bold mb-1">拒绝原因</p>
                      <p className="text-sm text-slate-300">{selectedAppDetail.rejectReason}</p>
                    </div>
                  )}
                  {(selectedAppDetail.status === 1 || selectedAppDetail.status === 2) && selectedAppDetail.reviewedAt && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">审核时间</span>
                      <span className="text-slate-200">
                        {new Date(selectedAppDetail.reviewedAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-4 border-t border-slate-800">
                <button
                  onClick={() => setSelectedAppDetail(null)}
                  className="w-full py-3 bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95"
                >
                  关闭
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
