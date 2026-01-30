
import React, { useState, useRef } from 'react';
import { 
  Scan, 
  Users, 
  MapPin, 
  Calendar, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Camera,
  RefreshCw,
  MoreVertical,
  History,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AttendanceManagement() {
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleStartScan = () => {
    setIsScanning(true);
    // Simulate camera access
    setTimeout(() => {
      handleScanSuccess();
    }, 2500);
  };

  const handleScanSuccess = () => {
    setLastScanned({
      name: '张三',
      uid: 'UID99021',
      job: '采摘组长',
      base: '红旗生态农场',
      time: new Date().toLocaleTimeString(),
      status: 'PRESENT'
    });
    setIsScanning(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">现场签到</h2>
          <p className="text-slate-400 text-sm">扫描采摘工个人二维码进行工作核验。</p>
        </div>
        <div className="flex gap-2">
           <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-xl text-slate-300 border border-slate-700/50">
            <History size={18} /> 签到记录
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card rounded-3xl p-8 border border-slate-800/60 flex flex-col items-center justify-center min-h-[400px]">
            {isScanning ? (
              <div className="flex flex-col items-center gap-6 w-full max-w-sm">
                <div className="relative w-64 h-64 border-2 border-emerald-500 rounded-3xl overflow-hidden shadow-2xl shadow-emerald-500/20">
                  <div className="absolute inset-0 bg-slate-900 flex items-center justify-center">
                    <Camera size={48} className="text-emerald-500/20 animate-pulse" />
                  </div>
                  <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 animate-scan-line"></div>
                </div>
                <div className="text-center">
                  <p className="text-emerald-400 font-bold mb-2">正在扫描二维码...</p>
                  <p className="text-slate-500 text-sm italic">请对准采摘工手机上的个人专属码</p>
                </div>
                <button 
                  onClick={() => setIsScanning(false)}
                  className="px-6 py-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition-all"
                >
                  取消扫描
                </button>
              </div>
            ) : lastScanned ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center text-center w-full max-w-sm"
              >
                <div className="w-24 h-24 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center mb-6">
                  <CheckCircle2 size={48} className="text-emerald-500" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">签到成功</h3>
                <div className="w-full space-y-4 mb-8">
                   <div className="flex justify-between py-2 border-b border-slate-800/50">
                      <span className="text-slate-500">采摘工姓名</span>
                      <span className="text-white font-medium">{lastScanned.name}</span>
                   </div>
                   <div className="flex justify-between py-2 border-b border-slate-800/50">
                      <span className="text-slate-500">工号(UID)</span>
                      <span className="text-emerald-400 font-mono">{lastScanned.uid}</span>
                   </div>
                   <div className="flex justify-between py-2 border-b border-slate-800/50">
                      <span className="text-slate-500">目标基地</span>
                      <span className="text-white font-medium">{lastScanned.base}</span>
                   </div>
                   <div className="flex justify-between py-2 border-b border-slate-800/50">
                      <span className="text-slate-500">签到时间</span>
                      <span className="text-slate-300">{lastScanned.time}</span>
                   </div>
                </div>
                <div className="flex gap-4 w-full">
                  <button 
                    onClick={() => setLastScanned(null)}
                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-all"
                  >
                    确认
                  </button>
                  <button 
                    onClick={handleStartScan}
                    className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20"
                  >
                    扫描下一位
                  </button>
                </div>
              </motion.div>
            ) : (
              <div className="text-center max-w-sm">
                <div className="w-32 h-32 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-8 mx-auto shadow-inner group hover:border-emerald-500/50 transition-all">
                  <Scan size={64} className="text-slate-700 group-hover:text-emerald-500 transition-all" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">准备开始签到</h3>
                <p className="text-slate-500 mb-8">请使用移动端设备摄像头扫描采摘工二维码以完成实时考勤录入。</p>
                <button 
                  onClick={handleStartScan}
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-2xl shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-3 active:scale-95"
                >
                  <Camera size={24} />
                  启动扫码枪
                </button>
              </div>
            )}
          </div>

          <div className="glass-card rounded-3xl p-6 border border-slate-800/60 overflow-hidden">
            <h4 className="text-lg font-bold text-white mb-6">近期异常提醒</h4>
            <div className="space-y-4">
               {[
                 { user: '刘大能', msg: '身份证已过期，请尽快更新档案', time: '10:45', type: 'error' },
                 { user: '王二娃', msg: '未进行系统注册，已开启现场录入通道', time: '09:30', type: 'warning' },
                 { user: '陈铁柱', msg: '基地信息匹配失败，请人工核查', time: '08:15', type: 'error' },
               ].map((item, i) => (
                 <div key={i} className="flex items-start gap-4 p-4 rounded-2xl bg-slate-950/50 border border-slate-800/60">
                    <div className={`p-2 rounded-lg ${item.type === 'error' ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'}`}>
                      {/* Fixed: AlertCircle is now correctly imported */}
                      {item.type === 'error' ? <XCircle size={20} /> : <AlertCircle size={20} />}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-slate-100">{item.user}</span>
                        <span className="text-xs text-slate-500">{item.time}</span>
                      </div>
                      <p className="text-sm text-slate-400">{item.msg}</p>
                    </div>
                 </div>
               ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card rounded-3xl p-6 border border-slate-800/60">
            <h4 className="font-bold text-white mb-6 flex items-center gap-2">
              <MapPin className="text-emerald-400" size={18} />
              当前活跃基地状态
            </h4>
            <div className="space-y-6">
              {[
                { name: '红旗生态农场', present: 86, total: 100, color: 'emerald' },
                { name: '秦岭蓝莓园', present: 42, total: 45, color: 'blue' },
                { name: '寿光蔬菜基地', present: 120, total: 150, color: 'orange' },
              ].map((base, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-200 font-medium">{base.name}</span>
                    <span className="text-slate-400">{base.present}/{base.total} 人</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full bg-${base.color}-500 transition-all duration-1000`} 
                      style={{ width: `${(base.present / base.total) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-3xl p-6 border border-slate-800/60">
            <h4 className="font-bold text-white mb-6 flex items-center gap-2">
              <Calendar className="text-emerald-400" size={18} />
              考勤汇总 (今日)
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800/60 text-center">
                <p className="text-2xl font-bold text-emerald-400">248</p>
                <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider">已签到</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800/60 text-center">
                <p className="text-2xl font-bold text-slate-400">12</p>
                <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider">未到人员</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800/60 text-center">
                <p className="text-2xl font-bold text-amber-400">3</p>
                <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider">异常标记</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800/60 text-center">
                <p className="text-2xl font-bold text-blue-400">96%</p>
                <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider">到岗率</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes scan-line {
          0% { top: 0; }
          100% { top: 100%; }
        }
        .animate-scan-line {
          animation: scan-line 2s linear infinite;
        }
      `}</style>
    </div>
  );
}
