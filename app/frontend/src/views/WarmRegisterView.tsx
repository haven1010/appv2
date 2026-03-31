/**
 * Layer: Frontend View
 * Responsibility: Implements the redesigned worker registration screen.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CreditCard, Loader2, Phone, User, UserPlus } from 'lucide-react';
import { motion } from 'framer-motion';
import { useUserControllerRegister } from '@/api/generated/用户管理/用户管理';
import type { CreateUserDto } from '@/api/model';
import { CreateUserDtoRoleKey } from '@/api/model/createUserDtoRoleKey';
import AuthShowcase from '@/components/AuthShowcase';

export default function WarmRegisterView() {
  const navigate = useNavigate();
  const [form, setForm] = useState<CreateUserDto & {
    emergencyContact?: string;
    emergencyPhone?: string;
  }>({
    name: '',
    idCard: '',
    phone: '',
    roleKey: CreateUserDtoRoleKey.worker,
    emergencyContact: '',
    emergencyPhone: '',
  });

  const { mutate: register, isPending } = useUserControllerRegister({
    mutation: {
      onSuccess: (data: any) => {
        const message = data?.msg ?? '注册成功';
        const uid = data?.uid;
        alert(uid ? `${message}，您的 UID 为 ${uid}。请使用手机号和身份证后 6 位登录。` : `${message}，请使用手机号和身份证后 6 位登录。`);
        navigate('/login');
      },
      onError: (error: any) => {
        const message = error?.response?.data?.message ?? '注册失败，请检查信息是否重复。';
        alert(Array.isArray(message) ? message.join(' ') : message);
      },
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.name.trim()) return alert('请输入真实姓名。');
    if (!form.idCard.trim()) return alert('请输入身份证号。');
    if (!form.phone.trim()) return alert('请输入手机号。');

    const payload: CreateUserDto = {
      name: form.name.trim(),
      idCard: form.idCard.trim(),
      phone: form.phone.trim(),
      roleKey: form.roleKey,
    };

    if (form.regionCode != null && form.regionCode !== '') {
      payload.regionCode = Number(form.regionCode);
    }

    if ((form as any).assignedBaseId != null) {
      (payload as any).assignedBaseId = Number((form as any).assignedBaseId);
    }

    if (form.faceImgUrl) payload.faceImgUrl = form.faceImgUrl;
    if (form.emergencyContact?.trim()) (payload as any).emergencyContact = form.emergencyContact.trim();
    if (form.emergencyPhone?.trim()) (payload as any).emergencyPhone = form.emergencyPhone.trim();

    register({ data: payload });
  };

  return (
    <div className="auth-shell">
      <AuthShowcase
        eyebrow="Worker Onboarding"
        title="把注册流程做得更简洁，也更像一个完整产品。"
        description="页面延续同一套暖色卡片语言，让实名认证信息填写不再像传统表单，而像一个更温和、更可信的引导流程。"
        highlights={[
          { label: '公开入口', value: '仅开放采摘工注册' },
          { label: '登录方式', value: '手机号 + 身份证后 6 位' },
          { label: '表单节奏', value: '一步填完核心信息' },
        ]}
      />

      <motion.div
        initial={{ opacity: 0, x: 18 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.45 }}
        className="auth-panel"
      >
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-[#2a211b] text-[#ffd16d] shadow-[0_20px_30px_rgba(56,35,13,0.18)]">
            <UserPlus size={28} />
          </div>
          <div>
            <p className="section-label">Register</p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-[var(--ink)]">
              新用户注册
            </h2>
          </div>
        </div>

        <p className="mb-8 text-sm leading-7 text-[var(--muted)]">
          当前开放的是采摘工注册入口。管理员账号、基地管理员账号和现场管理员账号仍建议由后台统一创建。
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">真实姓名</span>
            <div className="relative">
              <User
                size={18}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#a2814a]"
              />
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="请输入姓名"
                className="app-input pl-11 pr-4"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">身份证号</span>
            <div className="relative">
              <CreditCard
                size={18}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#a2814a]"
              />
              <input
                value={form.idCard}
                onChange={(event) => setForm((current) => ({ ...current, idCard: event.target.value }))}
                placeholder="18 位身份证号"
                maxLength={18}
                className="app-input pl-11 pr-4"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">手机号</span>
            <div className="relative">
              <Phone
                size={18}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#a2814a]"
              />
              <input
                type="tel"
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                placeholder="例如 13800138000"
                className="app-input pl-11 pr-4"
              />
            </div>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">
                紧急联系人
              </span>
              <input
                value={form.emergencyContact ?? ''}
                onChange={(event) =>
                  setForm((current) => ({ ...current, emergencyContact: event.target.value }))
                }
                placeholder="选填"
                className="app-input px-4"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">
                紧急联系电话
              </span>
              <input
                type="tel"
                value={form.emergencyPhone ?? ''}
                onChange={(event) =>
                  setForm((current) => ({ ...current, emergencyPhone: event.target.value }))
                }
                placeholder="选填"
                className="app-input px-4"
              />
            </label>
          </div>

          <div className="paper-panel p-4">
            <p className="text-sm font-semibold text-[var(--ink)]">注册说明</p>
            <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
              提交成功后即可使用手机号和身份证后 6 位登录；如信息重复或已存在，请联系管理员核对身份资料。
            </p>
          </div>

          <button type="submit" disabled={isPending} className="app-button mt-4 w-full">
            {isPending ? <Loader2 size={18} className="animate-spin" /> : null}
            {isPending ? '正在提交' : '提交注册'}
          </button>
        </form>

        <p className="mt-8 text-sm text-[var(--muted)]">
          已有账号？
          <Link to="/login" className="ml-2 font-semibold text-[#c27600] hover:text-[#9b5f00]">
            去登录
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
