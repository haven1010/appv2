
import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Download, 
  UserPlus, 
  Camera, 
  MoreHorizontal, 
  CheckCircle2, 
  AlertCircle,
  Smartphone,
  Scan
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function WorkerManagement() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const [idPhoto, setIdPhoto] = useState<string | null>(null);

  const steps = [
    { num: 1, title: '身份采集', icon: Scan },
    { num: 2, title: '完善信息', icon: AlertCircle },
    { num: 3, title: '完成注册', icon: CheckCircle2 },
  ];

  const handleSimulateOCR = () => {
    // Simulate photo taking and OCR
    setIdPhoto('https://picsum.photos/400/250?random=1');
    setTimeout(() => {
      setActiveStep(2);
    }, 1500);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">采摘工档案</h2>
          <p className="text-slate-400 text-sm">管理及录入人员实名制档案信息。</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl transition-all border border-slate-700/50">
            <Download size={18} />
            <span>导出数据</span>
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
          >
            <Plus size={18} />
            <span>新增采摘工</span>
          </button>
        </div>
      </div>

      <div className="glass-card rounded-3xl p-6 border border-slate-800/60">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input 
              type="text" 
              placeholder="搜索姓名、身份证、手机号..." 
              className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-xl text-slate-300 text-sm border border-slate-700/50">
              <Filter size={16} /> 筛选
            </button>
            <select className="bg-slate-800 border border-slate-700/50 rounded-xl px-4 py-2 text-sm text-slate-300 focus:outline-none">
              <option>全部状态</option>
              <option>已认证</option>
              <option>待补全</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-800/60 text-slate-500 text-xs uppercase tracking-wider">
                <th className="pb-4 font-semibold px-4">基本信息</th>
                <th className="pb-4 font-semibold">UID</th>
                <th className="pb-4 font-semibold">紧急联系人</th>
                <th className="pb-4 font-semibold">注册来源</th>
                <th className="pb-4 font-semibold">状态</th>
                <th className="pb-4 font-semibold text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {[
                { name: '王大利', phone: '13812345678', id: '342422********0123', uid: 'UID88271', emergency: '王小利(子)', source: '扫码录入', status: '已认证' },
                { name: '李梅', phone: '13988887777', id: '342422********0987', uid: 'UID88302', emergency: '李大牛(夫)', source: '手机注册', status: '待补全' },
                { name: '赵铁柱', phone: '15544443333', id: '342422********5678', uid: 'UID88415', emergency: '赵小柱(弟)', source: '扫码录入', status: '已认证' },
                { name: '孙彩云', phone: '18622221111', id: '342422********2345', uid: 'UID88520', emergency: '孙大海(父)', source: '拍照录入', status: '已认证' },
              ].map((row, i) => (
                <tr key={i} className="group hover:bg-slate-800/20 transition-colors">
                  <td className="py-5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-emerald-400 font-bold">
                        {row.name[0]}
                      </div>
                      <div>
                        <p className="text-slate-100 font-medium">{row.name}</p>
                        <p className="text-slate-500 text-xs">{row.phone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-5">
                    <code className="text-xs bg-slate-900 px-2 py-1 rounded border border-slate-700/50 text-emerald-400">{row.uid}</code>
                  </td>
                  <td className="py-5 text-slate-400 text-sm">{row.emergency}</td>
                  <td className="py-5 text-slate-400 text-sm">{row.source}</td>
                  <td className="py-5">
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${row.status === '已认证' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="py-5 text-right px-4">
                    <button className="p-2 text-slate-500 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-all">
                      <MoreHorizontal size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Worker Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl relative z-10 overflow-hidden"
            >
              <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <UserPlus className="text-emerald-500" size={24} />
                  人员实名录入
                </h3>
                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                  <AlertCircle size={24} />
                </button>
              </div>

              <div className="p-8">
                {/* Stepper */}
                <div className="flex justify-between items-center mb-10 relative">
                  <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-800 -translate-y-1/2 z-0"></div>
                  {steps.map((step) => (
                    <div key={step.num} className="relative z-10 flex flex-col items-center gap-2">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${activeStep >= step.num ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>
                        {activeStep > step.num ? <CheckCircle2 size={20} /> : <step.icon size={20} />}
                      </div>
                      <span className={`text-xs font-semibold ${activeStep >= step.num ? 'text-emerald-400' : 'text-slate-500'}`}>{step.title}</span>
                    </div>
                  ))}
                </div>

                {activeStep === 1 && (
                  <div className="space-y-6 text-center">
                    <div className="grid grid-cols-2 gap-4">
                      <button 
                        onClick={handleSimulateOCR}
                        className="flex flex-col items-center justify-center p-8 rounded-2xl bg-slate-800/50 border-2 border-dashed border-slate-700 hover:border-emerald-500 hover:bg-emerald-500/5 transition-all group"
                      >
                        <Camera size={48} className="text-slate-500 group-hover:text-emerald-400 mb-4" />
                        <span className="font-bold text-slate-200">身份证拍照录入</span>
                        <span className="text-xs text-slate-500 mt-2">系统自动OCR识别信息</span>
                      </button>
                      <button className="flex flex-col items-center justify-center p-8 rounded-2xl bg-slate-800/50 border-2 border-dashed border-slate-700 hover:border-emerald-500 hover:bg-emerald-500/5 transition-all group">
                        <Smartphone size={48} className="text-slate-500 group-hover:text-emerald-400 mb-4" />
                        <span className="font-bold text-slate-200">分步引导录入</span>
                        <span className="text-xs text-slate-500 mt-2">手动填写详细档案</span>
                      </button>
                    </div>
                    {idPhoto && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-2 text-emerald-400 text-sm font-medium">
                        <div className="animate-spin h-4 w-4 border-2 border-emerald-500 border-t-transparent rounded-full"></div>
                        正在智能识别中...
                      </motion.div>
                    )}
                  </div>
                )}

                {activeStep === 2 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs text-slate-500 font-semibold uppercase">真实姓名</label>
                        <input type="text" defaultValue="王大力" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-slate-500 font-semibold uppercase">身份证号</label>
                        <input type="text" defaultValue="342422198001014567" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-slate-500 font-semibold uppercase">手机号码</label>
                        <input type="text" placeholder="请输入手机号" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-slate-500 font-semibold uppercase">紧急联系人</label>
                        <input type="text" placeholder="姓名及关系" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                      </div>
                    </div>
                    <div className="pt-6">
                       <button 
                        onClick={() => setActiveStep(3)}
                        className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl shadow-lg transition-all"
                       >
                        保存并提交档案
                       </button>
                    </div>
                  </motion.div>
                )}

                {activeStep === 3 && (
                   <div className="flex flex-col items-center justify-center py-10 text-center">
                      <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6">
                        <CheckCircle2 size={48} className="text-emerald-500" />
                      </div>
                      <h4 className="text-2xl font-bold text-white mb-2">人员录入成功</h4>
                      <p className="text-slate-400 mb-8 max-w-sm">档案已通过系统核验并加密存储。UID: <span className="text-emerald-400 font-mono">UID88521</span></p>
                      <button 
                        onClick={() => {setShowAddModal(false); setActiveStep(1); setIdPhoto(null);}}
                        className="px-8 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl border border-slate-700/50 transition-all"
                      >
                        返回列表
                      </button>
                   </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
