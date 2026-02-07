import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  X,
  Eye,
  Sprout,
  RefreshCw,
  UserCheck,
  CalendarCheck,
  Phone,
  CreditCard,
  Filter,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AXIOS_INSTANCE } from '../lib/http';
import { useAuth } from '../App';

interface WorkerApplication {
  id: number;
  userId: number;
  jobId: number;
  baseId: number;
  status: number; // 0=pending, 1=approved, 2=rejected, 3=cancelled
  note: string | null;
  createdAt: string;
  user: {
    id: number;
    uid: string;
    name: string;
    phone: string;
    idCard: string;
    emergencyContact: string;
    emergencyPhone: string;
    infoAuditStatus: number;
  };
  job: {
    id: number;
    jobTitle: string;
    payType: number;
    hourlyRate: number;
    salaryAmount: number;
    unitPrice: number;
  };
  base: {
    id: number;
    baseName: string;
  };
}

interface AttendanceRecord {
  id: number;
  userId: number;
  workerName: string;
  workerUid: string;
  status: number;
  checkinTime: string | null;
}

const APP_STATUS_LABEL: Record<number, string> = {
  0: '待审核',
  1: '已录取',
  2: '已拒绝',
  3: '已取消',
};

const APP_STATUS_CLS: Record<number, string> = {
  0: 'bg-amber-500/10 text-amber-400',
  1: 'bg-emerald-500/10 text-emerald-400',
  2: 'bg-rose-500/10 text-rose-400',
  3: 'bg-slate-500/10 text-slate-400',
};

