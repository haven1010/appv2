import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  ShieldX,
  Users,
  Sprout,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Filter,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AXIOS_INSTANCE } from '../lib/http';

type AuditTab = 'users' | 'bases';

interface PendingUser {
  id: number;
  uid: string;
  name: string;
  phone: string;
  idCard: string;
  roleKey: string;
  emergencyContact: string;
  emergencyPhone: string;
  infoAuditStatus: number;
  createdAt: string;
}

interface PendingBase {
  id: number;
  baseName: string;
  category: number;
  regionCode: number;
  address: string;
  contactPerson: string;
  contactPhone: string;
  auditStatus: number;
  createdAt: string;
}

const ROLE_MAP: Record<string, string> = {
  super_admin: '超级管理员',
  region_admin: '区域管理员',
  base_manager: '基地管理员',
  field_manager: '现场管理员',
  worker: '采摘工',
};

const CATEGORY_MAP: Record<number, string> = { 1: '水果类', 2: '蔬菜类', 3: '其他' };

export default function AuditCenter() {
  const [tab, setTab] = useState<AuditTab>('users');
  const [loading, setLoading] = useState(false);

  // User audit
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userPage, setUserPage] = useState(1);

  // Base audit
  const [bases, setBases] = useState<PendingBase[]>([]);
  const [baseTotal, setBaseTotal] = useState(0);
  const [basePage, setBasePage] = useState(1);

  // Detail modal
  const [detailUser, setDetailUser] = useState<PendingUser | null>(null);
  const [detailBase, setDetailBase] = useState<PendingBase | null>(null);

  // Counts
  const [pendingUserCount, setPendingUserCount] = useState(0);
  const [pendingBaseCount, setPendingBaseCount] = useState(0);

  const pageSize = 10;

  const loadPendingUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await AXIOS_INSTANCE.get('/api/user/list', {
        params: { status: 0, page: userPage, pageSize },
      });
      setUsers(res.data.list || []);
      setUserTotal(res.data.total || 0);
      setPendingUserCount(res.data.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [userPage]);

  const loadPendingBases = useCallback(async () => {
    setLoading(true);
    try {
      const res = await AXIOS_INSTANCE.get('/api/base', {
        params: { showAll: true },
      });
      const all: PendingBase[] = Array.isArray(res.data) ? res.data : [];
      const pending = all.filter((b) => b.auditStatus === 0);
      setPendingBaseCount(pending.length);
      const start = (basePage - 1) * pageSize;
      setBases(pending.slice(start, start + pageSize));
      setBaseTotal(pending.length);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [basePage]);

  useEffect(() => {
    loadPendingUsers();
    loadPendingBases();
  }, []);

  useEffect(() => {
    if (tab === 'users') loadPendingUsers();
  }, [userPage, loadPendingUsers]);

  useEffect(() => {
    if (tab === 'bases') loadPendingBases();
  }, [basePage, loadPendingBases]);

  async function handleUserAudit(userId: number, status: number) {
    try {
      await AXIOS_INSTANCE.patch(`/api/user/${userId}/audit`, { status });
      loadPendingUsers();
      setDetailUser(null);
    } catch (err: any) {
      alert(err?.response?.data?.message || '操作失败');
    }
  }

  async function handleBaseAudit(baseId: number, status: number) {
    try {
      await AXIOS_INSTANCE.patch(`/api/base/${baseId}/audit`, { status });
      loadPendingBases();
      setDetailBase(null);
    } catch (err: any) {
      alert(err?.response?.data?.message || '操作失败');
    }
  }

  const userTotalPages = Math.ceil(userTotal / pageSize);
  const baseTotalPages = Math.ceil(baseTotal / pageSize);

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">审核中心</h2>
        <p className="text-slate-400">统一审核用户信息和基地入驻申请</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          onClick={() => setTab('users')}
          className={`p-5 rounded-2xl border cursor-pointer transition-all ${
            tab === 'users'
              ? 'bg-amber-500/10 border-amber-500/30'
              : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${tab === 'users' ? 'bg-amber-500/20' : 'bg-slate-800'}`}>
              <Users className={tab === 'users' ? 'text-amber-400' : 'text-slate-400'} size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-400">待审核用户</p>
              <p className="text-2xl font-bold text-white">{pendingUserCount}</p>
            </div>
            {pendingUserCount > 0 && (
              <div className="ml-auto">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-medium">
                  <AlertTriangle size={12} /> 待处理
                </span>
              </div>
            )}
          </div>
        </div>
        <div
          onClick={() => setTab('bases')}
          className={`p-5 rounded-2xl border cursor-pointer transition-all ${
            tab === 'bases'
              ? 'bg-blue-500/10 border-blue-500/30'
              : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${tab === 'bases' ? 'bg-blue-500/20' : 'bg-slate-800'}`}>
              <Sprout className={tab === 'bases' ? 'text-blue-400' : 'text-slate-400'} size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-400">待审核基地</p>
              <p className="text-2xl font-bold text-white">{pendingBaseCount}</p>
            </div>
            {pendingBaseCount > 0 && (
              <div className="ml-auto">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-medium">
                  <AlertTriangle size={12} /> 待处理
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="glass-card rounded-3xl border border-slate-800/60 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-emerald-400" size={28} />
            <span className="ml-3 text-slate-400">加载中...</span>
          </div>
        ) : tab === 'users' ? (
          /* ===== User Audit Table ===== */
          <div>
            <div className="px-6 pt-6 pb-4 border-b border-slate-800/60">
              <h3 className="text-lg font-bold text-white">用户信息审核</h3>
              <p className="text-sm text-slate-400 mt-1">审核用户提交的实名信息变更</p>
            </div>
            {users.length === 0 ? (
              <div className="py-20 text-center">
                <CheckCircle2 className="mx-auto text-emerald-500 mb-3" size={40} />
                <p className="text-slate-400">暂无待审核用户</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-800/60 text-slate-500 text-xs uppercase tracking-wider">
                        <th className="px-6 py-4 font-semibold">用户</th>
                        <th className="px-6 py-4 font-semibold">UID</th>
                        <th className="px-6 py-4 font-semibold">角色</th>
                        <th className="px-6 py-4 font-semibold">手机号</th>
                        <th className="px-6 py-4 font-semibold">提交时间</th>
                        <th className="px-6 py-4 font-semibold text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {users.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-white">
                                {u.name?.[0]}
                              </div>
                              <span className="font-medium text-slate-100">{u.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-400 text-sm font-mono">{u.uid}</td>
                          <td className="px-6 py-4 text-slate-400 text-sm">{ROLE_MAP[u.roleKey] || u.roleKey}</td>
                          <td className="px-6 py-4 text-slate-400 text-sm">{u.phone}</td>
                          <td className="px-6 py-4 text-slate-500 text-sm">{u.createdAt?.slice(0, 10)}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setDetailUser(u)}
                                className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                                title="查看详情"
                              >
                                <Eye size={16} />
                              </button>
                              <button
                                onClick={() => handleUserAudit(u.id, 1)}
                                className="p-2 rounded-lg hover:bg-emerald-500/20 text-emerald-400 transition-colors"
                                title="通过"
                              >
                                <ShieldCheck size={16} />
                              </button>
                              <button
                                onClick={() => handleUserAudit(u.id, 2)}
                                className="p-2 rounded-lg hover:bg-rose-500/20 text-rose-400 transition-colors"
                                title="拒绝"
                              >
                                <ShieldX size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {userTotalPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800/60">
                    <span className="text-sm text-slate-500">共 {userTotal} 条</span>
                    <div className="flex items-center gap-2">
                      <button disabled={userPage <= 1} onClick={() => setUserPage((p) => p - 1)} className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30">
                        <ChevronLeft size={16} />
                      </button>
                      <span className="text-sm text-slate-300">{userPage} / {userTotalPages}</span>
                      <button disabled={userPage >= userTotalPages} onClick={() => setUserPage((p) => p + 1)} className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30">
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          /* ===== Base Audit Table ===== */
          <div>
            <div className="px-6 pt-6 pb-4 border-b border-slate-800/60">
              <h3 className="text-lg font-bold text-white">基地入驻审核</h3>
              <p className="text-sm text-slate-400 mt-1">审核基地经营方提交的入驻申请</p>
            </div>
            {bases.length === 0 ? (
              <div className="py-20 text-center">
                <CheckCircle2 className="mx-auto text-emerald-500 mb-3" size={40} />
                <p className="text-slate-400">暂无待审核基地</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-800/60 text-slate-500 text-xs uppercase tracking-wider">
                        <th className="px-6 py-4 font-semibold">基地名称</th>
                        <th className="px-6 py-4 font-semibold">类型</th>
                        <th className="px-6 py-4 font-semibold">地址</th>
                        <th className="px-6 py-4 font-semibold">联系人</th>
                        <th className="px-6 py-4 font-semibold">申请时间</th>
                        <th className="px-6 py-4 font-semibold text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {bases.map((b) => (
                        <tr key={b.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-6 py-4 font-medium text-slate-100">{b.baseName}</td>
                          <td className="px-6 py-4 text-slate-400 text-sm">{CATEGORY_MAP[b.category] || '其他'}</td>
                          <td className="px-6 py-4 text-slate-400 text-sm max-w-[200px] truncate">{b.address || '-'}</td>
                          <td className="px-6 py-4 text-slate-400 text-sm">{b.contactPerson || '-'}</td>
                          <td className="px-6 py-4 text-slate-500 text-sm">{b.createdAt?.slice(0, 10)}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setDetailBase(b)}
                                className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                                title="查看详情"
                              >
                                <Eye size={16} />
                              </button>
                              <button
                                onClick={() => handleBaseAudit(b.id, 1)}
                                className="p-2 rounded-lg hover:bg-emerald-500/20 text-emerald-400 transition-colors"
                                title="通过"
                              >
                                <ShieldCheck size={16} />
                              </button>
                              <button
                                onClick={() => handleBaseAudit(b.id, 2)}
                                className="p-2 rounded-lg hover:bg-rose-500/20 text-rose-400 transition-colors"
                                title="拒绝"
                              >
                                <ShieldX size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {baseTotalPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800/60">
                    <span className="text-sm text-slate-500">共 {baseTotal} 条</span>
                    <div className="flex items-center gap-2">
                      <button disabled={basePage <= 1} onClick={() => setBasePage((p) => p - 1)} className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30">
                        <ChevronLeft size={16} />
                      </button>
                      <span className="text-sm text-slate-300">{basePage} / {baseTotalPages}</span>
                      <button disabled={basePage >= baseTotalPages} onClick={() => setBasePage((p) => p + 1)} className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30">
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* User Detail Modal */}
      <AnimatePresence>
        {detailUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
            onClick={() => setDetailUser(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-lg w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-white mb-6">用户详情</h3>
              <div className="space-y-4">
                {[
                  ['姓名', detailUser.name],
                  ['UID', detailUser.uid],
                  ['角色', ROLE_MAP[detailUser.roleKey] || detailUser.roleKey],
                  ['手机号', detailUser.phone],
                  ['身份证号', detailUser.idCard],
                  ['紧急联系人', detailUser.emergencyContact || '-'],
                  ['紧急联系电话', detailUser.emergencyPhone || '-'],
                  ['注册时间', detailUser.createdAt?.slice(0, 19)?.replace('T', ' ')],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between items-center py-2 border-b border-slate-800/50">
                    <span className="text-slate-400 text-sm">{label}</span>
                    <span className="text-white text-sm font-medium">{value}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => handleUserAudit(detailUser.id, 1)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition-colors"
                >
                  <ShieldCheck size={18} /> 通过审核
                </button>
                <button
                  onClick={() => handleUserAudit(detailUser.id, 2)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-medium transition-colors"
                >
                  <ShieldX size={18} /> 拒绝
                </button>
                <button
                  onClick={() => setDetailUser(null)}
                  className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition-colors"
                >
                  关闭
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Base Detail Modal */}
      <AnimatePresence>
        {detailBase && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
            onClick={() => setDetailBase(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-lg w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-white mb-6">基地详情</h3>
              <div className="space-y-4">
                {[
                  ['基地名称', detailBase.baseName],
                  ['经营类型', CATEGORY_MAP[detailBase.category] || '其他'],
                  ['区域代码', detailBase.regionCode?.toString() || '-'],
                  ['详细地址', detailBase.address || '-'],
                  ['联系人', detailBase.contactPerson || '-'],
                  ['联系电话', detailBase.contactPhone || '-'],
                  ['申请时间', detailBase.createdAt?.slice(0, 19)?.replace('T', ' ')],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between items-center py-2 border-b border-slate-800/50">
                    <span className="text-slate-400 text-sm">{label}</span>
                    <span className="text-white text-sm font-medium">{value}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => handleBaseAudit(detailBase.id, 1)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition-colors"
                >
                  <ShieldCheck size={18} /> 批准入驻
                </button>
                <button
                  onClick={() => handleBaseAudit(detailBase.id, 2)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-medium transition-colors"
                >
                  <ShieldX size={18} /> 拒绝
                </button>
                <button
                  onClick={() => setDetailBase(null)}
                  className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition-colors"
                >
                  关闭
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
