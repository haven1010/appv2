/**
 * Layer: Frontend View
 * Responsibility: Implements the Register View screen and coordinates user interaction, page state, and API-driven data binding.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUserControllerRegister } from '@/api/generated/用户管理/用户管理';
import type { CreateUserDto } from '@/api/model';
import { CreateUserDtoRoleKey } from '@/api/model/createUserDtoRoleKey';
import { User as UserIcon, Loader2, CreditCard, Phone, UserPlus } from 'lucide-react';
import { motion } from 'framer-motion';

export default function RegisterView() {
  const navigate = useNavigate();
  const [form, setForm] = useState<CreateUserDto & { emergencyContact?: string; emergencyPhone?: string }>({
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
        const msg = data?.msg ?? '注册成功';
        const uid = data?.uid;
        alert(uid ? `${msg}，您的 UID：${uid}。请使用手机号 + 身份证后6位登录。` : `${msg}，请使用手机号 + 身份证后6位登录。`);
        navigate('/login');
      },
      onError: (e: any) => {
        const msg = e?.response?.data?.message ?? '注册失败，请检查网络或信息是否重复';
        alert(Array.isArray(msg) ? msg.join(' ') : msg);
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim()) return alert('请输入姓名');
    if (!form.idCard?.trim()) return alert('请输入身份证号');
    if (!form.phone?.trim()) return alert('请输入手机号');
    const payload: CreateUserDto = {
      name: form.name.trim(),
      idCard: form.idCard.trim(),
      phone: form.phone.trim(),
      roleKey: form.roleKey,
    };
    if (form.regionCode != null && form.regionCode !== '') payload.regionCode = Number(form.regionCode);
    if ((form as any).assignedBaseId != null) (payload as any).assignedBaseId = Number((form as any).assignedBaseId);
    if (form.faceImgUrl) payload.faceImgUrl = form.faceImgUrl;
    if (form.emergencyContact?.trim()) (payload as any).emergencyContact = form.emergencyContact.trim();
    if (form.emergencyPhone?.trim()) (payload as any).emergencyPhone = form.emergencyPhone.trim();
    register({ data: payload });
  };

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 -left-20 w-96 h-96 bg-emerald-500/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 -right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full glass-card p-8 rounded-3xl relative z-10 border border-white/10 bg-slate-900/60 backdrop-blur-xl"
      >
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-2xl shadow-emerald-500/30 mb-4">
            <UserPlus size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-2">用户注册</h1>
          <p className="text-slate-400 text-sm">填写实名信息，注册后使用手机号+身份证后6位登录</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative group">
            <UserIcon className="absolute left-3 top-3.5 text-slate-500 group-focus-within:text-emerald-500 transition-colors" size={18} />
            <input
              required
              placeholder="真实姓名"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full bg-slate-950/50 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-emerald-500 placeholder:text-slate-500"
            />
          </div>
          <div className="relative group">
            <CreditCard className="absolute left-3 top-3.5 text-slate-500 group-focus-within:text-emerald-500 transition-colors" size={18} />
            <input
              required
              placeholder="身份证号（18位）"
              value={form.idCard}
              onChange={(e) => setForm((f) => ({ ...f, idCard: e.target.value }))}
              className="w-full bg-slate-950/50 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-emerald-500 placeholder:text-slate-500"
              maxLength={18}
            />
          </div>
          <div className="relative group">
            <Phone className="absolute left-3 top-3.5 text-slate-500 group-focus-within:text-emerald-500 transition-colors" size={18} />
            <input
              required
              type="tel"
              placeholder="手机号（例：13800138000）"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="w-full bg-slate-950/50 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-emerald-500 placeholder:text-slate-500"
            />
          </div>
          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-100">
            公开注册仅支持采摘工账号。管理员、基地管理员、现场管理员请在后台由超级管理员创建。
          </div>
          <div>
            <label className="block text-slate-400 text-sm mb-1.5">紧急联系人（选填）</label>
            <input
              placeholder="姓名及关系，如：李四-配偶"
              value={form.emergencyContact ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, emergencyContact: e.target.value }))}
              className="w-full bg-slate-950/50 border border-slate-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-emerald-500 placeholder:text-slate-500"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-sm mb-1.5">紧急联系人电话（选填）</label>
            <input
              type="tel"
              placeholder="13900139000"
              value={form.emergencyPhone ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, emergencyPhone: e.target.value }))}
              className="w-full bg-slate-950/50 border border-slate-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-emerald-500 placeholder:text-slate-500"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-emerald-900/20 active:scale-[0.98] flex justify-center items-center gap-2 mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? <Loader2 className="animate-spin" size={20} /> : '提交注册'}
          </button>
        </form>

        <p className="text-center text-slate-500 text-sm mt-4">
          已有账号？{' '}
          <Link to="/login" className="text-emerald-400 hover:text-emerald-300 font-medium">
            去登录
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
