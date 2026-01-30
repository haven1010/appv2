
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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

const APPLICATION_STATUS_MAP: Record<number, string> = {
  0: '审核中',
  1: '已录取',
  2: '已拒绝',
  3: '已取消',
};

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
  const [activeTab, setActiveTab] = useState('home');
  const [showQRModal, setShowQRModal] = useState(false);
  const [showApplySuccess, setShowApplySuccess] = useState(false);
  const [selectedBaseId, setSelectedBaseId] = useState<number | null>(null);
  const [applyLoading, setApplyLoading] = useState(false);

  const { data: recommendedBases = [], isLoading: basesLoading } = useRecommendationControllerGetRecommendedBases();
  const { data: baseJobs = [], isLoading: jobsLoading } = useBaseControllerGetJobsByBase(selectedBaseId ?? 0, {
    query: { enabled: !!selectedBaseId },
  });

  const { data: myApplicationsRaw = [], refetch: refetchApplications } = useQuery({
    queryKey: ['worker', 'myApplications'],
    queryFn: async () => {
      const res = await AXIOS_INSTANCE.get<unknown[]>('/api/base/applications/me');
      return Array.isArray(res) ? res : [];
    },
  });

  const applications = myApplicationsRaw.map((app: any) => ({
    id: app.id,
    title: app.job?.jobTitle ?? '岗位',
    base: app.base?.baseName ?? '基地',
    status: APPLICATION_STATUS_MAP[app.status] ?? '审核中',
    step: app.status === 1 ? 3 : app.status === 2 ? 0 : 1,
    date: app.createdAt ? new Date(app.createdAt).toLocaleDateString() : '',
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
                  {user?.name[0]}
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
            <p className="text-lg font-bold text-white">12</p>
            <p className="text-[10px] text-slate-500 font-bold uppercase">已做天数</p>
          </div>
          <div className="text-center border-x border-white/5">
            <p className="text-lg font-bold text-emerald-400">¥2,480</p>
            <p className="text-[10px] text-slate-500 font-bold uppercase">待收工资</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-white">4.9</p>
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
                        disabled={applyLoading}
                        onClick={() => handleApply(job.id, selectedBaseId)}
                        className="w-full py-2.5 bg-emerald-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {applyLoading ? <Loader2 className="animate-spin" size={16} /> : null}
                        立即报名
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

  const renderApplications = () => (
    <div className="space-y-6 pb-24">
      <h3 className="text-xl font-bold text-white">我的报名进度</h3>
      {applications.map((app, idx) => (
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
            <button className="flex items-center gap-1 text-emerald-400 font-bold">
              查看详情 <ChevronRight size={12} />
            </button>
          </div>
        </div>
      ))}

      {/* Salary Confirmation */}
      <div className="mt-8">
        <h3 className="text-lg font-bold text-white mb-4">待发放核对</h3>
        <div className="glass-card p-5 rounded-3xl border-amber-500/20 bg-amber-500/5">
           <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
                <CreditCard size={20} />
              </div>
              <div>
                <h4 className="font-bold text-slate-100">2024年3月第二周结算</h4>
                <p className="text-xs text-slate-500">共计 42.5 小时</p>
              </div>
           </div>
           <div className="flex justify-between items-center bg-slate-950/50 p-4 rounded-2xl mb-4 border border-slate-800/60">
              <span className="text-slate-400 text-sm">核算总计</span>
              <span className="text-xl font-bold text-emerald-400">¥ 850.00</span>
           </div>
           <div className="flex gap-3">
             <button className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-400 text-xs font-bold border border-slate-700/50">有疑问</button>
             <button className="flex-2 px-6 py-3 rounded-xl bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/20">确认无误</button>
           </div>
        </div>
      </div>
    </div>
  );

  const renderProfile = () => (
    <div className="space-y-6 pb-24">
       <div className="flex flex-col items-center py-8">
          <div className="w-24 h-24 rounded-full bg-slate-800 border-4 border-slate-900 shadow-2xl flex items-center justify-center text-3xl font-bold text-emerald-500 mb-4">
            {user?.name[0]}
          </div>
          <h2 className="text-xl font-bold text-white">{user?.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">实名采摘工</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-500 border border-slate-700/50">{user?.uid}</span>
          </div>
       </div>
       
       <div className="glass-card rounded-[32px] overflow-hidden divide-y divide-slate-800/40">
          {[
            { label: '基本信息', icon: User, value: '已认证', color: 'text-blue-400' },
            { label: '薪资卡号', icon: CreditCard, value: '6222 *** 102', color: 'text-amber-400' },
            { label: '工作历程', icon: History, value: '15条记录', color: 'text-purple-400' },
            { label: '设置', icon: Star, value: '', color: 'text-slate-400' },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between p-5 hover:bg-slate-800/30 active:bg-slate-800 transition-colors">
              <div className="flex items-center gap-4">
                <div className={`p-2.5 rounded-2xl bg-slate-900 ${item.color} border border-slate-800/50`}>
                  <item.icon size={20} />
                </div>
                <span className="text-slate-200 font-medium">{item.label}</span>
              </div>
              <div className="flex items-center gap-1 text-slate-500 text-sm">
                {item.value}
                <ChevronRight size={16} />
              </div>
            </div>
          ))}
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

                <div className="bg-white p-6 rounded-3xl mb-8 flex items-center justify-center shadow-2xl overflow-hidden">
                   <QRCodeSVG 
                    value={JSON.stringify({uid: user?.uid, name: user?.name, timestamp: Date.now()})} 
                    size={220}
                    level="H"
                   />
                </div>

                <div className="space-y-2 mb-8 bg-slate-900/50 py-4 rounded-2xl border border-slate-800">
                   <p className="text-emerald-400 font-mono text-2xl font-bold tracking-wider">{user?.uid}</p>
                   <div className="flex items-center justify-center gap-2 text-slate-500 text-[10px] font-medium">
                     <Clock size={12} />
                     <span>有效期至 {new Date(Date.now() + 15*60000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
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
    </div>
  );
}
