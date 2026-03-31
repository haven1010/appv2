/**
 * Layer: Frontend View
 * Responsibility: Implements the Attendance Management screen and coordinates user interaction, page state, and API-driven data binding.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
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
  Loader2,
  Paperclip,
  ChevronLeft,
  ChevronRight
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

interface JobDetail {
  id: number;
  payType: number;
  jobTitle: string;
  hourlyRate?: number | null;
  unitPrice?: number | null;
  salaryAmount?: number | null;
}

interface ManageableBaseOption {
  id: number;
  baseName: string;
}

interface OfflineJobOption {
  id: number;
  jobTitle: string;
}

interface OfflineAttendanceEventRecord {
  id: number;
  workerUid: string;
  workerName: string;
  baseId: number;
  baseName: string;
  jobId: number | null;
  jobTitle: string;
  workDate: string;
  occurredAt: string;
  status: number;
  riskLevel: number;
  validationMessage?: string | null;
  evidenceNote?: string | null;
  evidenceAttachments?: { url: string; name: string; size?: number; type?: string }[];
  submittedByName: string;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  appliedSignupId?: number | null;
}

interface OfflineAttendanceStats {
  total: number;
  pendingReview: number;
  approved: number;
  rejected: number;
  autoApproved: number;
}

const resolveAttachmentUrl = (url: string) => {
  if (!url) return '#';
  if (/^https?:\/\//i.test(url)) return url;
  const baseUrl = (AXIOS_INSTANCE.defaults.baseURL as string | undefined) || window.location.origin;
  return new URL(url, baseUrl).toString();
};

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
  const [salaryDraftTarget, setSalaryDraftTarget] = useState<AttendanceRecord | null>(null);
  const [salaryJobDetail, setSalaryJobDetail] = useState<JobDetail | null>(null);
  const [salaryJobLoading, setSalaryJobLoading] = useState(false);
  const [salaryDuration, setSalaryDuration] = useState('');
  const [salaryCount, setSalaryCount] = useState('');
  const [salarySubmitting, setSalarySubmitting] = useState(false);
  const [manageableBases, setManageableBases] = useState<ManageableBaseOption[]>([]);
  const [offlineJobs, setOfflineJobs] = useState<OfflineJobOption[]>([]);
  const [offlineEvents, setOfflineEvents] = useState<OfflineAttendanceEventRecord[]>([]);
  const [offlineLoading, setOfflineLoading] = useState(false);
  const [offlineSubmitting, setOfflineSubmitting] = useState(false);
  const [offlineReviewingId, setOfflineReviewingId] = useState<number | null>(null);
  const [offlineUploadLoading, setOfflineUploadLoading] = useState(false);
  const [offlinePage, setOfflinePage] = useState(1);
  const [offlinePageSize] = useState(10);
  const [offlineStats, setOfflineStats] = useState<OfflineAttendanceStats | null>(null);
  const [offlineForm, setOfflineForm] = useState({
    baseId: '',
    jobId: '',
    workerUid: '',
    workDate: new Date().toISOString().split('T')[0],
    occurredAt: new Date().toISOString().slice(0, 16),
    evidenceNote: '',
    evidenceAttachments: [] as { url: string; name: string; size?: number; type?: string }[],
  });

  // 获取数据
  const fetchData = async () => {
    try {
      setLoading(true);
      setOfflineLoading(true);
      setError(null);

      const date = selectedDate;
      const params: any = { date };
      if (selectedBaseId) {
        params.baseId = selectedBaseId;
      }

      // 并行获取核心考勤数据
      const [recordsRes, statsRes, basesRes] = await Promise.all([
        AXIOS_INSTANCE.get('/api/attendance/records', { params }),
        AXIOS_INSTANCE.get('/api/attendance/stats', { params: { date } }),
        AXIOS_INSTANCE.get('/api/attendance/bases', { params: { date } }),
      ]);

      const offlineParams: any = { workDate: date };
      if (selectedBaseId) {
        offlineParams.baseId = selectedBaseId;
      } else if (fieldBaseId) {
        offlineParams.baseId = fieldBaseId;
      }
      offlineParams.page = offlinePage;
      offlineParams.pageSize = offlinePageSize;
      const [offlineRes, offlineStatsRes] = await Promise.all([
        AXIOS_INSTANCE.get('/api/attendance/offline-events', { params: offlineParams }),
        AXIOS_INSTANCE.get('/api/attendance/offline-events/stats', { params: offlineParams }),
      ]);

      setRecords(recordsRes.data.records || []);
      setStats(statsRes.data || null);
      setBaseStats(basesRes.data.bases || []);
      setOfflineEvents(Array.isArray(offlineRes.data?.list) ? offlineRes.data.list : []);
      setOfflineStats(offlineStatsRes.data || null);
    } catch (e: any) {
      console.error('获取考勤数据失败:', e);
      setError(e?.response?.data?.message || '获取数据失败，请检查后端是否启动');
    } finally {
      setLoading(false);
      setOfflineLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedDate, selectedBaseId, offlinePage]);

  useEffect(() => {
    setOfflinePage(1);
  }, [selectedDate, selectedBaseId]);

  // 手动输入签到模式（用于没有扫码枪时手动输入二维码内容或 UID）
  const [manualInput, setManualInput] = useState('');
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [checkinError, setCheckinError] = useState<string | null>(null);

  // 确定现场管理员的基地 ID
  const [fieldBaseId, setFieldBaseId] = useState<number | null>(null);

  useEffect(() => {
    if (user?.role === 'field_manager') {
      // 从考勤 bases 接口获取关联基地
      AXIOS_INSTANCE.get('/api/attendance/bases', { params: { date: selectedDate } })
        .then((res) => {
          const bases = res.data.bases || [];
          if (bases.length > 0) setFieldBaseId(bases[0].baseId);
        })
        .catch(() => {});
    }
  }, [user, selectedDate]);

  useEffect(() => {
    const loadManageableBases = async () => {
      try {
        if (!user) return;

        if (user.role === 'field_manager') {
          if (!fieldBaseId) return;
          const res = await AXIOS_INSTANCE.get(`/api/base/${fieldBaseId}`);
          const nextBases = res.data ? [{ id: Number(res.data.id), baseName: res.data.baseName }] : [];
          setManageableBases(nextBases);
          setOfflineForm((current) => ({
            ...current,
            baseId: current.baseId || String(fieldBaseId),
          }));
          return;
        }

        const params: any = { showAll: true };
        if (user.role === 'base_manager') {
          params.ownerId = user.id;
        }

        const res = await AXIOS_INSTANCE.get('/api/base', { params });
        const nextBases = (Array.isArray(res.data) ? res.data : []).map((item: any) => ({
          id: Number(item.id),
          baseName: item.baseName,
        }));
        setManageableBases(nextBases);
        setOfflineForm((current) => ({
          ...current,
          baseId: current.baseId || (nextBases[0] ? String(nextBases[0].id) : ''),
        }));
      } catch (e) {
        console.error('加载可管理基地失败:', e);
      }
    };

    loadManageableBases();
  }, [user, fieldBaseId]);

  useEffect(() => {
    const loadOfflineJobs = async () => {
      if (!offlineForm.baseId) {
        setOfflineJobs([]);
        return;
      }

      try {
        const res = await AXIOS_INSTANCE.get(`/api/base/${offlineForm.baseId}/jobs`);
        setOfflineJobs((Array.isArray(res.data) ? res.data : []).map((item: any) => ({
          id: Number(item.id),
          jobTitle: item.jobTitle,
        })));
      } catch (e) {
        console.error('加载离线补录岗位失败:', e);
        setOfflineJobs([]);
      }
    };

    loadOfflineJobs();
  }, [offlineForm.baseId]);

  const handleStartScan = () => {
    setIsScanning(true);
    setCheckinError(null);
  };

  const handleManualCheckin = async () => {
    const qrContent = manualInput.trim();
    if (!qrContent) return;

    // 确定使用哪个基地 ID
    const checkinBaseId = fieldBaseId || selectedBaseId;
    if (!checkinBaseId) {
      setCheckinError('请先选择签到基地');
      return;
    }

    setCheckinLoading(true);
    setCheckinError(null);
    try {
      const res = await AXIOS_INSTANCE.post('/api/attendance/checkin', {
        qrContent,
        baseId: checkinBaseId,
      });
      const record = res.data;
      setLastScanned({
        name: record.user?.name || '签到成功',
        uid: record.user?.uid || '-',
        job: record.job?.jobTitle || '-',
        base: baseStats.find(b => b.baseId === checkinBaseId)?.baseName || `基地#${checkinBaseId}`,
        time: new Date().toLocaleTimeString(),
        status: 'PRESENT',
      });
      setIsScanning(false);
      setManualInput('');
      fetchData();
    } catch (e: any) {
      const msg = e?.response?.data?.message || '签到失败';
      setCheckinError(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setCheckinLoading(false);
    }
  };

  const openSalaryDraftModal = async (record: AttendanceRecord) => {
    setSalaryDraftTarget(record);
    setSalaryJobDetail(null);
    setSalaryDuration('');
    setSalaryCount('');
    setSalaryJobLoading(true);
    try {
      const res = await AXIOS_INSTANCE.get<JobDetail>(`/api/base/jobs/${record.jobId}`);
      setSalaryJobDetail(res.data);
    } catch (e: any) {
      const msg = e?.response?.data?.message || '加载岗位详情失败';
      alert(Array.isArray(msg) ? msg[0] : msg);
      setSalaryDraftTarget(null);
    } finally {
      setSalaryJobLoading(false);
    }
  };

  const closeSalaryDraftModal = () => {
    setSalaryDraftTarget(null);
    setSalaryJobDetail(null);
    setSalaryDuration('');
    setSalaryCount('');
    setSalarySubmitting(false);
  };

  const handleCreateSalaryDraft = async () => {
    if (!salaryDraftTarget || !salaryJobDetail) return;
    if (salaryJobDetail.payType === 2 && !salaryDuration) {
      alert('时薪岗位需要填写工作时长');
      return;
    }
    if (salaryJobDetail.payType === 3 && !salaryCount) {
      alert('计件岗位需要填写件数');
      return;
    }

    setSalarySubmitting(true);
    try {
      await AXIOS_INSTANCE.post(`/api/salary/calculate/${salaryDraftTarget.id}`, {
        duration: salaryJobDetail.payType === 2 ? Number(salaryDuration) : undefined,
        count: salaryJobDetail.payType === 3 ? Number(salaryCount) : undefined,
      });
      alert('工资草稿已生成');
      closeSalaryDraftModal();
    } catch (e: any) {
      const msg = e?.response?.data?.message || '生成工资草稿失败';
      alert(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setSalarySubmitting(false);
    }
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

  const getOfflineStatusLabel = (status: number) => {
    switch (status) {
      case 1: return '自动通过';
      case 2: return '人工通过';
      case 3: return '已拒绝';
      default: return '待审核';
    }
  };

  const getOfflineStatusClass = (status: number) => {
    switch (status) {
      case 1:
      case 2:
        return 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20';
      case 3:
        return 'bg-rose-500/10 text-rose-300 border border-rose-500/20';
      default:
        return 'bg-amber-500/10 text-amber-300 border border-amber-500/20';
    }
  };

  const canReviewOffline = user?.role === 'super_admin' || user?.role === 'region_admin' || user?.role === 'base_manager';

  const getOfflineDeviceId = () => {
    const key = 'attendance-offline-device-id';
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const generated = `web-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    window.localStorage.setItem(key, generated);
    return generated;
  };

  const handleCreateOfflineEvent = async () => {
    if (!offlineForm.baseId || !offlineForm.workerUid.trim()) {
      alert('请至少选择基地并填写工人UID');
      return;
    }

    setOfflineSubmitting(true);
    try {
      const offlineRecordId = `manual-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const res = await AXIOS_INSTANCE.post('/api/attendance/offline-events', {
        offlineRecordId,
        deviceId: getOfflineDeviceId(),
        workerUid: offlineForm.workerUid.trim(),
        baseId: Number(offlineForm.baseId),
        jobId: offlineForm.jobId ? Number(offlineForm.jobId) : undefined,
        workDate: offlineForm.workDate,
        occurredAt: new Date(offlineForm.occurredAt).toISOString(),
        evidenceNote: offlineForm.evidenceNote.trim() || undefined,
        evidenceAttachments: offlineForm.evidenceAttachments,
      });
      const status = Number(res.data?.status);
      alert(status === 0 ? '已提交待审核' : '离线补签到已自动通过');
      setOfflineForm((current) => ({
        ...current,
        workerUid: '',
        evidenceNote: '',
        evidenceAttachments: [],
      }));
      fetchData();
    } catch (e: any) {
      const msg = e?.response?.data?.message || '提交离线补录失败';
      alert(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setOfflineSubmitting(false);
    }
  };

  const handleOfflineAttachmentUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    setOfflineUploadLoading(true);
    try {
      const nextAttachments = [...offlineForm.evidenceAttachments];
      for (const file of Array.from(fileList)) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await AXIOS_INSTANCE.post('/api/attendance/offline-events/evidence', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        nextAttachments.push(res.data);
      }

      setOfflineForm((current) => ({
        ...current,
        evidenceAttachments: nextAttachments,
      }));
    } catch (e: any) {
      const msg = e?.response?.data?.message || '附件上传失败';
      alert(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setOfflineUploadLoading(false);
    }
  };

  const removeOfflineAttachment = (url: string) => {
    setOfflineForm((current) => ({
      ...current,
      evidenceAttachments: current.evidenceAttachments.filter((item) => item.url !== url),
    }));
  };

  const handleReviewOfflineEvent = async (eventId: number, decision: 'approve' | 'reject') => {
    const reason = decision === 'reject'
      ? window.prompt('请输入拒绝原因') || ''
      : window.prompt('审核备注（可选）') || '';

    setOfflineReviewingId(eventId);
    try {
      await AXIOS_INSTANCE.patch(`/api/attendance/offline-events/${eventId}/review`, {
        decision,
        reason: reason || undefined,
      });
      fetchData();
    } catch (e: any) {
      const msg = e?.response?.data?.message || '审核失败';
      alert(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setOfflineReviewingId(null);
    }
  };

  return (
    <div className="space-y-6 warm-business warm-business-attendance">
      <section className="soft-card-strong p-6 md:p-8">
        <p className="section-label">Attendance Flow</p>
        <h2 className="page-title">考勤管理页统一为同一套暖色运营界面</h2>
        <p className="page-subtitle">
          保留扫码签到、记录查询、离线补录和审核闭环的业务能力，重点优化视觉层级和表单阅读体验。
        </p>
        <div className="warm-business-summary mt-6">
          <article className="paper-panel p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a2814a]">今日签到</p>
            <p className="mt-3 text-3xl font-extrabold tracking-tight text-[var(--ink)]">{stats?.checkedIn ?? 0}</p>
          </article>
          <article className="paper-panel p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a2814a]">待签到</p>
            <p className="mt-3 text-3xl font-extrabold tracking-tight text-[var(--ink)]">{stats?.signedUp ?? 0}</p>
          </article>
          <article className="paper-panel p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a2814a]">离线补录</p>
            <p className="mt-3 text-3xl font-extrabold tracking-tight text-[var(--ink)]">{offlineStats?.pendingReview ?? 0}</p>
          </article>
        </div>
      </section>
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
              <div className="flex flex-col items-center gap-6 w-full max-w-md">
                <div className="relative w-64 h-64 border-2 border-emerald-500 rounded-3xl overflow-hidden shadow-2xl shadow-emerald-500/20">
                  <div className="absolute inset-0 bg-slate-900 flex items-center justify-center">
                    <Camera size={48} className="text-emerald-500/20 animate-pulse" />
                  </div>
                  <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 animate-scan-line"></div>
                </div>
                <div className="text-center">
                  <p className="text-emerald-400 font-bold mb-2">扫码签到</p>
                  <p className="text-slate-500 text-sm">请将二维码内容粘贴到下方输入框完成签到</p>
                </div>
                {/* Manual QR input */}
                <div className="w-full space-y-3">
                  <textarea
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="粘贴二维码内容..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
                    rows={3}
                  />
                  {user?.role !== 'field_manager' && !fieldBaseId && (
                    <select
                      value={selectedBaseId || ''}
                      onChange={(e) => setSelectedBaseId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-300"
                    >
                      <option value="">选择签到基地</option>
                      {baseStats.map((b) => (
                        <option key={b.baseId} value={b.baseId}>{b.baseName}</option>
                      ))}
                    </select>
                  )}
                  {checkinError && (
                    <div className="text-rose-400 text-sm bg-rose-500/10 rounded-xl px-4 py-2 border border-rose-500/20">
                      {checkinError}
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setIsScanning(false); setCheckinError(null); setManualInput(''); }}
                      className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition-all font-medium"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleManualCheckin}
                      disabled={checkinLoading || !manualInput.trim()}
                      className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {checkinLoading && <Loader2 className="animate-spin" size={16} />}
                      确认签到
                    </button>
                  </div>
                </div>
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
                        <th className="pb-3 font-semibold text-right">薪资</th>
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
                          <td className="py-4 text-right">
                            {record.status === 1 ? (
                              <button
                                onClick={() => openSalaryDraftModal(record)}
                                className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20"
                              >
                                生成工资草稿
                              </button>
                            ) : (
                              <span className="text-xs text-slate-600">待签到后可计薪</span>
                            )}
                          </td>
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
                  const colorClass = ['bg-emerald-500', 'bg-blue-500', 'bg-orange-500', 'bg-cyan-500', 'bg-pink-500'][i % 5];
                  return (
                    <div key={base.baseId} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-200 font-medium">{base.baseName}</span>
                        <span className="text-slate-400">{base.present}/{base.total} 人</span>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${colorClass} transition-all duration-1000`} 
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

      <div className="glass-card rounded-3xl border border-slate-800/60 p-6 overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-800/60 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h4 className="text-lg font-bold text-white">离线补签到工作区</h4>
            <p className="mt-1 text-sm text-slate-500">断网时先补录原始事件。低风险记录自动入账，高风险记录进入审核队列。</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="rounded-full border border-slate-800 bg-slate-950/50 px-3 py-1.5">按工作日 {selectedDate} 查看</span>
            <button
              onClick={fetchData}
              className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-300 transition hover:bg-slate-700"
            >
              刷新队列
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 items-start gap-6 2xl:grid-cols-[420px_minmax(0,1fr)]">
          <div className="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-5">
            <div className="mb-4">
              <h5 className="text-base font-bold text-white">提交补录</h5>
              <p className="mt-1 text-xs text-slate-500">先记录原始事件，再由系统自动通过或进入审核。</p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-1">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">补录基地</label>
                <select
                  value={offlineForm.baseId}
                  onChange={(e) => setOfflineForm((current) => ({ ...current, baseId: e.target.value, jobId: '' }))}
                  disabled={user?.role === 'field_manager'}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-100 disabled:opacity-70"
                >
                  <option value="">请选择基地</option>
                  {manageableBases.map((base) => (
                    <option key={base.id} value={base.id}>{base.baseName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">岗位</label>
                <select
                  value={offlineForm.jobId}
                  onChange={(e) => setOfflineForm((current) => ({ ...current, jobId: e.target.value }))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-100"
                >
                  <option value="">未知岗位也可先提交</option>
                  {offlineJobs.map((job) => (
                    <option key={job.id} value={job.id}>{job.jobTitle}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2 2xl:col-span-1">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">工人 UID</label>
                <input
                  value={offlineForm.workerUid}
                  onChange={(e) => setOfflineForm((current) => ({ ...current, workerUid: e.target.value }))}
                  placeholder="例如 UMN4K5B76928C"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">工作日</label>
                <input
                  type="date"
                  value={offlineForm.workDate}
                  onChange={(e) => setOfflineForm((current) => ({ ...current, workDate: e.target.value }))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">发生时间</label>
                <input
                  type="datetime-local"
                  value={offlineForm.occurredAt}
                  onChange={(e) => setOfflineForm((current) => ({ ...current, occurredAt: e.target.value }))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-100"
                />
              </div>

              <div className="md:col-span-2 2xl:col-span-1">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">补录说明</label>
                <textarea
                  value={offlineForm.evidenceNote}
                  onChange={(e) => setOfflineForm((current) => ({ ...current, evidenceNote: e.target.value }))}
                  placeholder="例如：山区网络中断，已核对纸面签到表"
                  rows={3}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-100 resize-none"
                />
              </div>

              <div className="md:col-span-2 2xl:col-span-1">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">证据附件</label>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-800/70 px-4 py-3 text-sm text-slate-300 hover:border-blue-400/40 hover:text-white">
                  {offlineUploadLoading ? <Loader2 className="animate-spin" size={16} /> : <Paperclip size={16} />}
                  上传图片或凭证
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      handleOfflineAttachmentUpload(e.target.files);
                      e.target.value = '';
                    }}
                  />
                </label>
                {offlineForm.evidenceAttachments.length > 0 ? (
                  <div className="mt-3 max-h-28 space-y-2 overflow-auto pr-1">
                    {offlineForm.evidenceAttachments.map((item) => (
                      <div key={item.url} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs text-slate-300">
                        <a href={resolveAttachmentUrl(item.url)} target="_blank" rel="noreferrer" className="truncate hover:text-blue-300">
                          {item.name}
                        </a>
                        <button
                          type="button"
                          onClick={() => removeOfflineAttachment(item.url)}
                          className="ml-3 text-rose-300 hover:text-rose-200"
                        >
                          移除
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <button
              onClick={handleCreateOfflineEvent}
              disabled={offlineSubmitting}
              className="mt-5 w-full rounded-2xl bg-blue-500 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-400 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {offlineSubmitting ? <Loader2 className="animate-spin" size={16} /> : null}
              提交离线补录
            </button>
          </div>

          <div className="flex min-h-0 flex-col rounded-2xl border border-slate-800/60 bg-slate-950/30 p-5 2xl:max-h-[760px]">
            <div className="flex flex-col gap-4 border-b border-slate-800/60 pb-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <h5 className="text-base font-bold text-white">补录队列</h5>
                <p className="mt-1 text-xs text-slate-500">自动通过会直接完成签到，待审核项需要基地管理员或超级管理员处理。</p>
              </div>
              {offlineStats ? (
                <div className="grid grid-cols-5 gap-2 xl:min-w-[420px]">
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-3 text-center">
                    <div className="text-[11px] text-slate-500">总数</div>
                    <div className="mt-1 text-lg font-bold text-white">{offlineStats.total}</div>
                  </div>
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-3 text-center">
                    <div className="text-[11px] text-amber-300">待审</div>
                    <div className="mt-1 text-lg font-bold text-amber-200">{offlineStats.pendingReview}</div>
                  </div>
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-3 text-center">
                    <div className="text-[11px] text-emerald-300">自动</div>
                    <div className="mt-1 text-lg font-bold text-emerald-200">{offlineStats.autoApproved}</div>
                  </div>
                  <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-3 py-3 text-center">
                    <div className="text-[11px] text-blue-300">人工</div>
                    <div className="mt-1 text-lg font-bold text-blue-200">{offlineStats.approved}</div>
                  </div>
                  <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-3 py-3 text-center">
                    <div className="text-[11px] text-rose-300">拒绝</div>
                    <div className="mt-1 text-lg font-bold text-rose-200">{offlineStats.rejected}</div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pt-4 pr-1">
              {offlineLoading ? (
                <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
                  <Loader2 className="animate-spin" size={20} />
                  正在加载补录队列...
                </div>
              ) : offlineEvents.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-500">当前没有离线补录记录</div>
              ) : (
                <div className="space-y-3">
                  {offlineEvents.map((event) => (
                    <div key={event.id} className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4">
                      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <span className="font-bold text-slate-100">{event.workerName || '-'}</span>
                            <span className="font-mono text-xs text-emerald-400">{event.workerUid}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${getOfflineStatusClass(event.status)}`}>
                              {getOfflineStatusLabel(event.status)}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${event.riskLevel === 0 ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'}`}>
                              {event.riskLevel === 0 ? '低风险' : '高风险'}
                            </span>
                          </div>
                          <p className="text-sm text-slate-400">{event.baseName} · {event.jobTitle || '未指定岗位'}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            工作日 {event.workDate} · 发生于 {new Date(event.occurredAt).toLocaleString('zh-CN')}
                          </p>
                        </div>
                        <div className="text-xs text-slate-500 xl:text-right">
                          <div>提交人：{event.submittedByName}</div>
                          {event.reviewedAt ? <div>审核人：{event.reviewedByName || '-'}</div> : null}
                        </div>
                      </div>

                      <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-300">
                        {event.validationMessage || '无系统提示'}
                      </div>

                      {event.evidenceNote ? (
                        <p className="mt-2 text-xs text-slate-500">补录说明：{event.evidenceNote}</p>
                      ) : null}

                      {event.evidenceAttachments && event.evidenceAttachments.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {event.evidenceAttachments.map((item) => (
                            <a
                              key={item.url}
                              href={resolveAttachmentUrl(item.url)}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-[11px] text-slate-300 hover:text-white"
                            >
                              附件: {item.name}
                            </a>
                          ))}
                        </div>
                      ) : null}

                      {canReviewOffline && event.status === 0 ? (
                        <div className="mt-4 flex gap-3">
                          <button
                            onClick={() => handleReviewOfflineEvent(event.id, 'approve')}
                            disabled={offlineReviewingId === event.id}
                            className="flex-1 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {offlineReviewingId === event.id ? <Loader2 className="animate-spin" size={14} /> : null}
                            通过补录
                          </button>
                          <button
                            onClick={() => handleReviewOfflineEvent(event.id, 'reject')}
                            disabled={offlineReviewingId === event.id}
                            className="flex-1 rounded-xl bg-rose-500/90 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                          >
                            拒绝
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!offlineLoading && offlineStats && offlineStats.total > offlinePageSize ? (
              <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-4">
                <span className="text-xs text-slate-500">
                  第 {offlinePage} 页，共 {Math.max(Math.ceil(offlineStats.total / offlinePageSize), 1)} 页
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setOfflinePage((current) => Math.max(current - 1, 1))}
                    disabled={offlinePage <= 1}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-300 disabled:opacity-40 flex items-center gap-1"
                  >
                    <ChevronLeft size={14} />
                    上一页
                  </button>
                  <button
                    onClick={() => setOfflinePage((current) => current + 1)}
                    disabled={offlinePage >= Math.max(Math.ceil(offlineStats.total / offlinePageSize), 1)}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-300 disabled:opacity-40 flex items-center gap-1"
                  >
                    下一页
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <AnimatePresence>
        {salaryDraftTarget && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeSalaryDraftModal}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative z-10 w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-white">生成工资草稿</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    {salaryDraftTarget.workerName} · {salaryDraftTarget.jobTitle}
                  </p>
                </div>
                <button onClick={closeSalaryDraftModal} className="text-slate-500 transition hover:text-white">
                  <XCircle size={22} />
                </button>
              </div>

              {salaryJobLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="animate-spin text-emerald-400" size={28} />
                </div>
              ) : salaryJobDetail ? (
                <div className="mt-6 space-y-4">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
                    <p>计薪方式：{salaryJobDetail.payType === 1 ? '固定' : salaryJobDetail.payType === 2 ? '时薪' : '计件'}</p>
                    <p className="mt-2">
                      单价：
                      {salaryJobDetail.payType === 1
                        ? `¥${Number(salaryJobDetail.salaryAmount || 0).toFixed(2)}/天`
                        : salaryJobDetail.payType === 2
                          ? `¥${Number(salaryJobDetail.hourlyRate || 0).toFixed(2)}/小时`
                          : `¥${Number(salaryJobDetail.unitPrice || 0).toFixed(2)}/件`}
                    </p>
                  </div>

                  {salaryJobDetail.payType === 2 && (
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">工作时长（小时）</label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={salaryDuration}
                        onChange={(e) => setSalaryDuration(e.target.value)}
                        className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-white focus:border-emerald-500/40 focus:outline-none"
                        placeholder="例如 8"
                      />
                    </div>
                  )}

                  {salaryJobDetail.payType === 3 && (
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">完成件数</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={salaryCount}
                        onChange={(e) => setSalaryCount(e.target.value)}
                        className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-white focus:border-emerald-500/40 focus:outline-none"
                        placeholder="例如 120"
                      />
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={closeSalaryDraftModal}
                      className="flex-1 rounded-2xl bg-slate-800 px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-slate-700"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleCreateSalaryDraft}
                      disabled={salarySubmitting}
                      className="flex-1 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
                    >
                      {salarySubmitting ? '提交中...' : '生成工资草稿'}
                    </button>
                  </div>
                </div>
              ) : null}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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
