
import React, { useState, useRef, useEffect } from 'react';
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
  AlertCircle,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AXIOS_INSTANCE } from '@/lib/http';
import { useAuth } from '@/App';

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
  status: number; // 0:已报名, 1:已签到, 2:缺勤, 3:取消
  checkinTime: string | null;
  isProxy: boolean;
  createdAt: string;
}

interface BaseStat {
  baseId: number;
  baseName: string;
  present: number;
  total: number;
  attendanceRate: number;
}

interface AttendanceStats {
  checkedIn: number;
  absent: number;
  signedUp: number;
  total: number;
  attendanceRate: number;
  date: string;
}

export default function AttendanceManagement() {
  const { user } = useAuth();
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedBaseId, setSelectedBaseId] = useState<number | null>(null);
  
  // 数据状态
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [baseStats, setBaseStats] = useState<BaseStat[]>([]);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRecords, setShowRecords] = useState(false);

  // 获取数据
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const date = selectedDate;
      const params: any = { date };
      if (selectedBaseId) {
        params.baseId = selectedBaseId;
      }

      // 并行获取三个API的数据
      const [recordsRes, statsRes, basesRes] = await Promise.all([
        AXIOS_INSTANCE.get('/api/attendance/records', { params }),
        AXIOS_INSTANCE.get('/api/attendance/stats', { params: { date } }),
        AXIOS_INSTANCE.get('/api/attendance/bases', { params: { date } }),
      ]);

      setRecords(recordsRes.data.records || []);
      setStats(statsRes.data || null);
      setBaseStats(basesRes.data.bases || []);
    } catch (e: any) {
      console.error('获取考勤数据失败:', e);
      setError(e?.response?.data?.message || '获取数据失败，请检查后端是否启动');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedDate, selectedBaseId]);

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
    // 刷新数据
    fetchData();
  };

  const getStatusLabel = (status: number) => {
    switch (status) {
      case 0: return '已报名';
      case 1: return '已签到';
      case 2: return '缺勤';
      case 3: return '已取消';
      default: return '未知';
    }
  };

  const getStatusColor = (status: number) => {
    switch (status) {
      case 1: return 'text-emerald-400';
      case 2: return 'text-rose-400';
      case 3: return 'text-slate-400';
      default: return 'text-amber-400';
    }
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '-';
    return new Date(timeStr).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">现场签到</h2>
          <p className="text-slate-400 text-sm">扫描采摘工个人二维码进行工作核验。</p>
        </div>
        <div className="flex gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-2 bg-slate-800 rounded-xl text-slate-300 border border-slate-700/50"
          />
          <button
            onClick={() => setShowRecords(!showRecords)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-xl text-slate-300 border border-slate-700/50 hover:bg-slate-700 transition-all"
          >
            <History size={18} /> {showRecords ? '隐藏记录' : '签到记录'}
          </button>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-xl text-slate-300 border border-slate-700/50 hover:bg-slate-700 transition-all disabled:opacity-50"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} /> 刷新
          </button>
        </div>
      </div>

      {error && (
        <div className="glass-card rounded-3xl p-4 border border-rose-500/50 bg-rose-500/10">
          <div className="flex items-center gap-2 text-rose-400">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        </div>
      )}

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

          {showRecords && (
            <div className="glass-card rounded-3xl p-6 border border-slate-800/60 overflow-hidden">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-lg font-bold text-white">签到记录列表</h4>
                <select
                  value={selectedBaseId || ''}
                  onChange={(e) => setSelectedBaseId(e.target.value ? Number(e.target.value) : null)}
                  className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300"
                >
                  <option value="">全部基地</option>
                  {baseStats.map((base) => (
                    <option key={base.baseId} value={base.baseId}>
                      {base.baseName}
                    </option>
                  ))}
                </select>
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="animate-spin text-emerald-500" size={32} />
                  <span className="ml-3 text-slate-400">加载中...</span>
                </div>
              ) : records.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  暂无签到记录
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-800/60 text-slate-500 text-xs uppercase tracking-wider">
                        <th className="pb-3 font-semibold">姓名</th>
                        <th className="pb-3 font-semibold">工号</th>
                        <th className="pb-3 font-semibold">基地</th>
                        <th className="pb-3 font-semibold">岗位</th>
                        <th className="pb-3 font-semibold">状态</th>
                        <th className="pb-3 font-semibold">签到时间</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {records.map((record) => (
                        <tr key={record.id} className="group hover:bg-slate-800/30 transition-colors">
                          <td className="py-4 font-medium text-slate-100">{record.workerName}</td>
                          <td className="py-4 text-emerald-400 font-mono text-sm">{record.workerUid}</td>
                          <td className="py-4 text-slate-400 text-sm">{record.baseName}</td>
                          <td className="py-4 text-slate-400 text-sm">{record.jobTitle}</td>
                          <td className="py-4">
                            <span className={`text-sm font-medium ${getStatusColor(record.status)}`}>
                              {getStatusLabel(record.status)}
                            </span>
                          </td>
                          <td className="py-4 text-slate-400 text-sm">{formatTime(record.checkinTime)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <div className="glass-card rounded-3xl p-6 border border-slate-800/60 overflow-hidden">
            <h4 className="text-lg font-bold text-white mb-6">近期异常提醒</h4>
            <div className="space-y-4">
              {records
                .filter(r => r.status === 2 || (r.status === 0 && new Date(r.workDate) <= new Date()))
                .slice(0, 3)
                .map((record, i) => (
                  <div key={record.id} className="flex items-start gap-4 p-4 rounded-2xl bg-slate-950/50 border border-slate-800/60">
                    <div className={`p-2 rounded-lg ${record.status === 2 ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'}`}>
                      {record.status === 2 ? <XCircle size={20} /> : <AlertCircle size={20} />}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-slate-100">{record.workerName}</span>
                        <span className="text-xs text-slate-500">{formatTime(record.checkinTime)}</span>
                      </div>
                      <p className="text-sm text-slate-400">
                        {record.status === 2 
                          ? `缺勤 - ${record.baseName}` 
                          : `已报名但未签到 - ${record.baseName}`}
                      </p>
                    </div>
                  </div>
                ))}
              {records.filter(r => r.status === 2 || (r.status === 0 && new Date(r.workDate) <= new Date())).length === 0 && (
                <div className="text-center py-8 text-slate-500 text-sm">暂无异常记录</div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card rounded-3xl p-6 border border-slate-800/60">
            <h4 className="font-bold text-white mb-6 flex items-center gap-2">
              <MapPin className="text-emerald-400" size={18} />
              当前活跃基地状态
            </h4>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin text-emerald-500" size={24} />
              </div>
            ) : baseStats.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">暂无基地数据</div>
            ) : (
              <div className="space-y-6">
                {baseStats.map((base, i) => {
                  const colors = ['emerald', 'blue', 'orange', 'purple', 'pink'];
                  const color = colors[i % colors.length];
                  return (
                    <div key={base.baseId} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-200 font-medium">{base.baseName}</span>
                        <span className="text-slate-400">{base.present}/{base.total} 人</span>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className={`h-full bg-${color}-500 transition-all duration-1000`} 
                          style={{ width: `${base.attendanceRate}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="glass-card rounded-3xl p-6 border border-slate-800/60">
            <h4 className="font-bold text-white mb-6 flex items-center gap-2">
              <Calendar className="text-emerald-400" size={18} />
              考勤汇总 ({selectedDate === new Date().toISOString().split('T')[0] ? '今日' : selectedDate})
            </h4>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin text-emerald-500" size={24} />
              </div>
            ) : stats ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800/60 text-center">
                  <p className="text-2xl font-bold text-emerald-400">{stats.checkedIn}</p>
                  <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider">已签到</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800/60 text-center">
                  <p className="text-2xl font-bold text-slate-400">{stats.absent}</p>
                  <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider">缺勤</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800/60 text-center">
                  <p className="text-2xl font-bold text-amber-400">{stats.signedUp}</p>
                  <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider">已报名</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800/60 text-center">
                  <p className="text-2xl font-bold text-blue-400">{stats.attendanceRate}%</p>
                  <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider">到岗率</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500 text-sm">暂无统计数据</div>
            )}
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