export default function FieldWorkers() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<WorkerApplication[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('1'); // default: show approved
  const [searchInput, setSearchInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [detailApp, setDetailApp] = useState<WorkerApplication | null>(null);
  const [baseId, setBaseId] = useState<number | null>(
    (user as any)?.assignedBaseId ? Number((user as any).assignedBaseId) : null
  );

  const today = new Date().toISOString().split('T')[0];

  // Find field manager's base ID (fallback: profile API -> attendance API)
  useEffect(() => {
    if (baseId) return; // already resolved
    // Try profile API first
    AXIOS_INSTANCE.get('/api/user/profile')
      .then((res) => {
        if (res.data?.assignedBaseId) {
          setBaseId(Number(res.data.assignedBaseId));
          return;
        }
        // Fallback to attendance bases
        return AXIOS_INSTANCE.get('/api/attendance/bases', { params: { date: today } })
          .then((basesRes) => {
            const bases = basesRes.data.bases || [];
            if (bases.length > 0) setBaseId(bases[0].baseId);
          });
      })
      .catch(() => {});
  }, [today, baseId]);

  const loadData = useCallback(async () => {
    if (!baseId) return;
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter !== '') params.status = statusFilter;

      const [appsRes, attendanceRes] = await Promise.all([
        AXIOS_INSTANCE.get(`/api/base/${baseId}/applications`, { params }),
        AXIOS_INSTANCE.get('/api/attendance/records', { params: { date: today } }),
      ]);

      setApplications(Array.isArray(appsRes.data) ? appsRes.data : []);
      setTodayAttendance(attendanceRes.data.records || []);
    } catch (err) {
      console.error('Load field workers error:', err);
    } finally {
      setLoading(false);
    }
  }, [baseId, statusFilter, today]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleSearch() {
    setKeyword(searchInput);
  }

  // Filter applications by keyword
  const filtered = applications.filter((app) => {
    if (!keyword) return true;
    const kw = keyword.toLowerCase();
    return (
      app.user?.name?.toLowerCase().includes(kw) ||
      app.user?.uid?.toLowerCase().includes(kw) ||
      app.job?.jobTitle?.toLowerCase().includes(kw)
    );
  });

  // Get today's attendance status for a user
  function getAttendanceStatus(userId: number): { status: number; checkinTime: string | null } | null {
    const record = todayAttendance.find((r) => r.userId === userId);
    if (!record) return null;
    return { status: record.status, checkinTime: record.checkinTime };
  }

  function getAttendanceLabel(attendance: { status: number } | null): string {
    if (!attendance) return '今日未报名';
    switch (attendance.status) {
      case 0: return '已报名';
      case 1: return '已签到';
      case 2: return '缺勤';
      default: return '-';
    }
  }

  function getAttendanceCls(attendance: { status: number } | null): string {
    if (!attendance) return 'bg-slate-500/10 text-slate-400';
    switch (attendance.status) {
      case 0: return 'bg-amber-500/10 text-amber-400';
      case 1: return 'bg-emerald-500/10 text-emerald-400';
      case 2: return 'bg-rose-500/10 text-rose-400';
      default: return 'bg-slate-500/10 text-slate-400';
    }
  }

  function formatTime(timeStr: string | null): string {
    if (!timeStr) return '-';
    return new Date(timeStr).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }

  function maskIdCard(id: string): string {
    if (!id || id.length < 10) return id || '';
    return id.slice(0, 6) + '********' + id.slice(-4);
  }

  function maskPhone(phone: string): string {
    if (!phone || phone.length < 7) return phone || '';
    return phone.slice(0, 3) + '****' + phone.slice(-4);
  }

  function formatSalary(job: any): string {
    if (!job) return '-';
    switch (job.payType) {
      case 1: return job.salaryAmount ? `¥${job.salaryAmount}/天` : '固定';
      case 2: return job.hourlyRate ? `¥${job.hourlyRate}/时` : '时薪';
      case 3: return job.unitPrice ? `¥${job.unitPrice}/件` : '计件';
      default: return '面议';
    }
  }

  // Stats
  const approvedCount = applications.filter((a) => a.status === 1).length;
  const pendingCount = applications.filter((a) => a.status === 0).length;
  const todayCheckedIn = todayAttendance.filter((r) => r.status === 1).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">基地人员</h2>
          <p className="text-slate-400 text-sm">
            管理本基地的工人名单，查看录取状态和今日考勤。
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700/50 transition-all disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> 刷新
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card p-5 rounded-2xl border border-slate-800/60">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-emerald-500/10">
              <UserCheck size={18} className="text-emerald-400" />
            </div>
            <span className="text-slate-400 text-sm">已录取</span>
          </div>
          <p className="text-2xl font-bold text-emerald-400">{approvedCount}</p>
        </div>
        <div className="glass-card p-5 rounded-2xl border border-slate-800/60">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-amber-500/10">
              <Clock size={18} className="text-amber-400" />
            </div>
            <span className="text-slate-400 text-sm">待审核</span>
          </div>
          <p className="text-2xl font-bold text-amber-400">{pendingCount}</p>
        </div>
        <div className="glass-card p-5 rounded-2xl border border-slate-800/60">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-blue-500/10">
              <CalendarCheck size={18} className="text-blue-400" />
            </div>
            <span className="text-slate-400 text-sm">今日到岗</span>
          </div>
          <p className="text-2xl font-bold text-blue-400">{todayCheckedIn}</p>
        </div>
      </div>

      {/* Filter + Search */}
      <div className="glass-card rounded-3xl p-6 border border-slate-800/60">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              type="text"
              placeholder="搜索姓名、工号或岗位..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
              className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSearch}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-xl text-slate-300 text-sm border border-slate-700/50 hover:bg-slate-700"
            >
              <Filter size={16} /> 搜索
            </button>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700/50 rounded-xl px-4 py-2 text-sm text-slate-300 focus:outline-none"
            >
              <option value="">全部状态</option>
              <option value="1">已录取</option>
              <option value="0">待审核</option>
              <option value="2">已拒绝</option>
            </select>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-emerald-400" size={24} />
            <span className="ml-2 text-slate-400">加载中...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            {baseId ? '暂无符合条件的人员记录' : '未找到关联基地，请联系管理员分配'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-800/60 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="pb-4 font-semibold px-4">工人</th>
                  <th className="pb-4 font-semibold">工号</th>
                  <th className="pb-4 font-semibold">申请岗位</th>
                  <th className="pb-4 font-semibold">薪资</th>
                  <th className="pb-4 font-semibold">录取状态</th>
                  <th className="pb-4 font-semibold">今日考勤</th>
                  <th className="pb-4 font-semibold">申请时间</th>
                  <th className="pb-4 font-semibold text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {filtered.map((app) => {
                  const attendance = getAttendanceStatus(app.userId);
                  return (
                    <tr key={app.id} className="hover:bg-slate-800/20 transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 text-sm font-bold">
                            {app.user?.name?.[0] || '?'}
                          </div>
                          <div>
                            <p className="text-slate-100 font-medium text-sm">{app.user?.name || '-'}</p>
                            <p className="text-slate-500 text-xs">{maskPhone(app.user?.phone || '')}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4">
                        <code className="text-xs bg-slate-900 px-2 py-0.5 rounded border border-slate-700/50 text-emerald-400">
                          {app.user?.uid || '-'}
                        </code>
                      </td>
                      <td className="py-4 text-slate-300 text-sm">{app.job?.jobTitle || '-'}</td>
                      <td className="py-4 text-emerald-400 text-sm font-medium">{formatSalary(app.job)}</td>
                      <td className="py-4">
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${APP_STATUS_CLS[app.status] || 'bg-slate-500/10 text-slate-400'}`}>
                          {APP_STATUS_LABEL[app.status] || '-'}
                        </span>
                      </td>
                      <td className="py-4">
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${getAttendanceCls(attendance)}`}>
                          {getAttendanceLabel(attendance)}
                        </span>
                        {attendance?.checkinTime && attendance.status === 1 && (
                          <span className="text-slate-500 text-xs ml-1">{formatTime(attendance.checkinTime)}</span>
                        )}
                      </td>
                      <td className="py-4 text-slate-500 text-sm">{app.createdAt?.slice(0, 10)}</td>
                      <td className="py-4 text-right px-4">
                        <button
                          onClick={() => setDetailApp(app)}
                          className="p-2 text-slate-500 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-all"
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-slate-800/40 text-sm text-slate-500">
          共 {filtered.length} 条记录
        </div>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {detailApp && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDetailApp(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl relative z-10 overflow-hidden max-h-[85vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-slate-800 flex justify-between items-center sticky top-0 bg-slate-900 z-10">
                <h3 className="text-lg font-bold text-white">工人详情</h3>
                <button onClick={() => setDetailApp(null)} className="text-slate-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-5">
                {/* Header */}
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 text-xl font-bold">
                    {detailApp.user?.name?.[0] || '?'}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-white font-bold text-lg">{detailApp.user?.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${APP_STATUS_CLS[detailApp.status]}`}>
                        {APP_STATUS_LABEL[detailApp.status]}
                      </span>
                      {(() => {
                        const att = getAttendanceStatus(detailApp.userId);
                        return (
                          <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${getAttendanceCls(att)}`}>
                            {getAttendanceLabel(att)}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Basic Info */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">基本信息</p>
                  {[
                    { label: '工号 (UID)', value: detailApp.user?.uid, icon: CreditCard },
                    { label: '手机号', value: detailApp.user?.phone, icon: Phone },
                    { label: '身份证号', value: maskIdCard(detailApp.user?.idCard || ''), icon: CreditCard },
                    { label: '紧急联系人', value: detailApp.user?.emergencyContact || '-', icon: Users },
                    { label: '紧急联系电话', value: detailApp.user?.emergencyPhone || '-', icon: Phone },
                  ].map((item, i) => (
                    <div key={i} className="flex justify-between py-2 border-b border-slate-800/40">
                      <span className="text-slate-400 text-sm flex items-center gap-1.5">
                        <item.icon size={12} className="text-slate-500" />{item.label}
                      </span>
                      <span className="text-slate-100 text-sm font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>

                {/* Job Info */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">岗位信息</p>
                  <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
                    <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium mb-2">
                      <Sprout size={16} /> {detailApp.base?.baseName}
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">岗位名称</span>
                        <span className="text-white font-medium">{detailApp.job?.jobTitle}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">薪资标准</span>
                        <span className="text-emerald-400 font-medium">{formatSalary(detailApp.job)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">申请时间</span>
                        <span className="text-slate-300">{detailApp.createdAt?.slice(0, 10)}</span>
                      </div>
                      {detailApp.note && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">申请备注</span>
                          <span className="text-slate-300">{detailApp.note}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Today's attendance */}
                {(() => {
                  const att = getAttendanceStatus(detailApp.userId);
                  if (!att) return null;
                  return (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">今日考勤</p>
                      <div className={`p-4 rounded-2xl border ${att.status === 1 ? 'bg-emerald-500/5 border-emerald-500/20' : att.status === 2 ? 'bg-rose-500/5 border-rose-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
                        <div className="flex items-center gap-3">
                          {att.status === 1 ? <CheckCircle2 size={20} className="text-emerald-400" /> :
                           att.status === 2 ? <XCircle size={20} className="text-rose-400" /> :
                           <Clock size={20} className="text-amber-400" />}
                          <div>
                            <p className="text-sm font-medium text-white">{getAttendanceLabel(att)}</p>
                            {att.checkinTime && att.status === 1 && (
                              <p className="text-xs text-slate-400">签到时间：{formatTime(att.checkinTime)}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
