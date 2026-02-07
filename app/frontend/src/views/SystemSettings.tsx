import React, { useState, useEffect } from 'react';
import {
  Settings,
  Server,
  Database,
  Users,
  Sprout,
  Shield,
  Clock,
  Activity,
  Loader2,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { AXIOS_INSTANCE } from '../lib/http';

interface SystemStats {
  users: { total: number; workers: number; admins: number; pending: number };
  bases: { total: number; approved: number; pending: number };
  logs: { total: number; today: number };
}

export default function SystemSettings() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<SystemStats | null>(null);

  useEffect(() => {
    loadSystemInfo();
  }, []);

  async function loadSystemInfo() {
    setLoading(true);
    try {
      const [userStats, dashStats, logStats] = await Promise.all([
        AXIOS_INSTANCE.get('/api/user/stats').catch(() => ({ data: {} })),
        AXIOS_INSTANCE.get('/api/dashboard/stats').catch(() => ({ data: {} })),
        AXIOS_INSTANCE.get('/api/operation-log/stats').catch(() => ({ data: { total: 0, todayCount: 0 } })),
      ]);

      setStats({
        users: {
          total: userStats.data.totalUsers || 0,
          workers: userStats.data.totalWorkers || 0,
          admins: userStats.data.totalAdmins || 0,
          pending: userStats.data.pendingAudit || 0,
        },
        bases: {
          total: dashStats.data.allBases || 0,
          approved: dashStats.data.totalBases || 0,
          pending: dashStats.data.pendingAuditBases || 0,
        },
        logs: {
          total: logStats.data.total || 0,
          today: logStats.data.todayCount || 0,
        },
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-emerald-400" size={32} />
        <span className="ml-3 text-slate-400">加载中...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">系统设置</h2>
        <p className="text-slate-400">平台信息概览与系统配置</p>
      </div>

      {/* System Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Platform Info */}
        <div className="glass-card p-6 rounded-3xl border border-slate-800/60">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-2xl bg-emerald-500/10">
              <Info className="text-emerald-400" size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">平台信息</h3>
              <p className="text-sm text-slate-400">采摘工管理系统</p>
            </div>
          </div>
          <div className="space-y-4">
            {[
              ['系统名称', '采摘通 - 采摘工管理系统'],
              ['系统版本', 'v1.0.0'],
              ['后端框架', 'NestJS + TypeORM'],
              ['前端框架', 'React + TypeScript + TailwindCSS'],
              ['数据库', 'MySQL (caizhitong)'],
              ['小程序', '微信小程序'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between items-center py-2 border-b border-slate-800/30">
                <span className="text-slate-400 text-sm">{label}</span>
                <span className="text-white text-sm font-medium">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* System Health */}
        <div className="glass-card p-6 rounded-3xl border border-slate-800/60">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-2xl bg-blue-500/10">
              <Activity className="text-blue-400" size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">系统状态</h3>
              <p className="text-sm text-slate-400">各模块运行状态</p>
            </div>
          </div>
          <div className="space-y-3">
            {[
              { name: '后端 API 服务', status: true, icon: Server },
              { name: '数据库连接', status: true, icon: Database },
              { name: '用户认证服务', status: true, icon: Shield },
              { name: 'JWT 鉴权', status: true, icon: Shield },
              { name: '操作日志记录', status: true, icon: Clock },
            ].map((item) => (
              <div key={item.name} className="flex items-center justify-between py-3 px-4 rounded-xl bg-slate-800/30">
                <div className="flex items-center gap-3">
                  <item.icon size={16} className="text-slate-400" />
                  <span className="text-sm text-slate-200">{item.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-400" />
                  <span className="text-xs text-emerald-400 font-medium">正常</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Data Summary */}
      {stats && (
        <div className="glass-card p-6 rounded-3xl border border-slate-800/60">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-2xl bg-purple-500/10">
              <Database className="text-purple-400" size={22} />
            </div>
            <h3 className="text-lg font-bold text-white">数据总览</h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-800/40 rounded-2xl p-5 text-center">
              <Users className="mx-auto text-blue-400 mb-2" size={24} />
              <p className="text-2xl font-bold text-white">{stats.users.total}</p>
              <p className="text-xs text-slate-400 mt-1">总用户数</p>
            </div>
            <div className="bg-slate-800/40 rounded-2xl p-5 text-center">
              <Users className="mx-auto text-emerald-400 mb-2" size={24} />
              <p className="text-2xl font-bold text-white">{stats.users.workers}</p>
              <p className="text-xs text-slate-400 mt-1">采摘工</p>
            </div>
            <div className="bg-slate-800/40 rounded-2xl p-5 text-center">
              <Sprout className="mx-auto text-amber-400 mb-2" size={24} />
              <p className="text-2xl font-bold text-white">{stats.bases.total}</p>
              <p className="text-xs text-slate-400 mt-1">总基地数</p>
              <p className="text-xs text-emerald-400">{stats.bases.approved} 已审核</p>
            </div>
            <div className="bg-slate-800/40 rounded-2xl p-5 text-center">
              <Clock className="mx-auto text-purple-400 mb-2" size={24} />
              <p className="text-2xl font-bold text-white">{stats.logs.total}</p>
              <p className="text-xs text-slate-400 mt-1">操作日志</p>
              <p className="text-xs text-emerald-400">今日 {stats.logs.today}</p>
            </div>
          </div>

          {/* Pending Items */}
          {(stats.users.pending > 0 || stats.bases.pending > 0) && (
            <div className="mt-6 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20">
              <p className="text-amber-300 text-sm font-medium mb-2">待处理事项</p>
              <div className="flex flex-wrap gap-4">
                {stats.users.pending > 0 && (
                  <span className="text-sm text-amber-200">{stats.users.pending} 位用户待审核</span>
                )}
                {stats.bases.pending > 0 && (
                  <span className="text-sm text-amber-200">{stats.bases.pending} 个基地待审核</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Role Description */}
      <div className="glass-card p-6 rounded-3xl border border-slate-800/60">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-2xl bg-cyan-500/10">
            <Shield className="text-cyan-400" size={22} />
          </div>
          <h3 className="text-lg font-bold text-white">角色与权限</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-800/60 text-slate-500 text-xs uppercase tracking-wider">
                <th className="pb-3 font-semibold">角色</th>
                <th className="pb-3 font-semibold">定位</th>
                <th className="pb-3 font-semibold">核心职责</th>
                <th className="pb-3 font-semibold">可见菜单</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/30 text-sm">
              <tr>
                <td className="py-4 font-medium text-amber-400">超级管理员</td>
                <td className="py-4 text-slate-400">平台运营方</td>
                <td className="py-4 text-slate-300">全局数据概览、审核中心、用户/基地管理、操作日志</td>
                <td className="py-4 text-slate-400">全部</td>
              </tr>
              <tr>
                <td className="py-4 font-medium text-blue-400">基地管理员</td>
                <td className="py-4 text-slate-400">基地经营方</td>
                <td className="py-4 text-slate-300">维护自己基地、发布招聘、审核报名、本基地考勤/薪资</td>
                <td className="py-4 text-slate-400">概览、基地、招聘、考勤、薪资</td>
              </tr>
              <tr>
                <td className="py-4 font-medium text-emerald-400">现场管理员</td>
                <td className="py-4 text-slate-400">现场执行</td>
                <td className="py-4 text-slate-300">扫码签到、人员统计、协助录入工人</td>
                <td className="py-4 text-slate-400">概览、考勤、人员</td>
              </tr>
              <tr>
                <td className="py-4 font-medium text-slate-300">采摘工</td>
                <td className="py-4 text-slate-400">终端用户</td>
                <td className="py-4 text-slate-300">浏览岗位、报名、签到、确认工资（小程序端）</td>
                <td className="py-4 text-slate-400">小程序专用</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
