/**
 * Layer: Frontend Layout
 * Responsibility: Defines the redesigned dashboard shell and shared navigation for the web console.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import React from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Briefcase,
  CalendarCheck,
  LayoutDashboard,
  LogOut,
  ScrollText,
  Settings,
  ShieldCheck,
  Sprout,
  Users,
  Wallet,
} from 'lucide-react';
import { useAuth } from '@/App';
import { UserRole, isSuperAdminRole } from '@/types';

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
  section: string;
}

export default function WarmDashboardLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const role = user?.role as string;
  const isAdmin = isSuperAdminRole(role);

  const allMenuItems: MenuItem[] = [
    {
      icon: LayoutDashboard,
      label: '数据概览',
      path: '/dashboard',
      roles: [UserRole.SUPER_ADMIN, UserRole.BASE_MANAGER],
      section: isAdmin ? '平台管理' : '主菜单',
    },
    {
      icon: ShieldCheck,
      label: '审核中心',
      path: '/dashboard/audit',
      roles: [UserRole.SUPER_ADMIN],
      section: '平台管理',
    },
    {
      icon: Users,
      label: '用户管理',
      path: '/dashboard/workers',
      roles: [UserRole.SUPER_ADMIN],
      section: '平台管理',
    },
    {
      icon: ScrollText,
      label: '操作日志',
      path: '/dashboard/logs',
      roles: [UserRole.SUPER_ADMIN],
      section: '平台管理',
    },
    {
      icon: Settings,
      label: '系统设置',
      path: '/dashboard/settings',
      roles: [UserRole.SUPER_ADMIN],
      section: '平台管理',
    },
    {
      icon: Sprout,
      label: '基地管理',
      path: '/dashboard/bases',
      roles: [UserRole.SUPER_ADMIN, UserRole.BASE_MANAGER],
      section: '业务协同',
    },
    {
      icon: Briefcase,
      label: '招聘管理',
      path: '/dashboard/jobs',
      roles: [UserRole.SUPER_ADMIN, UserRole.BASE_MANAGER],
      section: '业务协同',
    },
    {
      icon: CalendarCheck,
      label: '考勤管理',
      path: '/dashboard/attendance',
      roles: [UserRole.SUPER_ADMIN, UserRole.BASE_MANAGER, UserRole.FIELD_MANAGER],
      section: role === UserRole.FIELD_MANAGER ? '现场执行' : '业务协同',
    },
    {
      icon: Wallet,
      label: '薪资结算',
      path: '/dashboard/payroll',
      roles: [UserRole.SUPER_ADMIN, UserRole.BASE_MANAGER, UserRole.FIELD_MANAGER],
      section: role === UserRole.FIELD_MANAGER ? '现场执行' : '业务协同',
    },
    {
      icon: LayoutDashboard,
      label: '现场工作台',
      path: '/dashboard',
      roles: [UserRole.FIELD_MANAGER],
      section: '现场执行',
    },
    {
      icon: Users,
      label: '基地人员',
      path: '/dashboard/field-workers',
      roles: [UserRole.FIELD_MANAGER],
      section: '现场执行',
    },
  ];

  const menuItems = allMenuItems.filter((item) => {
    if (isAdmin) {
      return item.roles.includes(UserRole.SUPER_ADMIN);
    }
    return item.roles.includes(role as UserRole);
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const today = new Date().toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  let currentSection = '';

  return (
    <div className="app-shell">
      <div className="dashboard-frame">
        <aside className="dashboard-sidebar">
          <div className="soft-card-strong p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[#23495d] text-[#c8f2e4] shadow-[0_16px_28px_rgba(56,111,138,0.24)]">
                <Sprout size={24} />
              </div>
              <div>
                <p className="section-label">Fresh Console</p>
                <h1 className="mt-2 text-xl font-extrabold tracking-tight text-[var(--ink)]">
                  智汇就业后台
                </h1>
              </div>
            </div>
            <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
              用更轻的界面组织招聘、考勤、结算和基地协同，让每天的运营信息一眼就清楚。
            </p>
          </div>

          <div className="mt-5 flex-1 overflow-auto">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;
              const showSection = item.section !== currentSection;
              if (showSection) {
                currentSection = item.section;
              }

              return (
                <React.Fragment key={item.path + item.label}>
                  {showSection ? <div className="nav-group-title">{item.section}</div> : null}
                  <Link to={item.path} className={`nav-link ${isActive ? 'nav-link-active' : ''}`}>
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                        isActive ? 'bg-[#28586f] text-[#d7f7eb]' : 'bg-[#eff7ff] text-[#4f8eb2]'
                      }`}
                    >
                      <item.icon size={18} />
                    </span>
                    <span className="text-sm font-semibold">{item.label}</span>
                  </Link>
                </React.Fragment>
              );
            })}
          </div>

          <div className="soft-card mt-5 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#28586f] text-sm font-bold text-[#d7f7eb]">
                {user?.name?.slice(0, 1) ?? '管'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[var(--ink)]">
                  {user?.name ?? '管理员'}
                </p>
                <p className="truncate text-xs text-[var(--muted)]">
                  {ROLE_LABEL[role] ?? '系统成员'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] bg-white/70 text-[#5f88a2] transition hover:border-[var(--line-strong)] hover:text-[var(--ink)]"
                title="退出登录"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </aside>

        <main className="dashboard-main">
          <div className="dashboard-topbar">
            <div>
              <p className="section-label">Daily Flow</p>
              <h2 className="mt-3 text-[clamp(1.8rem,3vw,2.8rem)] font-extrabold tracking-[-0.04em] text-[var(--ink)]">
                把繁杂流程变成干净、可执行的工作面板
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">
                这一版界面改为浅绿、浅蓝与白色的低饱和组合，在保持留白节奏的同时，让后台数据阅读更稳定。
              </p>
            </div>

            <div className="soft-card hidden min-w-[18rem] p-5 lg:block">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#6b93ab]">
                    当前身份
                  </p>
                  <p className="mt-2 text-lg font-bold text-[var(--ink)]">
                    {ROLE_LABEL[role] ?? '系统成员'}
                  </p>
                </div>
                <div className="mini-badge">{today}</div>
              </div>
              <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
                保留业务路径不变，只把视觉层统一成更克制、更有质感的一套原创界面。
              </p>
            </div>
          </div>

          <div className="dashboard-content">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
