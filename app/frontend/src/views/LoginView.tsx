import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/App';
// 🔥 1. 引入我们刚才重构过的统一类型 (继承自后端)
import { User, UserRole } from '@/types';

// 引入生成的 Hook
import { useAuthControllerLogin } from '@/api/generated/认证模块/认证模块';
// 引入生成的入参类型
import { LoginDto } from '@/api/model';

import { Sprout, User as UserIcon, Loader2, KeyRound } from 'lucide-react';
import { motion } from 'framer-motion';

export default function LoginView() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const { login: setAuthUser } = useAuth();
  const navigate = useNavigate();

  // 🔥 2. 使用 Hook
  const { mutate: login, isPending } = useAuthControllerLogin({
    mutation: {
      // ✅ 此时 data 自动被 TypeScript 推断为 LoginResponse 类型
      // 不需要任何 as xxx 转换！
      onSuccess: (data) => {
        console.log('登录成功:', data);

        if (!data.access_token) {
          alert('登录异常：后端未返回 Token');
          return;
        }

        // 1. 存储 Token
        localStorage.setItem('token', data.access_token);

        // 2. 构造用户对象（后端返回 user.role，OpenAPI 类型为 roleKey，兼容两者）
        const userObj: User = {
          ...data.user,
          token: data.access_token,
          role: ((data.user as any).role ?? data.user.roleKey) as UserRole
        };

        // 3. 更新全局状态
        setAuthUser(userObj);

        // 4. 跳转逻辑
        if (userObj.role === UserRole.WORKER) {
          navigate('/worker');
        } else {
          navigate('/dashboard');
        }
      },
      onError: (error) => {
        console.error('登录失败:', error);
        // Orval 的 error 类型比较宽泛，这里用 as any 读取 message 是安全的
        const msg = (error as any).response?.data?.message || '请求失败，请检查网络或账号';
        alert(Array.isArray(msg) ? msg[0] : msg);
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !password) return alert('请输入完整信息');

    // 构造请求参数
    const loginData: LoginDto = {
      phone: phone,
      idCardLast6: password
    };

    // 发起请求
    login({ data: loginData });
  };

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 relative overflow-hidden">
      {/* 背景光晕 */}
      <div className="absolute top-0 -left-20 w-96 h-96 bg-emerald-500/20 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-0 -right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none"></div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full glass-card p-8 rounded-3xl relative z-10 border border-white/10 bg-slate-900/60 backdrop-blur-xl"
      >
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-2xl shadow-emerald-500/30 mb-4">
            <Sprout size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-2">智慧采摘管理系统</h1>
          <p className="text-slate-400 text-sm">请输入手机号和密码登录</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4">
            {/* 手机号输入框 */}
            <div className="relative group">
              <UserIcon className="absolute left-3 top-3.5 text-slate-500 group-focus-within:text-emerald-500 transition-colors" size={18} />
              <input
                type="text"
                placeholder="手机号 (例: 13800138000)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-slate-950/50 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-emerald-500 transition-all placeholder:text-slate-600"
              />
            </div>

            {/* 密码输入框 */}
            <div className="relative group">
              <KeyRound className="absolute left-3 top-3.5 text-slate-500 group-focus-within:text-emerald-500 transition-colors" size={18} />
              <input
                type="password"
                placeholder="密码 (默认身份证后6位)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950/50 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-emerald-500 transition-all placeholder:text-slate-600"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-emerald-900/20 active:scale-[0.98] flex justify-center items-center gap-2 mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? <Loader2 className="animate-spin" size={20} /> : '立即登录'}
          </button>

          <p className="text-center text-slate-500 text-sm mt-4">
            没有账号？{' '}
            <Link to="/register" className="text-emerald-400 hover:text-emerald-300 font-medium">
              去注册
            </Link>
          </p>
        </form>
      </motion.div>
    </div>
  );
}