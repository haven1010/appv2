// src/layouts/DashboardLayout.tsx
import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/App'; // 确保这里能引用到 useAuth
import {
    LayoutDashboard,
    Sprout,
    Users,
    ClipboardCheck,
    Wallet,
    LogOut,
    Briefcase
} from 'lucide-react';

export default function DashboardLayout() {
    const { user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // 侧边栏菜单配置
    // 注意：path 必须和 App.tsx 里的路由路径对应
    const menuItems = [
        { icon: LayoutDashboard, label: '概览', path: '/dashboard' },
        { icon: Sprout, label: '基地管理', path: '/dashboard/bases' },
        { icon: Briefcase, label: '招聘管理', path: '/dashboard/jobs' },
        { icon: ClipboardCheck, label: '考勤管理', path: '/dashboard/attendance' },
        { icon: Wallet, label: '薪资结算', path: '/dashboard/payroll' },
        { icon: Users, label: '人员管理', path: '/dashboard/workers' },
    ];

    return (
        <div className="flex h-screen bg-[#020617] text-white overflow-hidden">
            {/* 侧边栏 Sidebar */}
            <aside className="w-64 bg-slate-900/50 border-r border-slate-800 flex flex-col backdrop-blur-xl z-20 hidden md:flex">
                <div className="p-6 flex items-center gap-3 border-b border-slate-800">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                        <Sprout size={18} className="text-white" />
                    </div>
                    <div>
                        <h1 className="font-bold text-lg tracking-tight">采摘通</h1>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">管理后台</p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-1">
                    <div className="px-4 py-2 mb-2">
                        <p className="text-xs font-semibold text-slate-500 uppercase">主菜单</p>
                    </div>
                    {menuItems.map((item) => {
                        // 判断当前路径是否激活
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${isActive
                                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20'
                                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                    }`}
                            >
                                <item.icon size={20} className={isActive ? 'text-white' : 'text-slate-500 group-hover:text-white transition-colors'} />
                                <span className="font-medium">{item.label}</span>
                            </Link>
                        );
                    })}
                </div>

                {/* 底部用户信息 */}
                <div className="p-4 border-t border-slate-800">
                    <div className="bg-slate-800/50 rounded-xl p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">
                                {user?.name?.[0] || 'A'}
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-sm font-medium truncate w-24">{user?.name || '管理员'}</p>
                                <p className="text-xs text-slate-500 truncate">在线</p>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="p-2 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-colors text-slate-500"
                            title="退出登录"
                        >
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            </aside>

            {/* 主内容区域 */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
                {/* 顶部背景光晕 */}
                <div className="absolute top-0 left-0 w-full h-96 bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none"></div>

                {/* 真正的内容容器 */}
                {/* 🔥 Outlet 非常重要，它负责渲染子路由（比如 BaseManagement） */}
                <div className="flex-1 overflow-auto p-4 md:p-8 relative z-0 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}