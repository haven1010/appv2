
import React from 'react';
import { Bell, Search, LogOut, User } from 'lucide-react';
import { useAuth } from '../App';
import { useNavigate } from 'react-router-dom';

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      super_admin: '超级管理员',
      region_admin: '超级管理员',
      base_manager: '基地管理员',
      field_manager: '现场管理员',
      worker: '采摘工',
    };
    return labels[role] || role;
  };

  return (
    <header className="h-16 border-b border-slate-800/60 glass flex items-center justify-between px-8 z-40 sticky top-0">
      <div className="flex-1 max-w-md relative hidden md:block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
        <input 
          type="text" 
          placeholder="全局搜索任务、人员或基地..." 
          className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all placeholder:text-slate-600"
        />
      </div>

      <div className="flex items-center gap-6">
        <div className="relative cursor-pointer group">
          <Bell size={20} className="text-slate-400 group-hover:text-slate-100 transition-colors" />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full border-2 border-slate-950"></span>
        </div>

        <div className="h-8 w-px bg-slate-800"></div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-slate-100 leading-tight">{user?.name}</p>
            <p className="text-xs text-slate-500">{getRoleLabel(user?.role || '')}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center border-2 border-slate-800 p-0.5">
            <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center overflow-hidden">
               <User className="text-emerald-500" size={24} />
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
            title="退出登录"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </header>
  );
}
