
import React from 'react';
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
  FileText
} from 'lucide-react';

export default function PayrollView() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">工资结算</h2>
          <p className="text-slate-400 text-sm">核算并审放采摘工劳动报酬。</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl transition-all border border-slate-700/50">
            <Download size={18} />
            <span>导出报表</span>
          </button>
          <button className="flex items-center gap-2 px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95">
            <CircleDollarSign size={18} />
            <span>发起新结算</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 rounded-3xl border border-slate-800/60 flex items-center gap-4">
           <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
             <TrendingUp size={28} />
           </div>
           <div>
             <p className="text-slate-500 text-xs uppercase tracking-widest font-bold">本周总支出</p>
             <h3 className="text-2xl font-bold text-white">¥124,500.00</h3>
           </div>
        </div>
        <div className="glass-card p-6 rounded-3xl border border-slate-800/60 flex items-center gap-4">
           <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
             <Clock size={28} />
           </div>
           <div>
             <p className="text-slate-500 text-xs uppercase tracking-widest font-bold">待发放金额</p>
             <h3 className="text-2xl font-bold text-white">¥18,200.00</h3>
           </div>
        </div>
        <div className="glass-card p-6 rounded-3xl border border-slate-800/60 flex items-center gap-4">
           <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
             <CheckCircle2 size={28} />
           </div>
           <div>
             <p className="text-slate-500 text-xs uppercase tracking-widest font-bold">已发放订单</p>
             <h3 className="text-2xl font-bold text-white">1,582</h3>
           </div>
        </div>
      </div>

      <div className="glass-card rounded-3xl p-6 border border-slate-800/60">
        <div className="flex flex-col md:flex-row gap-4 mb-8">
           <div className="relative flex-1">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
             <input type="text" placeholder="搜索工人姓名、UID或单号..." className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl py-2 pl-10 pr-4 text-sm text-slate-100" />
           </div>
           <div className="flex gap-2">
              <button className="px-4 py-2 bg-slate-800 rounded-xl text-slate-300 text-sm flex items-center gap-2"><Filter size={16} /> 更多筛选</button>
              <select className="bg-slate-800 border border-slate-700/50 rounded-xl px-4 py-2 text-sm text-slate-300">
                <option>全部支付方式</option>
                <option>银行卡</option>
                <option>支付宝</option>
                <option>现金</option>
              </select>
           </div>
        </div>

        <div className="overflow-x-auto">
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
              {[
                { id: 'PAY20240321001', date: '2024-03-21', user: '王大利', job: '苹果采摘', vol: '120 筐', amount: '¥360.00', status: '已发放', method: '银行卡' },
                { id: 'PAY20240321002', date: '2024-03-21', user: '李梅', job: '蓝莓分拣', vol: '85 斤', amount: '¥127.50', status: '待审核', method: '现金' },
                { id: 'PAY20240321003', date: '2024-03-21', user: '赵铁柱', job: '番茄采摘', vol: '8.0 小时', amount: '¥160.00', status: '发放中', method: '支付宝' },
                { id: 'PAY20240321004', date: '2024-03-20', user: '孙彩云', job: '蔬菜打包', vol: '200 件', amount: '¥400.00', status: '已发放', method: '银行卡' },
              ].map((row, i) => (
                <tr key={i} className="group hover:bg-slate-800/20 transition-colors">
                  <td className="py-5 px-4">
                    <div className="flex flex-col">
                      <span className="text-slate-100 font-mono text-xs">{row.id}</span>
                      <span className="text-slate-500 text-xs mt-1">{row.date}</span>
                    </div>
                  </td>
                  <td className="py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-emerald-400">
                        {row.user[0]}
                      </div>
                      <span className="text-slate-100 font-medium">{row.user}</span>
                    </div>
                  </td>
                  <td className="py-5 text-slate-400 text-sm">{row.job}</td>
                  <td className="py-5 text-slate-400 text-sm">{row.vol}</td>
                  <td className="py-5">
                    <span className="text-emerald-400 font-bold">{row.amount}</span>
                  </td>
                  <td className="py-5">
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 w-fit ${row.status === '已发放' ? 'bg-emerald-500/10 text-emerald-400' : row.status === '待审核' ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${row.status === '已发放' ? 'bg-emerald-500' : row.status === '待审核' ? 'bg-amber-500' : 'bg-blue-500'}`}></span>
                      {row.status}
                    </span>
                  </td>
                  <td className="py-5 text-right px-4">
                     <div className="flex justify-end gap-2">
                        <button className="p-2 text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all" title="查看明细">
                          <FileText size={18} />
                        </button>
                        {row.status === '待审核' && (
                          <button className="p-2 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all" title="确认发放">
                             <Banknote size={18} />
                          </button>
                        )}
                     </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
