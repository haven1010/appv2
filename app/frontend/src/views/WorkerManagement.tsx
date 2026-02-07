import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Search,
  Filter,
  Download,
  UserPlus,
  MoreHorizontal,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Scan,
  Loader2,
  ChevronLeft,
  ChevronRight,
  X,
  Eye,
  ShieldCheck,
  ShieldX,
  Trash2,
  Users,
  Sprout,
  Shield,
  Briefcase,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AXIOS_INSTANCE } from '../lib/http';

interface UserItem {
  id: number;
  uid: string;
  name: string;
  phone: string;
  idCard: string;
  roleKey: string;
  emergencyContact: string;
  emergencyPhone: string;
  infoAuditStatus: number;
  regionCode: number | null;
  assignedBaseId: number | null;
  createdAt: string;
  updatedAt: string;
  // enriched client-side
  _managedBases?: { id: number; baseName: string }[];
  _assignedBaseName?: string;
}

interface UserListResponse {
  list: UserItem[];
  total: number;
  page: number;
  pageSize: number;
}

const ROLE_MAP: Record<string, { label: string; avatarCls: string; badgeCls: string; icon: React.ElementType }> = {
  super_admin: { label: '超级管理员', avatarCls: 'bg-amber-500/10 text-amber-400', badgeCls: 'bg-amber-500/10 text-amber-400', icon: Shield },
  region_admin: { label: '超级管理员', avatarCls: 'bg-amber-500/10 text-amber-400', badgeCls: 'bg-amber-500/10 text-amber-400', icon: Shield },
  base_manager: { label: '基地管理员', avatarCls: 'bg-blue-500/10 text-blue-400', badgeCls: 'bg-blue-500/10 text-blue-400', icon: Sprout },
  field_manager: { label: '现场管理员', avatarCls: 'bg-cyan-500/10 text-cyan-400', badgeCls: 'bg-cyan-500/10 text-cyan-400', icon: Briefcase },
  worker: { label: '采摘工', avatarCls: 'bg-emerald-500/10 text-emerald-400', badgeCls: 'bg-emerald-500/10 text-emerald-400', icon: Users },
};

const ROLE_TABS = [
  { key: '', label: '全部用户', icon: Users },
  { key: 'super_admin', label: '超级管理员', icon: Shield },
  { key: 'base_manager', label: '基地管理员', icon: Sprout },
  { key: 'field_manager', label: '现场管理员', icon: Briefcase },
  { key: 'worker', label: '采摘工', icon: Users },
];

