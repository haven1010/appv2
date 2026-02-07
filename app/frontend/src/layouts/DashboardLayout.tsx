// src/layouts/DashboardLayout.tsx
import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/App';
import { UserRole, isSuperAdminRole } from '@/types';
import {
    LayoutDashboard,
    Sprout,
    Users,
    ClipboardCheck,
    Wallet,
    LogOut,
    Briefcase,
    ShieldCheck,
    ScrollText,
    Settings,
} from 'lucide-react';

// 角色中文映射
const ROLE_LABEL: Record<string, string> = {
    super_admin: '超级管理员',
    region_admin: '超级管理员',
    base_manager: '基地管理员',
    field_manager: '现场管理员',
    worker: '采摘工',
};

interface MenuItem {
    icon: React.ElementType;
    label: string;
    path: string;
    roles: string[];
    section?: string; // 分组标题
}

export default function DashboardLayout() {
    const { user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const role = user?.role as string;
    const isAdmin = isSuperAdminRole(role);

    // 完整菜单定义 - 按角色分组
    const allMenuItems: MenuItem[] = [
        // ===== 超级管理员专属：平台管理 =====
        { icon: LayoutDashboard, label: '数据概览', path: '/dashboard', roles: [UserRole.SUPER_ADMIN, UserRole.BASE_MANAGER], section: isAdmin ? '平台管理' : '主菜单' },
        { icon: ShieldCheck, label: '审核中心', path: '/dashboard/audit', roles: [UserRole.SUPER_ADMIN] },
        { icon: Users, label: '用户管理', path: '/dashboard/workers', roles: [UserRole.SUPER_ADMIN] },
        { icon: ScrollText, label: '操作日志', path: '/dashboard/logs', roles: [UserRole.SUPER_ADMIN] },
        { icon: Settings, label: '系统设置', path: '/dashboard/settings', roles: [UserRole.SUPER_ADMIN] },

        // ===== 业务管理（基地管理员的核心，超级管理员也可查看） =====
        { icon: Sprout, label: '基地管理', path: '/dashboard/bases', roles: [UserRole.SUPER_ADMIN, UserRole.BASE_MANAGER], section: isAdmin ? '业务查看' : undefined },
        { icon: Briefcase, label: '招聘管理', path: '/dashboard/jobs', roles: [UserRole.SUPER_ADMIN, UserRole.BASE_MANAGER] },
        { icon: ClipboardCheck, label: '考勤管理', path: '/dashboard/attendance', roles: [UserRole.SUPER_ADMIN, UserRole.BASE_MANAGER] },
        { icon: Wallet, label: '薪资结算', path: '/dashboard/payroll', roles: [UserRole.SUPER_ADMIN, UserRole.BASE_MANAGER] },

        // ===== 现场管理员专属 =====
        { icon: LayoutDashboard, label: '工作台', path: '/dashboard', roles: [UserRole.FIELD_MANAGER], section: '现场管理' },
        { icon: ClipboardCheck, label: '扫码签到', path: '/dashboard/attendance', roles: [UserRole.FIELD_MANAGER] },
        { icon: Users, label: '基地人员', path: '/dashboard/field-workers', roles: [UserRole.FIELD_MANAGER] },
    ];

    // 过滤菜单
    const menuItems = allMenuItems.filter(item => {
        if (isAdmin) return item.roles.includes(UserRole.SUPER_ADMIN);
        return item.roles.includes(role as any);
    });

    // 渲染带分组标题的菜单
    let lastSection = '';

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
                    {menuItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        let sectionHeader = null;

                        // 渲染分组标题
                        if (item.section && item.section !== lastSection) {
                            lastSection = item.section;
                            sectionHeader = (
                                <div key={`section-${item.section}`} className="px-4 py-2 mt-3 mb-1">
                                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">{item.section}</p>
                                </div>
                            );
                        }

                        return (
                            <React.Fragment key={item.path + item.label}>
                                {sectionHeader}
                                <Link
                                    to={item.path}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${isActive
                                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20'
                                            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                        }`}
                                >
                                    <item.icon size={20} className={isActive ? 'text-white' : 'text-slate-500 group-hover:text-white transition-colors'} />
                                    <span className="font-medium text-sm">{item.label}</span>
                                </Link>
                            </React.Fragment>
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
                                <p className="text-xs text-slate-500 truncate">{ROLE_LABEL[role] || '管理员'}</p>
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

                <div className="flex-1 overflow-auto p-4 md:p-8 relative z-0 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
