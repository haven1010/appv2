import React, { useEffect, useState, useCallback } from 'react';
import {
  Sprout,
  Users,
  CalendarCheck,
  Clock,
  Camera,
  RefreshCw,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  UserCheck,
  ArrowRight,
  MapPin,
  Briefcase,
  Phone,
  FileText,
  Target,
  TrendingUp,
  Building2,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { AXIOS_INSTANCE } from '../lib/http';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';

interface BaseInfo {
  id: number;
  baseName: string;
  category: number | string;
  address: string;
  contactPhone: string;
  auditStatus: number;
  regionCode: number;
  description: string;
  ownerId: number;
  createdAt: string;
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
  userId: number;
  workerName: string;
  workerUid: string;
  baseId: number;
  baseName: string;
  jobId: number;
  jobTitle: string;
  workDate: string;
  status: number;
  checkinTime: string | null;
  isProxy: boolean;
}

interface TrendDay {
  date: string;
  label: string;
  checkedIn: number;
  signedUp: number;
}

export default function FieldDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [baseInfo, setBaseInfo] = useState<BaseInfo | null>(null);
  const [baseStats, setBaseStats] = useState<BaseStatistics | null>(null);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [trend, setTrend] = useState<TrendDay[]>([]);

  const today = new Date().toISOString().split('T')[0];

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Step 1: Resolve the field manager's assigned base ID
      // Priority: user context -> profile API -> attendance fallback
      let resolvedBaseId: number | null = (user as any)?.assignedBaseId ? Number((user as any).assignedBaseId) : null;

      if (!resolvedBaseId) {
        // Fetch user profile to get assignedBaseId
        try {
          const profileRes = await AXIOS_INSTANCE.get('/api/user/profile');
          if (profileRes.data?.assignedBaseId) {
            resolvedBaseId = Number(profileRes.data.assignedBaseId);
          }
        } catch { /* ignore */ }
      }

      // Step 2: Fetch attendance data + base info in parallel
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

      const results = await Promise.all(requests);

      setStats(results[0].data);
      setRecords(results[0 + 1].data.records || []);
      setTrend(results[2].data || []);

      if (resolvedBaseId && results.length > 3) {
        if (results[3]?.data) setBaseInfo(results[3].data);
        if (results[4]?.data) setBaseStats(results[4].data);
      }
    } catch (err) {
      console.error('Load field dashboard error:', err);
    } finally {
      setLoading(false);
    }
  }, [today, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getStatusLabel = (status: number) => {
    switch (status) {
      case 0: return '已报名';
      case 1: return '已签到';
      case 2: return '缺勤';
      case 3: return '已取消';
      default: return '未知';
    }
  };

  const getStatusCls = (status: number) => {
    switch (status) {
      case 1: return 'bg-emerald-500/10 text-emerald-400';
      case 2: return 'bg-rose-500/10 text-rose-400';
      case 3: return 'bg-slate-500/10 text-slate-400';
      default: return 'bg-amber-500/10 text-amber-400';
    }
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '-';
    return new Date(timeStr).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  const pendingRecords = records.filter(r => r.status === 0);

  // 可供绑定的基地列表（当未分配或基地不存在时使用）
  const [availableBases, setAvailableBases] = useState<{ id: number; baseName: string }[]>([]);
  const [bindingBaseId, setBindingBaseId] = useState<string>('');
  const [bindLoading, setBindLoading] = useState(false);

  // 加载可用基地
  useEffect(() => {
    if (!loading && !baseInfo) {
      AXIOS_INSTANCE.get('/api/base', { params: { showAll: true } })
        .then((res) => {
          const list = Array.isArray(res.data) ? res.data.filter((b: any) => b.auditStatus === 1) : [];
          setAvailableBases(list);
        })
        .catch(() => {});
    }
  }, [loading, baseInfo]);

  // 绑定基地
  async function handleBindBase() {
    if (!bindingBaseId) return;
    setBindLoading(true);
    try {
      await AXIOS_INSTANCE.patch('/api/user/profile', { assignedBaseId: Number(bindingBaseId) });
      // 更新 localStorage 里的用户信息
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        parsed.assignedBaseId = Number(bindingBaseId);
        localStorage.setItem('user', JSON.stringify(parsed));
      }
      // 刷新页面数据
      window.location.reload();
    } catch (err: any) {
      alert(err?.response?.data?.message || '绑定失败');
    } finally {
      setBindLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-emerald-400" size={32} />
        <span className="ml-3 text-slate-400">正在加载工作台...</span>
      </div>
    );
  }

  // 未找到基地的提示页面
  if (!baseInfo) {
    return (
      <div className="space-y-6 pb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">现场工作台</h2>
          <p className="text-slate-400 text-sm">欢迎回来{user?.name ? `，${user.name}` : ''}</p>
        </div>
        <div className="glass-card rounded-3xl p-8 border border-amber-500/30 bg-amber-500/5">
          <div className="flex flex-col items-center text-center max-w-md mx-auto py-6">
            <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center mb-6">
              <AlertTriangle size={40} className="text-amber-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">尚未关联有效基地</h3>
            <p className="text-slate-400 text-sm mb-6">
              您当前未关联到任何基地，或关联的基地不存在。请从下方选择一个已审核通过的基地进行绑定，或联系超级管理员分配。
            </p>

            {availableBases.length > 0 ? (
              <div className="w-full space-y-4">
                <select
                  value={bindingBaseId}
                  onChange={(e) => setBindingBaseId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  <option value="">请选择要关联的基地</option>
                  {availableBases.map((b) => (
                    <option key={b.id} value={b.id}>{b.baseName} (ID: {b.id})</option>
                  ))}
                </select>
                <button
                  onClick={handleBindBase}
                  disabled={!bindingBaseId || bindLoading}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {bindLoading && <Loader2 className="animate-spin" size={16} />}
                  确认绑定
                </button>
              </div>
            ) : (
              <p className="text-slate-500 text-sm">暂无可用基地。请先让基地管理员创建基地并通过审核。</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">现场工作台</h2>
          <p className="text-slate-400 text-sm">
            欢迎回来{user?.name ? `，${user.name}` : ''}。
            {baseInfo ? ` 当前管理基地：${baseInfo.baseName}` : ' 请先分配关联基地'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700/50 transition-all"
          >
            <RefreshCw size={16} /> 刷新
          </button>
          <button
            onClick={() => navigate('/dashboard/attendance')}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
          >
            <Camera size={18} /> 扫码签到
          </button>
        </div>
      </div>

      {/* Base Info Section */}
      {baseInfo && (
        <div className="glass-card rounded-3xl p-6 border border-slate-800/60 space-y-5">
          {/* Base Header */}
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
              <Sprout size={28} className="text-emerald-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold text-white">{baseInfo.baseName}</h3>
                <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold ${baseInfo.auditStatus === 1 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                  {baseInfo.auditStatus === 1 ? '运营中' : '审核中'}
                </span>
              </div>
              <p className="text-slate-500 text-xs mt-1">基地 ID: #{baseInfo.id}</p>
            </div>
          </div>

          {/* Base Detail Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Basic Info */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">基地信息</p>
              <div className="space-y-2.5">
                {baseInfo.address && (
                  <div className="flex items-start gap-2.5">
                    <MapPin size={15} className="text-slate-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-slate-500">地址</p>
                      <p className="text-sm text-slate-200">{baseInfo.address}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2.5">
                  <Briefcase size={15} className="text-slate-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-500">经营类别</p>
                    <p className="text-sm text-slate-200">
                      {baseInfo.category === 1 || baseInfo.category === 'FRUIT' ? '水果种植' :
                       baseInfo.category === 2 || baseInfo.category === 'VEGETABLE' ? '蔬菜种植' :
                       baseInfo.category === 3 || baseInfo.category === 'OTHER' ? '其他农业' :
                       baseInfo.category || '未分类'}
                    </p>
                  </div>
                </div>
                {baseInfo.contactPhone && (
                  <div className="flex items-start gap-2.5">
                    <Phone size={15} className="text-slate-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-slate-500">联系电话</p>
                      <p className="text-sm text-slate-200">{baseInfo.contactPhone}</p>
                    </div>
                  </div>
                )}
                {baseInfo.createdAt && (
                  <div className="flex items-start gap-2.5">
                    <CalendarCheck size={15} className="text-slate-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-slate-500">入驻时间</p>
                      <p className="text-sm text-slate-200">{baseInfo.createdAt?.slice(0, 10)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Recruitment Stats */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">招聘概况</p>
              {baseStats ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/30">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText size={13} className="text-blue-400" />
                      <span className="text-[10px] text-slate-500 uppercase">岗位总数</span>
                    </div>
                    <p className="text-xl font-bold text-blue-400">{baseStats.statistics.jobs.total}</p>
                    <p className="text-[10px] text-slate-500">{baseStats.statistics.jobs.recruiting} 个招聘中</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/30">
                    <div className="flex items-center gap-2 mb-1">
                      <Target size={13} className="text-emerald-400" />
                      <span className="text-[10px] text-slate-500 uppercase">计划招聘</span>
                    </div>
                    <p className="text-xl font-bold text-emerald-400">{baseStats.statistics.recruitment.target}</p>
                    <p className="text-[10px] text-slate-500">已申请 {baseStats.statistics.recruitment.applied} 人</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/30">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp size={13} className="text-amber-400" />
                      <span className="text-[10px] text-slate-500 uppercase">招聘完成率</span>
                    </div>
                    <p className="text-xl font-bold text-amber-400">{baseStats.statistics.recruitment.completionRate}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/30">
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 size={13} className="text-purple-400" />
                      <span className="text-[10px] text-slate-500 uppercase">岗位状态</span>
                    </div>
                    <p className="text-xl font-bold text-purple-400">{baseStats.statistics.jobs.active}</p>
                    <p className="text-[10px] text-slate-500">活跃岗位</p>
                  </div>
                </div>
              ) : (
                <div className="text-slate-500 text-sm py-4">暂无招聘数据</div>
              )}
            </div>
          </div>

          {/* Base Description */}
          {baseInfo.description && (
            <div className="pt-3 border-t border-slate-800/40">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">基地简介</p>
              <p className="text-sm text-slate-300 leading-relaxed">{baseInfo.description}</p>
            </div>
          )}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5 rounded-2xl border border-slate-800/60">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-emerald-500/10">
              <CheckCircle2 size={20} className="text-emerald-400" />
            </div>
            <span className="text-slate-400 text-sm">已签到</span>
          </div>
          <p className="text-3xl font-bold text-emerald-400">{stats?.checkedIn ?? 0}</p>
          <p className="text-xs text-slate-500 mt-1">今日到岗人数</p>
        </div>
        <div className="glass-card p-5 rounded-2xl border border-slate-800/60">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-amber-500/10">
              <Clock size={20} className="text-amber-400" />
            </div>
            <span className="text-slate-400 text-sm">待签到</span>
          </div>
          <p className="text-3xl font-bold text-amber-400">{stats?.signedUp ?? 0}</p>
          <p className="text-xs text-slate-500 mt-1">已报名未签到</p>
        </div>
        <div className="glass-card p-5 rounded-2xl border border-slate-800/60">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-rose-500/10">
              <XCircle size={20} className="text-rose-400" />
            </div>
            <span className="text-slate-400 text-sm">缺勤</span>
          </div>
          <p className="text-3xl font-bold text-rose-400">{stats?.absent ?? 0}</p>
          <p className="text-xs text-slate-500 mt-1">标记为缺勤</p>
        </div>
        <div className="glass-card p-5 rounded-2xl border border-slate-800/60">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-blue-500/10">
              <UserCheck size={20} className="text-blue-400" />
            </div>
            <span className="text-slate-400 text-sm">到岗率</span>
          </div>
          <p className="text-3xl font-bold text-blue-400">{stats?.attendanceRate ?? 0}%</p>
          <p className="text-xs text-slate-500 mt-1">签到/总报名</p>
        </div>
      </div>

      {/* Alert for pending check-ins */}
      {pendingRecords.length > 0 && (
        <div
          onClick={() => navigate('/dashboard/attendance')}
          className="flex items-center gap-4 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 cursor-pointer hover:bg-amber-500/10 transition-colors"
        >
          <AlertTriangle className="text-amber-400 shrink-0" size={20} />
          <span className="text-amber-300 text-sm font-medium">
            今日还有 {pendingRecords.length} 位工人已报名但未签到，请及时扫码核验
          </span>
          <ArrowRight className="text-amber-400 ml-auto shrink-0" size={16} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Chart */}
        <div className="lg:col-span-2 glass-card p-6 rounded-3xl border border-slate-800/60">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-white">本基地签到趋势</h3>
              <p className="text-sm text-slate-400">近一周签到变化</p>
            </div>
          </div>
          <div className="h-[250px] w-full">
            {trend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="fieldCheckedIn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="fieldSignedUp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="label" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: '12px' }}
                    formatter={(value: number, name: string) => {
                      const label = name === 'checkedIn' ? '签到人数' : name === 'signedUp' ? '报名人数' : name;
                      return [value, label];
                    }}
                  />
                  <Area type="monotone" dataKey="signedUp" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#fieldSignedUp)" />
                  <Area type="monotone" dataKey="checkedIn" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#fieldCheckedIn)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">暂无趋势数据</div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <div className="glass-card p-6 rounded-3xl border border-slate-800/60">
            <h4 className="font-bold text-white mb-4 flex items-center gap-2">
              <CalendarCheck className="text-emerald-400" size={18} />
              快捷操作
            </h4>
            <div className="space-y-3">
              <button
                onClick={() => navigate('/dashboard/attendance')}
                className="w-full flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all text-left group"
              >
                <Camera size={20} className="text-emerald-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">扫码签到</p>
                  <p className="text-xs text-slate-500">扫描工人二维码完成考勤</p>
                </div>
                <ArrowRight size={16} className="text-slate-500 group-hover:text-emerald-400 transition-colors" />
              </button>
              <button
                onClick={() => navigate('/dashboard/field-workers')}
                className="w-full flex items-center gap-3 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-all text-left group"
              >
                <Users size={20} className="text-blue-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">基地人员</p>
                  <p className="text-xs text-slate-500">查看本基地工人名单</p>
                </div>
                <ArrowRight size={16} className="text-slate-500 group-hover:text-blue-400 transition-colors" />
              </button>
            </div>
          </div>

          {/* Today's summary */}
          <div className="glass-card p-6 rounded-3xl border border-slate-800/60">
            <h4 className="font-bold text-white mb-4 flex items-center gap-2">
              <Users className="text-emerald-400" size={18} />
              今日到岗概况
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between py-2">
                <span className="text-slate-400 text-sm">总报名</span>
                <span className="text-white font-bold">{stats?.total ?? 0} 人</span>
              </div>
              <div className="flex justify-between py-2 border-t border-slate-800/40">
                <span className="text-slate-400 text-sm">已签到</span>
                <span className="text-emerald-400 font-bold">{stats?.checkedIn ?? 0} 人</span>
              </div>
              <div className="flex justify-between py-2 border-t border-slate-800/40">
                <span className="text-slate-400 text-sm">待签到</span>
                <span className="text-amber-400 font-bold">{stats?.signedUp ?? 0} 人</span>
              </div>
              <div className="flex justify-between py-2 border-t border-slate-800/40">
                <span className="text-slate-400 text-sm">缺勤</span>
                <span className="text-rose-400 font-bold">{stats?.absent ?? 0} 人</span>
              </div>
              {/* Progress bar */}
              <div className="pt-2">
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-1000"
                    style={{ width: `${stats?.attendanceRate ?? 0}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1 text-right">{stats?.attendanceRate ?? 0}% 到岗率</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Today's Records Table */}
      <div className="glass-card rounded-3xl p-6 border border-slate-800/60">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white">今日签到明细</h3>
          <button
            onClick={() => navigate('/dashboard/attendance')}
            className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
          >
            查看全部 <ArrowRight size={14} />
          </button>
        </div>
        {records.length === 0 ? (
          <div className="text-center py-12 text-slate-500">今日暂无签到记录</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-800/60 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="pb-3 font-semibold px-4">工人</th>
                  <th className="pb-3 font-semibold">工号</th>
                  <th className="pb-3 font-semibold">岗位</th>
                  <th className="pb-3 font-semibold">状态</th>
                  <th className="pb-3 font-semibold">签到时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {records.slice(0, 10).map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-emerald-400 text-sm font-bold">
                          {r.workerName?.[0] || '?'}
                        </div>
                        <span className="text-slate-100 font-medium">{r.workerName}</span>
                      </div>
                    </td>
                    <td className="py-4">
                      <code className="text-xs bg-slate-900 px-2 py-0.5 rounded border border-slate-700/50 text-emerald-400">{r.workerUid}</code>
                    </td>
                    <td className="py-4 text-slate-400 text-sm">{r.jobTitle}</td>
                    <td className="py-4">
                      <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${getStatusCls(r.status)}`}>
                        {getStatusLabel(r.status)}
                      </span>
                    </td>
                    <td className="py-4 text-slate-400 text-sm">{formatTime(r.checkinTime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {records.length > 10 && (
              <div className="text-center py-3 border-t border-slate-800/40">
                <button
                  onClick={() => navigate('/dashboard/attendance')}
                  className="text-sm text-emerald-400 hover:text-emerald-300"
                >
                  查看全部 {records.length} 条记录
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
