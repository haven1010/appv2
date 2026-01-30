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

  // 注意：截图显示后端叫 region_admin，对应你之前的 AREA_ADMIN
  AREA_ADMIN: SysUserRoleKey.region_admin,

  BASE_ADMIN: SysUserRoleKey.base_manager,

  // ⚠️ 请确认 sysUserRoleKey.ts 里有没有 field_manager
  // 如果报错说找不到 field_manager，说明后端没定义这个角色，请暂时注释掉下面这行
  FIELD_ADMIN: 'field_manager' as any, // 暂时强转，防止后端没生成导致报错

  WORKER: SysUserRoleKey.worker,
} as const;

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