import React, { useMemo, useState } from 'react';
import { 
  Sprout, 
  MapPin, 
  Phone,
  Plus, 
  ClipboardCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../App';
import { UserRole } from '../types';
import {
  useBaseControllerFindAll,
  useBaseControllerCreate,
  useBaseControllerGetJobsByBase,
  useBaseControllerGetBaseStatistics,
  useBaseControllerCreateJob,
  getBaseControllerFindAllQueryKey,
  getBaseControllerFindOneQueryKey,
  getBaseControllerGetJobsByBaseQueryKey,
} from '@/api/generated/基地管理/基地管理';
import type { CreateBaseDto, CreateJobDto } from '@/api/model';
import { AXIOS_INSTANCE } from '@/lib/http';

const CAT_LABEL: Record<number, string> = { 1: '水果类', 2: '蔬菜类', 3: '其他' };
const STATUS_LABEL: Record<number, string> = { 0: '待审核', 1: '已通过', 2: '审核未通过' };

function CreateBaseModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState<CreateBaseDto>({
    baseName: '',
    licenseUrl: '',
    contactPhone: '',
    category: 1 as any,
    regionCode: 330100,
    address: '',
    description: '',
  });

  const createMutation = useBaseControllerCreate({
    mutation: {
      onSuccess: () => onSuccess(),
      onError: (e: any) => alert(e?.response?.data?.message ?? '创建失败'),
    },
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-white">申请入驻 · 创建基地</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate({ data: form });
          }}
        >
          <input
            required
            placeholder="基地名称"
            value={form.baseName}
            onChange={(e) => setForm((f) => ({ ...f, baseName: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500"
          />
          <input
            required
            placeholder="营业执照 URL"
            value={form.licenseUrl}
            onChange={(e) => setForm((f) => ({ ...f, licenseUrl: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500"
          />
          <input
            required
            placeholder="联系电话"
            value={form.contactPhone}
            onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500"
          />
          <select
            value={form.category as any}
            onChange={(e) =>
              setForm((f) => ({ ...f, category: Number(e.target.value) as any }))
            }
            className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white"
          >
            <option value={1}>水果类</option>
            <option value={2}>蔬菜类</option>
            <option value={3}>其他</option>
          </select>
          <input
            type="number"
            required
            placeholder="区域代码（如 330100）"
            value={form.regionCode || ''}
            onChange={(e) =>
              setForm((f) => ({ ...f, regionCode: Number(e.target.value) || 0 }))
            }
            className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500"
          />
          <input
            placeholder="地址（选填）"
            value={form.address ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500"
          />
          <textarea
            placeholder="描述（选填）"
            value={form.description ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500"
            rows={2}
          />
          <div className="flex gap-2 pt-2 text-xs text-slate-500">
            <span>提示：基地创建后需超级管理员审核通过才能发布招聘岗位。</span>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 font-medium"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1 py-2 rounded-xl bg-emerald-500 text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {createMutation.isPending && <Loader2 className="animate-spin" size={18} />}
              提交
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BaseDetailDrawer({
  baseId,
  onClose,
  onOpenCreateJob,
}: {
  baseId: number;
  onClose: () => void;
  onOpenCreateJob: () => void;
}) {
  const { data: base, isLoading } = useBaseControllerGetBaseStatistics(baseId);
  const { data: jobs, isLoading: jobsLoading } = useBaseControllerGetJobsByBase(baseId);
  const jobsList = Array.isArray(jobs) ? jobs : [];

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-slate-900 border-l border-slate-700 shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/95">
          <h3 className="text-lg font-bold text-white">基地详情</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-emerald-500" size={32} />
            </div>
          ) : base ? (
            <>
              <div className="rounded-xl p-4 border border-slate-800 bg-slate-900">
                <h4 className="font-bold text-white text-lg">{(base as any).baseName}</h4>
                <p className="text-slate-400 text-sm mt-1">
                  类别：{CAT_LABEL[(base as any).category] ?? '其他'} · 状态：
                  {STATUS_LABEL[(base as any).auditStatus] ?? '-'}
                </p>
                <p className="text-slate-500 text-xs mt-2">
                  区域代码 {(base as any).regionCode} · 地址 {(base as any).address || '—'}
                </p>
              </div>
              <div className="rounded-xl p-4 border border-slate-800 bg-slate-900/60 text-sm text-slate-300">
                <p>
                  招聘岗位总数：{(base as any).statistics?.jobs?.total ?? 0}，在招：
                  {(base as any).statistics?.jobs?.recruiting ?? 0}
                </p>
              </div>
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-bold text-white">招聘岗位</h4>
                  <button
                    type="button"
                    onClick={onOpenCreateJob}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-sm font-medium"
                  >
                    <Plus size={16} /> 发布招聘
                  </button>
                </div>
                {jobsLoading ? (
                  <div className="py-8 flex justify-center">
                    <Loader2 className="animate-spin text-emerald-500" size={24} />
                  </div>
                ) : jobsList.length === 0 ? (
                  <p className="text-slate-500 text-sm py-4">
                    暂无岗位，点击「发布招聘」添加。
                  </p>
                ) : (
                  <div className="space-y-2">
                    {jobsList.map((job: any) => (
                      <div
                        key={job.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-700/50"
                      >
                        <div>
                          <span className="font-medium text-white">
                            {job.jobTitle ?? job.title ?? '-'}
                          </span>
                          <span className="ml-2 text-xs text-slate-500">
                            {job.recruitCount ?? 0} 人 ·{' '}
                            {job.payType === 1
                              ? '固定'
                              : job.payType === 2
                              ? '时薪'
                              : '计件'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="text-slate-500 py-8">加载失败或基地不存在</p>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateJobModal({
  baseId,
  onClose,
  onSuccess,
}: {
  baseId: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState<Partial<CreateJobDto>>({
    jobTitle: '',
    payType: 2,
    recruitCount: 1,
    hourlyRate: 25,
    requirements: '',
    workContent: '',
  });

  const createJobMutation = useBaseControllerCreateJob({
    mutation: {
      onSuccess: () => onSuccess(),
      onError: (e: any) => alert(e?.response?.data?.message ?? '发布失败'),
    },
  });

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-white">发布招聘岗位</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            createJobMutation.mutate({ id: baseId, data: form as CreateJobDto });
          }}
        >
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">岗位名称</label>
            <input
              required
              placeholder="如：采摘工、包装工"
              value={form.jobTitle ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">薪资类型</label>
            <select
              value={form.payType ?? 2}
              onChange={(e) =>
                setForm((f) => ({ ...f, payType: Number(e.target.value) as 1 | 2 | 3 }))
              }
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white"
            >
              <option value={1}>固定工资</option>
              <option value={2}>时薪</option>
              <option value={3}>计件</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">招聘人数</label>
            <input
              type="number"
              min={1}
              placeholder="计划招聘的总人数，如 20"
              value={form.recruitCount ?? ''}
              onChange={(e) =>
                setForm((f) => ({ ...f, recruitCount: Number(e.target.value) || 1 }))
              }
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500"
            />
          </div>
          {form.payType === 1 && (
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">固定工资</label>
              <input
                type="number"
                min={0}
                step={0.01}
                placeholder="元/天，如 200"
                value={form.salaryAmount ?? ''}
                onChange={(e) =>
                  setForm((f) => ({ ...f, salaryAmount: Number(e.target.value) }))
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500"
              />
            </div>
          )}
          {(form.payType === 2 || !form.payType) && (
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">时薪</label>
              <input
                type="number"
                min={0}
                step={0.01}
                placeholder="元/小时，如 25"
                value={form.hourlyRate ?? ''}
                onChange={(e) =>
                  setForm((f) => ({ ...f, hourlyRate: Number(e.target.value) }))
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500"
              />
            </div>
          )}
          {form.payType === 3 && (
            <>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">计件单价</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="元/件，如 1.5"
                  value={form.unitPrice ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, unitPrice: Number(e.target.value) }))
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">目标数量</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  placeholder="计件用，如 100"
                  value={form.targetCount ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, targetCount: Number(e.target.value) }))
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500"
                />
              </div>
            </>
          )}
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">工作内容</label>
            <textarea
              placeholder="描述具体的工作内容和职责"
              value={form.workContent ?? ''}
              onChange={(e) =>
                setForm((f) => ({ ...f, workContent: e.target.value }))
              }
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500"
              rows={2}
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">招聘要求</label>
            <textarea
              placeholder="描述对候选人的要求和条件"
              value={form.requirements ?? ''}
              onChange={(e) =>
                setForm((f) => ({ ...f, requirements: e.target.value }))
              }
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500"
              rows={2}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 font-medium"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={createJobMutation.isPending}
              className="flex-1 py-2 rounded-xl bg-emerald-500 text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {createJobMutation.isPending && <Loader2 className="animate-spin" size={18} />}
              发布
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function BaseManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'list' | 'audit'>(
    user?.role === UserRole.SUPER_ADMIN ? 'audit' : 'list'
  );
  const [auditingId, setAuditingId] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [detailBaseId, setDetailBaseId] = useState<number | null>(null);
  const [showCreateJobModal, setShowCreateJobModal] = useState<number | null>(null);

  const { data: rawBases, isLoading: basesLoading, error: basesError } =
    useBaseControllerFindAll({
      request:
        user?.role === UserRole.SUPER_ADMIN
          ? { params: { showAll: true } }
          : user?.role === UserRole.BASE_MANAGER
          ? { params: { ownerId: user.id } }
          : undefined,
    });

  const bases = useMemo(() => {
    const list = Array.isArray(rawBases) ? rawBases : [];
    return list.map((b: any) => ({
      id: b.id,
      name: b.baseName ?? b.name ?? '-',
      cat: CAT_LABEL[b.category] ?? '其他',
      status: STATUS_LABEL[b.auditStatus] ?? '待审核',
      auditStatus: b.auditStatus,
      region: `区域${b.regionCode ?? '-'}`,
      contact: b.contactPhone
        ? `${String(b.contactPhone).slice(0, 3)}****${String(b.contactPhone).slice(-4)}`
        : '-',
      scale: b.address ? '详见地址' : '-',
    }));
  }, [rawBases]);

  const pendingBases = useMemo(
    () => bases.filter((b: any) => b.status === '待审核'),
    [bases]
  );

  const refetchBases = () =>
    queryClient.invalidateQueries({ queryKey: getBaseControllerFindAllQueryKey() });
  const refetchDetail = () => {
    if (detailBaseId != null) {
      queryClient.invalidateQueries({
        queryKey: getBaseControllerFindOneQueryKey(detailBaseId),
      });
      queryClient.invalidateQueries({
        queryKey: getBaseControllerGetJobsByBaseQueryKey(detailBaseId),
      });
    }
  };

  const handleAudit = async (baseId: number, status: 1 | 2) => {
    setAuditingId(baseId);
    try {
      await AXIOS_INSTANCE.patch(`/api/base/${baseId}/audit`, { status });
      refetchBases();
      alert(status === 1 ? '已通过核验' : '已驳回');
    } catch (e: any) {
      alert(e?.response?.data?.message ?? '操作失败');
    } finally {
      setAuditingId(null);
    }
  };

  const handleApplyEntry = () => setShowCreateModal(true);
  const handleBaseDetail = (baseId: number) => setDetailBaseId(baseId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">基地生态网络</h2>
          <p className="text-slate-400 text-sm">连接优质生产基地，优化用工资源配置。</p>
        </div>
        <div className="flex items-center gap-3">
          {user?.role === UserRole.SUPER_ADMIN && (
            <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl">
              <button 
                type="button"
                onClick={() => setActiveTab('list')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'list'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                全部基地
              </button>
              <button 
                type="button"
                onClick={() => setActiveTab('audit')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'audit'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                审核中 ({pendingBases.length})
              </button>
            </div>
          )}
          {(user?.role === UserRole.BASE_MANAGER) && (
            <button
              type="button"
              onClick={handleApplyEntry}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
            >
            <Plus size={18} />
            <span>申请入驻</span>
          </button>
          )}
        </div>
      </div>

      {user?.role === UserRole.SUPER_ADMIN && activeTab === 'audit' && (
        <p className="text-slate-500 text-sm">
          超级管理员：请在此审核基地提交的入驻申请，通过或驳回。
        </p>
      )}

      <AnimatePresence mode="wait">
        {activeTab === 'list' ? (
          <motion.div 
            key="list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {basesLoading ? (
              <div className="col-span-full flex items-center justify-center py-16">
                <Loader2 className="animate-spin text-emerald-500" size={32} />
                <span className="ml-3 text-slate-400">加载基地列表中...</span>
              </div>
            ) : basesError ? (
              <div className="col-span-full text-center py-8 text-amber-400">
                加载失败，请检查后端是否启动（
                {String((basesError as any)?.message || basesError)}）
              </div>
            ) : bases.length === 0 ? (
              <div className="col-span-full text-center py-12 text-slate-500">
                暂无基地数据，请先导入数据库或创建基地。
              </div>
            ) : null}
            {!basesLoading &&
              !basesError &&
              bases.map((base, i) => (
                <div
                  key={base.id ?? i}
                  className="glass-card rounded-[32px] overflow-hidden group border-slate-800/40"
                >
                <div className="h-40 bg-slate-900 relative">
                    <img
                      src={`https://picsum.photos/600/400?random=${(base.id ?? i) + 50}`}
                      className="w-full h-full object-cover opacity-30 group-hover:opacity-50 group-hover:scale-105 transition-all duration-700"
                      alt={base.name}
                    />
                  <div className="absolute top-4 left-4">
                    <div className="px-3 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-[10px] text-white font-bold flex items-center gap-1.5">
                        <Sprout size={12} /> {base.scale ?? '-'}
                    </div>
                  </div>
                  <div className="absolute top-4 right-4">
                      <span
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 backdrop-blur-md ${
                          base.status === '已通过'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : base.status === '待审核'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {base.status === '已通过' ? (
                          <CheckCircle2 size={12} />
                        ) : base.status === '待审核' ? (
                          <Clock size={12} />
                        ) : (
                          <AlertCircle size={12} />
                        )}
                      {base.status}
                    </span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="font-bold text-white text-lg group-hover:text-emerald-400 transition-colors leading-tight">
                          {base.name}
                        </h3>
                      <div className="flex gap-2 mt-2">
                          <span className="text-[10px] text-slate-500 font-bold tracking-widest uppercase bg-slate-800/50 px-2 py-0.5 rounded">
                            {base.cat}
                          </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <MapPin size={14} className="text-slate-600" />
                      {base.region}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Phone size={14} className="text-slate-600" />
                      {base.contact}
                    </div>
                  </div>

                  <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleBaseDetail(base.id)}
                        className="flex-1 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-800 transition-all"
                      >
                      运营档案
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        ) : (
          <motion.div 
            key="audit"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="glass-card rounded-[32px] p-6 border-slate-800/60"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-800/60 text-slate-500 text-xs uppercase tracking-widest font-bold">
                    <th className="pb-4 px-4">申请主体</th>
                    <th className="pb-4">经营类型</th>
                    <th className="pb-4">所属区域</th>
                    <th className="pb-4">附件材料</th>
                    <th className="pb-4">申请时间</th>
                    <th className="pb-4 text-right px-4">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {pendingBases.map((req: any, i: number) => (
                    <tr
                      key={req.id ?? i}
                      className="group hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-emerald-500 font-bold border border-slate-700/50 group-hover:border-emerald-500/30 transition-all">
                            {(req.name || '-')[0]}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-slate-100 font-bold">{req.name}</span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              ID {req.id}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-5 text-slate-400 text-sm font-medium">{req.cat}</td>
                      <td className="py-5 text-slate-400 text-sm">{req.region}</td>
                      <td className="py-5">
                        <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-400 text-xs border border-blue-500/20">
                          资质材料
                        </span>
                      </td>
                      <td className="py-5 text-slate-500 text-sm">—</td>
                      <td className="py-5 text-right px-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            disabled={auditingId === req.id}
                            onClick={() => handleAudit(req.id, 2)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition-all border border-slate-700/50 disabled:opacity-50"
                          >
                            驳回
                          </button>
                          <button
                            type="button"
                            disabled={auditingId === req.id}
                            onClick={() => handleAudit(req.id, 1)}
                            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold rounded-lg shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 flex items-center gap-1.5 justify-center"
                          >
                            {auditingId === req.id && <Loader2 className="animate-spin" size={14} />}
                            通过核验
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pendingBases.length === 0 && (
              <div className="py-20 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto mb-4 text-slate-700">
                  <ClipboardCheck size={32} />
                </div>
                <p className="text-slate-500 font-medium">暂无待审核的基地申请</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <CreateBaseModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          refetchBases();
          setShowCreateModal(false);
        }}
      />

      {detailBaseId != null && (
        <BaseDetailDrawer
          baseId={detailBaseId}
          onClose={() => setDetailBaseId(null)}
          onOpenCreateJob={() => setShowCreateJobModal(detailBaseId)}
        />
      )}

      {showCreateJobModal != null && (
        <CreateJobModal
          baseId={showCreateJobModal}
          onClose={() => setShowCreateJobModal(null)}
          onSuccess={() => {
            refetchDetail();
            setShowCreateJobModal(null);
          }}
        />
      )}
    </div>
  );
}