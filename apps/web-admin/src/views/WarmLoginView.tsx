/**
 * Layer: Frontend View
 * Responsibility: Implements the redesigned login screen and coordinates authentication.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, KeyRound, Phone, Sprout } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/App';
import { User, UserRole } from '@/types';
import { useAuthControllerLogin } from '@/api/generated/认证模块/认证模块';
import type { LoginDto } from '@/api/model';
import AuthShowcase from '@/components/AuthShowcase';

export default function WarmLoginView() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const { login: setAuthUser } = useAuth();
  const navigate = useNavigate();

  const { mutate: login, isPending } = useAuthControllerLogin({
    mutation: {
      onSuccess: (data) => {
        if (!data.access_token) {
          alert('登录异常，后端未返回令牌。');
          return;
        }

        localStorage.setItem('token', data.access_token);

        const userObj: User = {
          ...data.user,
          token: data.access_token,
          role: ((data.user as any).role ?? data.user.roleKey) as UserRole,
        };

        setAuthUser(userObj);
        navigate(userObj.role === UserRole.WORKER ? '/worker' : '/dashboard');
      },
      onError: (error) => {
        const message =
          (error as any).response?.data?.message ?? '请求失败，请检查网络或账号信息。';
        alert(Array.isArray(message) ? message[0] : message);
      },
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!phone.trim() || !password.trim()) {
      alert('请输入完整的手机号和密码。');
      return;
    }

    const payload: LoginDto = {
      phone: phone.trim(),
      idCardLast6: password.trim(),
    };

    login({ data: payload });
  };

  return (
    <div className="auth-shell">
      <AuthShowcase
        eyebrow="Warm Product Style"
        title="让管理后台也有轻盈、干净、耐看的第一眼。"
        description="参考图里的留白节奏和设备卡片感被转译为浅绿、浅蓝与白色的清透界面，更适合长时间运营使用。"
        highlights={[
          { label: '首页状态', value: '12 项关键指标' },
          { label: '操作效率', value: '一步直达常用流程' },
          { label: '视觉感受', value: '浅绿 + 浅蓝 + 白' },
        ]}
      />

      <motion.div
        initial={{ opacity: 0, x: 18 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.45 }}
        className="auth-panel"
      >
        <div className="flex h-full flex-col">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-[#28586f] text-[#d7f7eb] shadow-[0_20px_30px_rgba(68,130,161,0.2)]">
              <Sprout size={28} />
            </div>
            <div>
              <p className="section-label">Sign In</p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-[var(--ink)]">
                登录智汇就业
              </h2>
            </div>
          </div>

          <p className="mb-8 text-sm leading-7 text-[var(--muted)]">
            使用手机号和身份证后 6 位进入系统。整个界面会跟随你的角色切换到对应的工作台。
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">手机号</span>
              <div className="relative">
                <Phone
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#6b93ab]"
                />
                <input
                  type="text"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="例如 13800138000"
                  className="app-input pl-11 pr-4"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">密码</span>
              <div className="relative">
                <KeyRound
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#6b93ab]"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="身份证后 6 位"
                  className="app-input pl-11 pr-4"
                />
              </div>
            </label>

            <button type="submit" disabled={isPending} className="app-button mt-4 w-full">
              {isPending ? <Loader2 size={18} className="animate-spin" /> : null}
              {isPending ? '正在登录' : '进入工作台'}
            </button>
          </form>

          <div className="my-8 soft-divider" />

          <div className="paper-panel p-4">
            <p className="text-sm font-semibold text-[var(--ink)]">首次使用</p>
            <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
              采摘工账号支持公开注册，管理员类账号仍建议在后台由超级管理员统一开通。
            </p>
          </div>

          <p className="mt-8 text-sm text-[var(--muted)]">
            还没有账号？
            <Link to="/register" className="ml-2 font-semibold text-[#3f8fbc] hover:text-[#2e7ca8]">
              去注册
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
