
import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Home, 
  ScanLine, 
  CircleDollarSign, 
  Briefcase, 
  ChevronLeft, 
  ChevronRight,
  Sprout
} from 'lucide-react';
import { useAuth } from '../App';
import { UserRole } from '../types';
import { cn } from '../lib/utils';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user } = useAuth();

  const menuItems = [
    { name: '控制台', icon: LayoutDashboard, path: '/dashboard', roles: Object.values(UserRole) },
    { name: '采摘工管理', icon: Users, path: '/workers', roles: [UserRole.SUPER_ADMIN, UserRole.FIELD_ADMIN, UserRole.AREA_ADMIN] },
    { name: '基地管理', icon: Sprout, path: '/bases', roles: Object.values(UserRole) },
    { name: '招聘信息', icon: Briefcase, path: '/jobs', roles: [UserRole.SUPER_ADMIN, UserRole.BASE_ADMIN, UserRole.AREA_ADMIN] },
    { name: '现场签到', icon: ScanLine, path: '/attendance', roles: [UserRole.SUPER_ADMIN, UserRole.FIELD_ADMIN] },
    { name: '工资结算', icon: CircleDollarSign, path: '/payroll', roles: [UserRole.SUPER_ADMIN, UserRole.BASE_ADMIN] },
  ];

  const filteredItems = menuItems.filter(item => user && item.roles.includes(user.role));

  return (
    <aside className={cn(
      "glass h-full transition-all duration-300 flex flex-col relative z-50 shadow-2xl",
      collapsed ? "w-20" : "w-64"
    )}>
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/20">
          <Sprout size={20} className="text-white" />
        </div>
        {!collapsed && <span className="font-bold text-xl tracking-tight whitespace-nowrap bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">采摘管理系统</span>}
      </div>

      <nav className="flex-1 px-4 py-6 space-y-2">
        {filteredItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(
              "flex items-center gap-4 px-3 py-3 rounded-xl transition-all duration-200 group relative",
              isActive 
                ? "bg-emerald-500/10 text-emerald-400 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.2)]" 
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            )}
          >
            {/* Fixed: Use function as children to access isActive property provided by NavLink */}
            {({ isActive }) => (
              <>
                <item.icon size={22} className={cn(
                  "flex-shrink-0 transition-colors",
                  "group-hover:text-emerald-400"
                )} />
                {!collapsed && <span className="font-medium">{item.name}</span>}
                {isActive && !collapsed && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-500 rounded-r-full" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-4">
        <button 
          onClick={onToggle}
          className="w-full h-10 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors text-slate-400 hover:text-slate-100 border border-slate-700/50"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>
    </aside>
  );
}
