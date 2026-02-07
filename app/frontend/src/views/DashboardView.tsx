
import React, { useEffect, useState } from 'react';
import { 
  Users, 
  Sprout, 
  CircleDollarSign, 
  CalendarCheck, 
  Clock,
  ExternalLink,
  ArrowUpRight,
  Loader2,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import { AXIOS_INSTANCE } from '../lib/http';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { UserRole, isSuperAdminRole } from '../types';

interface DashboardStats {
  totalWorkers: number;
  totalBases: number;
  allBases: number;
  todayCheckedIn: number;
  todaySignedUp: number;
  monthlyPaid: number;
  monthlyPending: number;
  monthlyTotal: number;
  pendingAuditUsers: number;
  pendingAuditBases: number;
}

interface TrendDay {
  date: string;
  label: string;
  checkedIn: number;
  signedUp: number;
  salary: number;
}

interface CategoryItem {
  name: string;
  value: number;
  count: number;
  color: string;
}

interface RecentBase {
  id: number;
  name: string;
  category: string;
  regionCode: number;
  address: string;
  auditStatus: number;
  auditStatusText: string;
  createdAt: string;
}

export default function DashboardView() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role as string;
  const isGlobal = isSuperAdminRole(role);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trend, setTrend] = useState<TrendDay[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [recentBases, setRecentBases] = useState<RecentBase[]>([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    try {
      const [statsRes, trendRes, catRes, basesRes] = await Promise.all([
        AXIOS_INSTANCE.get('/api/dashboard/stats'),
        AXIOS_INSTANCE.get('/api/dashboard/trend'),
        AXIOS_INSTANCE.get('/api/dashboard/category'),
        AXIOS_INSTANCE.get('/api/dashboard/recent-bases'),
      ]);
      setStats(statsRes.data);
      setTrend(trendRes.data);
      setCategories(catRes.data);
      setRecentBases(basesRes.data);
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  }

  function formatMoney(val: number): string {
    if (val >= 10000) return `¥${(val / 10000).toFixed(1)}万`;
    if (val >= 1000) return `¥${(val / 1000).toFixed(1)}k`;
    return `¥${val}`;
  }

  function formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    return dateStr.slice(0, 10);
  }

  const statCards = stats ? [
    { label: '活跃工人', value: stats.totalWorkers.toLocaleString(), sub: `${stats.pendingAuditUsers} 人待审核`, icon: Users, color: 'blue' },
    { label: '合作基地', value: stats.totalBases.toString(), sub: `共 ${stats.allBases} 个基地`, icon: Sprout, color: 'emerald' },
    { label: '本月工资总额', value: formatMoney(stats.monthlyTotal), sub: `已发 ${formatMoney(stats.monthlyPaid)}`, icon: CircleDollarSign, color: 'orange' },
    { label: '今日签到', value: stats.todayCheckedIn.toString(), sub: `报名 ${stats.todaySignedUp} 人`, icon: CalendarCheck, color: 'purple' },
  ] : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-emerald-400" size={32} />
        <span className="ml-3 text-slate-400">正在加载数据...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-8">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">
          {isGlobal ? '全局概览' : role === UserRole.BASE_MANAGER ? '基地概览' : '工作概览'}
        </h2>
        <p className="text-slate-400">
          欢迎回来{user?.name ? `，${user.name}` : ''}，这是{isGlobal ? '系统的' : '您负责范围内的'}实时运行状态。
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, idx) => (
          <div key={idx} className="glass-card p-6 rounded-3xl relative overflow-hidden group">
            <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 bg-${stat.color}-500/10 rounded-full blur-3xl group-hover:bg-${stat.color}-500/20 transition-all`}></div>
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-2xl bg-slate-900/80 border border-slate-700/50 shadow-inner group-hover:border-${stat.color}-500/50 transition-colors`}>
                <stat.icon className={`text-${stat.color}-400`} size={24} />
              </div>
              <div className="flex items-center gap-1 text-sm font-medium text-slate-400">
                {stat.sub}
              </div>
            </div>
            <div>
              <p className="text-slate-400 text-sm mb-1">{stat.label}</p>
              <h3 className="text-3xl font-bold text-white tracking-tight">{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* Alert Cards */}
      {stats && (stats.pendingAuditUsers > 0 || stats.pendingAuditBases > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stats.pendingAuditUsers > 0 && (
            <div
              onClick={() => navigate(isGlobal ? '/dashboard/audit' : '/dashboard/workers')}
              className="flex items-center gap-4 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 cursor-pointer hover:bg-amber-500/10 transition-colors"
            >
              <AlertTriangle className="text-amber-400 shrink-0" size={20} />
              <span className="text-amber-300 text-sm font-medium">
                有 {stats.pendingAuditUsers} 位用户信息待审核
              </span>
              <ArrowUpRight className="text-amber-400 ml-auto shrink-0" size={16} />
            </div>
          )}
          {stats.pendingAuditBases > 0 && (
            <div
              onClick={() => navigate(isGlobal ? '/dashboard/audit' : '/dashboard/bases')}
              className="flex items-center gap-4 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 cursor-pointer hover:bg-blue-500/10 transition-colors"
            >
              <ShieldCheck className="text-blue-400 shrink-0" size={20} />
              <span className="text-blue-300 text-sm font-medium">
                有 {stats.pendingAuditBases} 个基地待审核入驻
              </span>
              <ArrowUpRight className="text-blue-400 ml-auto shrink-0" size={16} />
            </div>
          )}
        </div>
      )}

      {/* Charts */}
      <div className={`grid grid-cols-1 ${isGlobal || role === UserRole.BASE_MANAGER ? 'lg:grid-cols-3' : ''} gap-6`}>
        <div className={`${isGlobal || role === UserRole.BASE_MANAGER ? 'lg:col-span-2' : ''} glass-card p-8 rounded-3xl border border-slate-800/60`}>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-bold text-white mb-1">签到趋势分析</h3>
              <p className="text-sm text-slate-400">过去一周的签到人数变化</p>
            </div>
          </div>
          <div className="h-[300px] w-full">
            {trend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="colorCheckedIn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorSignedUp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
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
                  <Area type="monotone" dataKey="signedUp" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorSignedUp)" />
                  <Area type="monotone" dataKey="checkedIn" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorCheckedIn)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">暂无趋势数据</div>
            )}
          </div>
        </div>

        {(isGlobal || role === UserRole.BASE_MANAGER) && <div className="glass-card p-8 rounded-3xl border border-slate-800/60 flex flex-col">
          <h3 className="text-lg font-bold text-white mb-1">基地类型占比</h3>
          <p className="text-sm text-slate-400 mb-8">当前入驻基地的行业分布状况</p>
          <div className="flex-1 min-h-[250px]">
            {categories.length > 0 && categories.some(c => c.count > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categories} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#1e293b" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={12} width={60} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                    formatter={(value: number) => [`${value}%`, '占比']}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                    {categories.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">暂无基地数据</div>
            )}
          </div>
          <div className="mt-4 space-y-2">
            {categories.map((item, i) => (
              <div key={i} className="flex justify-between items-center text-sm">
                <span className="flex items-center gap-2 text-slate-400">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></span>
                  {item.name}
                </span>
                <span className="text-slate-100 font-medium">{item.count} 个 ({item.value}%)</span>
              </div>
            ))}
          </div>
        </div>}
      </div>

      {/* Recent Bases Table - only for SUPER_ADMIN and BASE_MANAGER */}
      {(isGlobal || role === UserRole.BASE_MANAGER) && <div className="glass-card p-8 rounded-3xl border border-slate-800/60 overflow-hidden">
        <div className="flex items-center justify-between mb-8">
           <div className="flex items-center gap-3">
             <div className="p-2 rounded-lg bg-orange-500/10 text-orange-400">
               <Clock size={20} />
             </div>
             <h3 className="text-lg font-bold text-white">最新入驻基地</h3>
           </div>
           <button
             onClick={() => navigate('/dashboard/bases')}
             className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
           >
             全部基地 <ExternalLink size={14} />
           </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-800/60 text-slate-500 text-xs uppercase tracking-wider">
                <th className="pb-4 font-semibold">基地名称</th>
                <th className="pb-4 font-semibold">经营类别</th>
                <th className="pb-4 font-semibold">地址</th>
                <th className="pb-4 font-semibold">审核状态</th>
                <th className="pb-4 font-semibold">入驻时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {recentBases.length > 0 ? recentBases.map((row) => (
                <tr key={row.id} className="group hover:bg-slate-800/30 transition-colors">
                  <td className="py-5 font-medium text-slate-100">{row.name}</td>
                  <td className="py-5 text-slate-400 text-sm">{row.category}</td>
                  <td className="py-5 text-slate-400 text-sm">{row.address}</td>
                  <td className="py-5">
                    <span className={`flex items-center gap-1.5 text-sm ${row.auditStatus === 1 ? 'text-emerald-400' : row.auditStatus === 0 ? 'text-amber-400' : 'text-rose-400'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${row.auditStatus === 1 ? 'bg-emerald-500' : row.auditStatus === 0 ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'}`}></span>
                      {row.auditStatusText}
                    </span>
                  </td>
                  <td className="py-5 text-slate-500 text-sm">{formatDate(row.createdAt)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">暂无入驻基地</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>}
    </div>
  );
}