export default function WorkerManagement() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailUser, setDetailUser] = useState<UserItem | null>(null);
  const [activeStep, setActiveStep] = useState(1);

  // List state
  const [users, setUsers] = useState<UserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [loading, setLoading] = useState(true);

  // Filters
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Role tab counts
  const [roleCounts, setRoleCounts] = useState<Record<string, number>>({});

  // Add form state
  const [addForm, setAddForm] = useState({
    name: '',
    idCard: '',
    phone: '',
    emergencyContact: '',
    emergencyPhone: '',
    roleKey: 'worker',
  });
  const [addLoading, setAddLoading] = useState(false);
  const [addResult, setAddResult] = useState<{ uid: string; name: string } | null>(null);

  // Action menu
  const [actionMenuId, setActionMenuId] = useState<number | null>(null);

  // All bases cache (for enriching base_manager / field_manager info)
  const [basesCache, setBasesCache] = useState<{ id: number; baseName: string; ownerId: number }[]>([]);

  // Load bases cache
  useEffect(() => {
    AXIOS_INSTANCE.get('/api/base', { params: { showAll: true } })
      .then((res) => setBasesCache(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, []);

  // Load role counts
  useEffect(() => {
    AXIOS_INSTANCE.get('/api/user/stats')
      .then((res) => {
        const d = res.data;
        setRoleCounts({
          '': d.totalUsers || 0,
          worker: d.totalWorkers || 0,
          super_admin: d.totalAdmins || 0, // approximate
        });
      })
      .catch(() => {});
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, pageSize };
      if (roleFilter) params.role = roleFilter;
      if (keyword) params.keyword = keyword;
      if (statusFilter !== '') params.status = statusFilter;

      const res = await AXIOS_INSTANCE.get<UserListResponse>('/api/user/list', { params });
      setUsers(res.data.list || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error('Load users error:', err);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, keyword, statusFilter, roleFilter]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Enrich users with base info
  function enrichUser(u: UserItem): UserItem {
    if (u.roleKey === 'base_manager' && basesCache.length > 0) {
      u._managedBases = basesCache.filter((b) => b.ownerId === Number(u.id));
    }
    if (u.roleKey === 'field_manager' && u.assignedBaseId && basesCache.length > 0) {
      const base = basesCache.find((b) => b.id === Number(u.assignedBaseId));
      u._assignedBaseName = base?.baseName || `基地#${u.assignedBaseId}`;
    }
    return u;
  }

  function handleSearch() {
    setPage(1);
    setKeyword(searchInput);
  }

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSearch();
  }

  function maskIdCard(id: string): string {
    if (!id || id.length < 10) return id || '';
    return id.slice(0, 6) + '********' + id.slice(-4);
  }

  function maskPhone(phone: string): string {
    if (!phone || phone.length < 7) return phone || '';
    return phone.slice(0, 3) + '****' + phone.slice(-4);
  }

  function auditStatusText(status: number): string {
    if (status === 1) return '已认证';
    if (status === 0) return '待审核';
    if (status === 2) return '已驳回';
    return '-';
  }

  function auditStatusClass(status: number): string {
    if (status === 1) return 'bg-emerald-500/10 text-emerald-400';
    if (status === 0) return 'bg-amber-500/10 text-amber-400';
    if (status === 2) return 'bg-rose-500/10 text-rose-400';
    return 'bg-slate-500/10 text-slate-400';
  }

  function getRoleInfo(roleKey: string) {
    return ROLE_MAP[roleKey] || { label: roleKey, avatarCls: 'bg-slate-500/10 text-slate-400', badgeCls: 'bg-slate-500/10 text-slate-400', icon: Users };
  }

  async function handleAudit(userId: number, status: number) {
    try {
      await AXIOS_INSTANCE.patch(`/api/user/${userId}/audit`, { status });
      loadUsers();
      setActionMenuId(null);
      if (showDetailModal && detailUser?.id === userId) {
        setDetailUser({ ...detailUser, infoAuditStatus: status });
      }
    } catch (err) {
      console.error('Audit error:', err);
    }
  }

  async function handleDelete(userId: number) {
    if (!confirm('确定要删除此用户吗？此操作不可逆。')) return;
    try {
      await AXIOS_INSTANCE.delete(`/api/user/${userId}`);
      loadUsers();
      setActionMenuId(null);
    } catch (err) {
      console.error('Delete error:', err);
    }
  }

  async function handleAddUser() {
    const { name, idCard, phone } = addForm;
    if (!name.trim()) { alert('请输入姓名'); return; }
    if (!idCard || idCard.length !== 18) { alert('请输入18位身份证号'); return; }
    if (!phone || phone.length !== 11) { alert('请输入11位手机号'); return; }

    setAddLoading(true);
    try {
      const res = await AXIOS_INSTANCE.post('/api/user/register', addForm);
      setAddResult({ uid: res.data.uid, name: res.data.name });
      setActiveStep(3);
      loadUsers();
    } catch (err: any) {
      const msg = err.response?.data?.message || '注册失败';
      alert(Array.isArray(msg) ? msg.join(' ') : msg);
    } finally {
      setAddLoading(false);
    }
  }

  function resetAddModal() {
    setShowAddModal(false);
    setActiveStep(1);
    setAddForm({ name: '', idCard: '', phone: '', emergencyContact: '', emergencyPhone: '', roleKey: 'worker' });
    setAddResult(null);
  }

  function handleExportCSV() {
    const headers = ['UID', '姓名', '角色', '手机号', '身份证', '紧急联系人', '状态', '注册时间'];
    const rows = users.map(w => [
      w.uid,
      w.name,
      getRoleInfo(w.roleKey).label,
      w.phone,
      maskIdCard(w.idCard),
      w.emergencyContact || '-',
      auditStatusText(w.infoAuditStatus),
      w.createdAt?.slice(0, 10) || '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `用户列表_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function openDetail(u: UserItem) {
    setDetailUser(enrichUser({ ...u }));
    setShowDetailModal(true);
    setActionMenuId(null);
  }

  const totalPages = Math.ceil(total / pageSize);

  const steps = [
    { num: 1, title: '选择方式', icon: Scan },
    { num: 2, title: '填写信息', icon: AlertCircle },
    { num: 3, title: '完成注册', icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">用户管理</h2>
          <p className="text-slate-400 text-sm">管理系统全部用户，按角色分类查看。共 {total} 条记录。</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl transition-all border border-slate-700/50"
          >
            <Download size={18} />
            <span>导出</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
          >
            <Plus size={18} />
            <span>新增用户</span>
          </button>
        </div>
      </div>

      {/* Role Tabs */}
      <div className="flex flex-wrap gap-2">
        {ROLE_TABS.map((tab) => {
          const isActive = roleFilter === tab.key;
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => { setRoleFilter(tab.key); setPage(1); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20'
                  : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-700/50'
              }`}
            >
              <TabIcon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main Card */}
      <div className="glass-card rounded-3xl p-6 border border-slate-800/60">
        {/* Search and Filter */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              type="text"
              placeholder="搜索姓名或UID..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSearch}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-xl text-slate-300 text-sm border border-slate-700/50 hover:bg-slate-700"
            >
              <Filter size={16} /> 搜索
            </button>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="bg-slate-800 border border-slate-700/50 rounded-xl px-4 py-2 text-sm text-slate-300 focus:outline-none"
            >
              <option value="">全部状态</option>
              <option value="1">已认证</option>
              <option value="0">待审核</option>
              <option value="2">已驳回</option>
            </select>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-emerald-400" size={24} />
            <span className="ml-2 text-slate-400">加载中...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-800/60 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="pb-4 font-semibold px-4">用户</th>
                  <th className="pb-4 font-semibold">角色</th>
                  <th className="pb-4 font-semibold">UID</th>
                  <th className="pb-4 font-semibold">角色关联</th>
                  <th className="pb-4 font-semibold">状态</th>
                  <th className="pb-4 font-semibold">注册时间</th>
                  <th className="pb-4 font-semibold text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {users.length > 0 ? users.map((row) => {
                  const ri = getRoleInfo(row.roleKey);
                  const enriched = enrichUser({ ...row });
                  return (
                    <tr key={row.id} className="group hover:bg-slate-800/20 transition-colors">
                      <td className="py-5 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${ri.avatarCls}`}>
                            {row.name?.[0] || '?'}
                          </div>
                          <div>
                            <p className="text-slate-100 font-medium">{row.name}</p>
                            <p className="text-slate-500 text-xs">{maskPhone(row.phone)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${ri.badgeCls}`}>
                          <ri.icon size={12} />
                          {ri.label}
                        </span>
                      </td>
                      <td className="py-5">
                        <code className="text-xs bg-slate-900 px-2 py-1 rounded border border-slate-700/50 text-emerald-400">{row.uid}</code>
                      </td>
                      <td className="py-5 text-sm">
                        {row.roleKey === 'base_manager' ? (
                          enriched._managedBases && enriched._managedBases.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {enriched._managedBases.slice(0, 2).map((b) => (
                                <span key={b.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-xs">
                                  <Sprout size={10} />{b.baseName}
                                </span>
                              ))}
                              {enriched._managedBases.length > 2 && (
                                <span className="text-slate-500 text-xs">+{enriched._managedBases.length - 2}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-500 text-xs">暂无基地</span>
                          )
                        ) : row.roleKey === 'field_manager' ? (
                          enriched._assignedBaseName ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 text-xs">
                              <Sprout size={10} />{enriched._assignedBaseName}
                            </span>
                          ) : (
                            <span className="text-slate-500 text-xs">未分配基地</span>
                          )
                        ) : row.roleKey === 'super_admin' || row.roleKey === 'region_admin' ? (
                          <span className="text-amber-400/70 text-xs">全局权限</span>
                        ) : (
                          <span className="text-slate-500 text-xs">-</span>
                        )}
                      </td>
                      <td className="py-5">
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${auditStatusClass(row.infoAuditStatus)}`}>
                          {auditStatusText(row.infoAuditStatus)}
                        </span>
                      </td>
                      <td className="py-5 text-slate-500 text-sm">{row.createdAt?.slice(0, 10)}</td>
                      <td className="py-5 text-right px-4 relative">
                        <button
                          onClick={() => setActionMenuId(actionMenuId === row.id ? null : row.id)}
                          className="p-2 text-slate-500 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-all"
                        >
                          <MoreHorizontal size={18} />
                        </button>
                        {actionMenuId === row.id && (
                          <div className="absolute right-4 top-14 z-50 w-40 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
                            <button
                              onClick={() => openDetail(row)}
                              className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                            >
                              <Eye size={14} /> 查看详情
                            </button>
                            {row.infoAuditStatus !== 1 && (
                              <button
                                onClick={() => handleAudit(row.id, 1)}
                                className="w-full text-left px-4 py-2.5 text-sm text-emerald-400 hover:bg-slate-700 flex items-center gap-2"
                              >
                                <ShieldCheck size={14} /> 通过审核
                              </button>
                            )}
                            {row.infoAuditStatus !== 2 && (
                              <button
                                onClick={() => handleAudit(row.id, 2)}
                                className="w-full text-left px-4 py-2.5 text-sm text-amber-400 hover:bg-slate-700 flex items-center gap-2"
                              >
                                <ShieldX size={14} /> 驳回审核
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(row.id)}
                              className="w-full text-left px-4 py-2.5 text-sm text-rose-400 hover:bg-slate-700 flex items-center gap-2"
                            >
                              <Trash2 size={14} /> 删除用户
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-slate-500">
                      暂无用户数据
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-800/40">
            <span className="text-sm text-slate-500">
              第 {page}/{totalPages} 页，共 {total} 条
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg bg-slate-800 text-slate-300 disabled:opacity-30 hover:bg-slate-700"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg bg-slate-800 text-slate-300 disabled:opacity-30 hover:bg-slate-700"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {showDetailModal && detailUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDetailModal(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl relative z-10 overflow-hidden max-h-[85vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-slate-800 flex justify-between items-center sticky top-0 bg-slate-900 z-10">
                <h3 className="text-lg font-bold text-white">用户详情</h3>
                <button onClick={() => setShowDetailModal(false)} className="text-slate-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-5">
                {/* User header */}
                <div className="flex items-center gap-4">
                  {(() => {
                    const ri = getRoleInfo(detailUser.roleKey);
                    return (
                      <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold ${ri.avatarCls}`}>
                        {detailUser.name?.[0] || '?'}
                      </div>
                    );
                  })()}
                  <div className="flex-1">
                    <h4 className="text-white font-bold text-lg">{detailUser.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      {(() => {
                        const ri = getRoleInfo(detailUser.roleKey);
                        return (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium ${ri.badgeCls}`}>
                            <ri.icon size={10} />{ri.label}
                          </span>
                        );
                      })()}
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${auditStatusClass(detailUser.infoAuditStatus)}`}>
                        {auditStatusText(detailUser.infoAuditStatus)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Basic Info */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">基本信息</p>
                  {[
                    { label: 'UID', value: detailUser.uid },
                    { label: '手机号', value: detailUser.phone },
                    { label: '身份证号', value: maskIdCard(detailUser.idCard) },
                    { label: '紧急联系人', value: detailUser.emergencyContact || '-' },
                    { label: '紧急联系电话', value: detailUser.emergencyPhone || '-' },
                    { label: '注册时间', value: detailUser.createdAt?.slice(0, 19)?.replace('T', ' ') },
                  ].map((item, i) => (
                    <div key={i} className="flex justify-between py-2 border-b border-slate-800/40">
                      <span className="text-slate-400 text-sm">{item.label}</span>
                      <span className="text-slate-100 text-sm font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>

                {/* Role-specific Info */}
                {(detailUser.roleKey === 'base_manager' || detailUser.roleKey === 'field_manager' || detailUser.roleKey === 'super_admin' || detailUser.roleKey === 'region_admin') && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">角色信息</p>

                    {(detailUser.roleKey === 'super_admin' || detailUser.roleKey === 'region_admin') && (
                      <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20">
                        <div className="flex items-center gap-2 text-amber-400 text-sm font-medium">
                          <Shield size={16} /> 全局管理权限
                        </div>
                        <p className="text-slate-400 text-xs mt-1">可管理平台所有用户、基地、薪资、考勤数据</p>
                        {detailUser.regionCode && (
                          <p className="text-slate-400 text-xs mt-1">区域代码: {detailUser.regionCode}</p>
                        )}
                      </div>
                    )}

                    {detailUser.roleKey === 'base_manager' && (
                      <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20">
                        <div className="flex items-center gap-2 text-blue-400 text-sm font-medium mb-2">
                          <Sprout size={16} /> 管理的基地
                        </div>
                        {detailUser._managedBases && detailUser._managedBases.length > 0 ? (
                          <div className="space-y-2">
                            {detailUser._managedBases.map((b) => (
                              <div key={b.id} className="flex items-center gap-2 text-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                                <span className="text-slate-200">{b.baseName}</span>
                                <span className="text-slate-500 text-xs">#{b.id}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-slate-500 text-xs">暂未创建或拥有基地</p>
                        )}
                      </div>
                    )}

                    {detailUser.roleKey === 'field_manager' && (
                      <div className="p-4 rounded-2xl bg-cyan-500/5 border border-cyan-500/20">
                        <div className="flex items-center gap-2 text-cyan-400 text-sm font-medium mb-2">
                          <Briefcase size={16} /> 关联基地
                        </div>
                        {detailUser._assignedBaseName ? (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                            <span className="text-slate-200">{detailUser._assignedBaseName}</span>
                            <span className="text-slate-500 text-xs">#{detailUser.assignedBaseId}</span>
                          </div>
                        ) : (
                          <p className="text-slate-500 text-xs">未分配关联基地</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Worker specific: could show attendance summary in the future */}
                {detailUser.roleKey === 'worker' && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">采摘工信息</p>
                    <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
                      <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                        <Users size={16} /> 终端用户
                      </div>
                      <p className="text-slate-400 text-xs mt-1">使用小程序浏览岗位、报名、签到、确认工资</p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  {detailUser.infoAuditStatus !== 1 && (
                    <button
                      onClick={() => handleAudit(detailUser.id, 1)}
                      className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-xl transition-all text-sm flex items-center justify-center gap-2"
                    >
                      <ShieldCheck size={16} /> 通过审核
                    </button>
                  )}
                  {detailUser.infoAuditStatus !== 2 && (
                    <button
                      onClick={() => handleAudit(detailUser.id, 2)}
                      className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-white font-semibold rounded-xl transition-all text-sm flex items-center justify-center gap-2"
                    >
                      <ShieldX size={16} /> 驳回
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add User Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={resetAddModal}
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
                  新增用户
                </h3>
                <button onClick={resetAddModal} className="text-slate-400 hover:text-white">
                  <X size={24} />
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
                        onClick={() => setActiveStep(2)}
                        className="flex flex-col items-center justify-center p-8 rounded-2xl bg-slate-800/50 border-2 border-dashed border-slate-700 hover:border-emerald-500 hover:bg-emerald-500/5 transition-all group"
                      >
                        <Scan size={48} className="text-slate-500 group-hover:text-emerald-400 mb-4" />
                        <span className="font-bold text-slate-200">快速录入</span>
                        <span className="text-xs text-slate-500 mt-2">直接填写用户信息</span>
                      </button>
                      <button className="flex flex-col items-center justify-center p-8 rounded-2xl bg-slate-800/50 border-2 border-dashed border-slate-700 opacity-50 cursor-not-allowed">
                        <Smartphone size={48} className="text-slate-500 mb-4" />
                        <span className="font-bold text-slate-200">OCR拍照录入</span>
                        <span className="text-xs text-slate-500 mt-2">需配置OCR服务（即将上线）</span>
                      </button>
                    </div>
                  </div>
                )}

                {activeStep === 2 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs text-slate-500 font-semibold uppercase">真实姓名 *</label>
                        <input
                          type="text"
                          value={addForm.name}
                          onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                          placeholder="请输入姓名"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-slate-500 font-semibold uppercase">身份证号 *</label>
                        <input
                          type="text"
                          value={addForm.idCard}
                          onChange={(e) => setAddForm({ ...addForm, idCard: e.target.value })}
                          placeholder="18位身份证号"
                          maxLength={18}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-slate-500 font-semibold uppercase">手机号码 *</label>
                        <input
                          type="text"
                          value={addForm.phone}
                          onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                          placeholder="11位手机号"
                          maxLength={11}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-slate-500 font-semibold uppercase">角色</label>
                        <select
                          value={addForm.roleKey}
                          onChange={(e) => setAddForm({ ...addForm, roleKey: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        >
                          <option value="worker">采摘工</option>
                          <option value="field_manager">现场管理员</option>
                          <option value="base_manager">基地管理员</option>
                          <option value="super_admin">超级管理员</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-slate-500 font-semibold uppercase">紧急联系人</label>
                        <input
                          type="text"
                          value={addForm.emergencyContact}
                          onChange={(e) => setAddForm({ ...addForm, emergencyContact: e.target.value })}
                          placeholder="姓名及关系"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-slate-500 font-semibold uppercase">紧急联系人电话</label>
                        <input
                          type="text"
                          value={addForm.emergencyPhone}
                          onChange={(e) => setAddForm({ ...addForm, emergencyPhone: e.target.value })}
                          placeholder="11位手机号"
                          maxLength={11}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                    <div className="pt-6 flex gap-3">
                      <button
                        onClick={() => setActiveStep(1)}
                        className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all"
                      >
                        返回
                      </button>
                      <button
                        onClick={handleAddUser}
                        disabled={addLoading}
                        className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {addLoading && <Loader2 className="animate-spin" size={16} />}
                        保存并提交
                      </button>
                    </div>
                  </motion.div>
                )}

                {activeStep === 3 && (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6">
                      <CheckCircle2 size={48} className="text-emerald-500" />
                    </div>
                    <h4 className="text-2xl font-bold text-white mb-2">用户创建成功</h4>
                    <p className="text-slate-400 mb-8 max-w-sm">
                      用户信息已通过系统核验并加密存储。
                      {addResult && (
                        <>
                          <br />
                          UID: <span className="text-emerald-400 font-mono">{addResult.uid}</span>
                        </>
                      )}
                    </p>
                    <button
                      onClick={resetAddModal}
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
