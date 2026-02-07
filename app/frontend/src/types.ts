// src/types.ts

import {
  SysUser,
  SysUserRoleKey
} from '@/api/model';

// ==========================================
// 1. 角色映射 (修复报错的核心)
// ==========================================

// 我们手动创建一个对象，把前端的 "大写习惯" 映射到后端的 "小写属性"
// 这样 App.tsx 里的 UserRole.SUPER_ADMIN 就能找到对应的值了
export const UserRole = {
  SUPER_ADMIN: SysUserRoleKey.super_admin,

  BASE_MANAGER: SysUserRoleKey.base_manager,

  FIELD_MANAGER: 'field_manager' as SysUserRoleKey,

  WORKER: SysUserRoleKey.worker,

  // === 废弃角色别名（兼容旧代码引用） ===
  /** @deprecated 使用 SUPER_ADMIN 代替 */
  AREA_ADMIN: SysUserRoleKey.region_admin,
  /** @deprecated 使用 BASE_MANAGER 代替 */
  BASE_ADMIN: SysUserRoleKey.base_manager,
  /** @deprecated 使用 FIELD_MANAGER 代替 */
  FIELD_ADMIN: 'field_manager' as SysUserRoleKey,
} as const;

/** 判断角色是否具有超级管理员权限（含已废弃的 region_admin） */
export function isSuperAdminRole(role: string | undefined): boolean {
  return role === UserRole.SUPER_ADMIN || role === 'region_admin';
}

// 导出类型：取上面对象的值作为类型
// 结果就是: 'super_admin' | 'region_admin' | 'base_manager' | 'worker'
export type UserRole = typeof SysUserRoleKey[keyof typeof SysUserRoleKey];


// ==========================================
// 2. 用户定义
// ==========================================
export interface User extends Omit<SysUser, 'roleKey'> {
  // 字段映射：后端叫 roleKey，前端叫 role
  role: UserRole;

  // 前端扩展
  token?: string;
  access_token?: string;
  assignedBaseId?: number | null;
}

// ==========================================
// 3. 基地定义
// ==========================================
export interface Base {
  id: string;
  name: string;
  category: 'FRUIT' | 'VEGETABLE' | 'OTHER';
  region: string;
  address: string;
  contact: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  images: string[];
  description: string;
  areaSize?: string | number;
  principalName?: string;
}

// 兼容别名
export type BaseInfo = Base;

// ==========================================
// 4. 其他类型保持不变...
// ==========================================
export interface Job {
  id: string;
  baseId: string;
  baseName: string;
  title: string;
  requirements: string;
  count: number;
  period: string;
  salary: string;
  type: 'FIXED' | 'PIECE' | 'HOURLY';
  status: 'OPEN' | 'CLOSED';
}

export interface AttendanceRecord {
  id: string;
  workerId: string;
  workerName: string;
  baseId: string;
  date: string;
  time: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE';
}

export interface SalaryRecord {
  id: string;
  workerId: string;
  workerName: string;
  baseId: string;
  amount: number;
  status: 'PENDING' | 'PAID';
  date: string;
  workHours: number;
}