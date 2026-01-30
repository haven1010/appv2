
import React from 'react';
import { 
  Users, 
  Sprout, 
  CircleDollarSign, 
  CalendarCheck, 
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  ExternalLink
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, Cell
} from 'recharts';

const stats = [
  { label: '活跃工人', value: '1,284', trend: '+12.5%', isUp: true, icon: Users, color: 'blue' },
  { label: '合作基地', value: '42', trend: '+3', isUp: true, icon: Sprout, color: 'emerald' },
  { label: '本月发放工资', value: '¥248k', trend: '-2.1%', isUp: false, icon: CircleDollarSign, color: 'orange' },
  { label: '今日签到', value: '856', trend: '+18.2%', isUp: true, icon: CalendarCheck, color: 'purple' },
];

const data = [
  { name: 'Mon', count: 400, wage: 2400 },
  { name: 'Tue', count: 300, wage: 1398 },
  { name: 'Wed', count: 200, wage: 9800 },
  { name: 'Thu', count: 278, wage: 3908 },
  { name: 'Fri', count: 189, wage: 4800 },
  { name: 'Sat', count: 239, wage: 3800 },
  { name: 'Sun', count: 349, wage: 4300 },
];

const categoryData = [
  { name: '水果类', value: 45, color: '#10b981' },
  { name: '蔬菜类', value: 30, color: '#3b82f6' },
  { name: '药材类', value: 15, color: '#f59e0b' },
  { name: '其他', value: 10, color: '#6366f1' },
];

export default function DashboardView() {
  return (
    <div className="space-y-8 pb-8">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">数据概览</h2>
        <p className="text-slate-400">欢迎回来，这是系统的实时运行状态。</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <div key={idx} className="glass-card p-6 rounded-3xl relative overflow-hidden group">
            <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 bg-${stat.color}-500/10 rounded-full blur-3xl group-hover:bg-${stat.color}-500/20 transition-all`}></div>
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-2xl bg-slate-900/80 border border-slate-700/50 shadow-inner group-hover:border-${stat.color}-500/50 transition-colors`}>
                <stat.icon className={`text-${stat.color}-400`} size={24} />
              </div>
              <div className={`flex items-center gap-1 text-sm font-medium ${stat.isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                {stat.trend}
                {stat.isUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              </div>
            </div>
            <div>
              <p className="text-slate-400 text-sm mb-1">{stat.label}</p>
              <h3 className="text-3xl font-bold text-white tracking-tight">{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card p-8 rounded-3xl border border-slate-800/60">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-bold text-white mb-1">采摘趋势分析</h3>
              <p className="text-sm text-slate-400">过去一周的用工人数与成本波动</p>
            </div>
            <select className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none">
              <option>最近7天</option>
              <option>最近30天</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: '12px' }}
                  itemStyle={{ color: '#10b981' }}
                />
                <Area type="monotone" dataKey="count" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-8 rounded-3xl border border-slate-800/60 flex flex-col">
          <h3 className="text-lg font-bold text-white mb-1">基地类型占比</h3>
          <p className="text-sm text-slate-400 mb-8">当前入驻基地的行业分布状况</p>
          <div className="flex-1 min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#1e293b" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={12} width={60} />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {categoryData.map((item, i) => (
              <div key={i} className="flex justify-between items-center text-sm">
                <span className="flex items-center gap-2 text-slate-400">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></span>
                  {item.name}
                </span>
                <span className="text-slate-100 font-medium">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="glass-card p-8 rounded-3xl border border-slate-800/60 overflow-hidden">
        <div className="flex items-center justify-between mb-8">
           <div className="flex items-center gap-3">
             <div className="p-2 rounded-lg bg-orange-500/10 text-orange-400">
               <Clock size={20} />
             </div>
             <h3 className="text-lg font-bold text-white">最新入驻基地</h3>
           </div>
           <button className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors">
             全部基地 <ExternalLink size={14} />
           </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-800/60 text-slate-500 text-xs uppercase tracking-wider">
                <th className="pb-4 font-semibold">基地名称</th>
                <th className="pb-4 font-semibold">经营类别</th>
                <th className="pb-4 font-semibold">所在地区</th>
                <th className="pb-4 font-semibold">招聘状态</th>
                <th className="pb-4 font-semibold">审核状态</th>
                <th className="pb-4 font-semibold">入驻时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {[
                { name: '红旗生态农场', cat: '水果类', region: '安徽/宿州', job: '正在招聘', status: '已通过', date: '2024-03-20' },
                { name: '阳光绿洲基地', cat: '蔬菜类', region: '山东/寿光', job: '暂不招聘', status: '待审核', date: '2024-03-21' },
                { name: '秦岭蓝莓园', cat: '水果类', region: '陕西/商洛', job: '正在招聘', status: '已通过', date: '2024-03-19' },
                { name: '江心洲葡萄基地', cat: '水果类', region: '江苏/南京', job: '正在招聘', status: '已通过', date: '2024-03-18' },
              ].map((row, i) => (
                <tr key={i} className="group hover:bg-slate-800/30 transition-colors">
                  <td className="py-5 font-medium text-slate-100">{row.name}</td>
                  <td className="py-5 text-slate-400 text-sm">{row.cat}</td>
                  <td className="py-5 text-slate-400 text-sm">{row.region}</td>
                  <td className="py-5">
                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${row.job === '正在招聘' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                      {row.job}
                    </span>
                  </td>
                  <td className="py-5">
                    <span className={`flex items-center gap-1.5 text-sm ${row.status === '已通过' ? 'text-emerald-400' : 'text-amber-400'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${row.status === '已通过' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></span>
                      {row.status}
                    </span>
                  </td>
                  <td className="py-5 text-slate-500 text-sm">{row.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
