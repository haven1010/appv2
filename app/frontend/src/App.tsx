/**
 * Layer: Frontend Root
 * Responsibility: Composes top-level routes, providers, and shell behavior for the web management console.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// --- 类型定义 ---
import { User, UserRole } from './types';

// --- 布局组件 ---
import DashboardLayout from './layouts/DashboardLayout'; // 之前创建的通用布局

// --- 业务页面 ---
import LoginView from './views/LoginView';
import RegisterView from './views/RegisterView';
import BaseManagement from './views/BaseManagement';
import DashboardView from './views/DashboardView';
import AttendanceManagement from './views/AttendanceManagement';
import JobManagement from './views/JobManagement';
import PayrollView from './views/PayrollView';
import WorkerManagement from './views/WorkerManagement';
import WorkerView from './views/worker/WorkerView';
// --- 超级管理员专属页面 ---
import AuditCenter from './views/AuditCenter';
import OperationLogView from './views/OperationLogView';
import SystemSettings from './views/SystemSettings';
// --- 现场管理员专属页面 ---
import FieldDashboard from './views/FieldDashboard';
import FieldWorkers from './views/FieldWorkers';

// --- 1. 初始化 React Query 客户端 ---
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1, // 失败重试次数
      refetchOnWindowFocus: false, // 窗口聚焦时不自动刷新
    },
  },
});

// --- 2. Auth Context 定义 ---
interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

// --- 3. 路由守卫组件 ---
const ProtectedRoute = ({ children, roles }: { children?: React.ReactNode, roles?: UserRole[] }) => {
  const { user } = useAuth();

  // 未登录 -> 跳去登录页
  if (!user) return <Navigate to="/login" replace />;

  // 权限不足 -> 跳回 Dashboard 或 首页
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

// --- 4. Dashboard Index (根据角色选择不同首页) ---
function DashboardIndex() {
  const { user } = useAuth();
  if (user?.role === UserRole.FIELD_MANAGER) return <FieldDashboard />;
  return <DashboardView />;
}

// --- 5. 主应用组件 ---
export default function App() {
  // 从 localStorage 初始化用户状态
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    return (saved && token) ? JSON.parse(saved) : null;
  });

  const login = (userData: User) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.clear(); // 清除 token 和 user
  };

  return (
    // 🔥 最外层包裹 QueryClientProvider
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={{ user, login, logout }}>
        <BrowserRouter>
          <Routes>
            {/* === 公开路由 === */}
            <Route path="/login" element={<LoginView />} />
            <Route path="/register" element={<RegisterView />} />

            {/* === 根路径重定向逻辑 === */}
            <Route path="/" element={
              user ? (
                user.role === UserRole.WORKER ? <Navigate to="/worker" replace /> : <Navigate to="/dashboard" replace />
              ) : (
                <Navigate to="/login" replace />
              )
            } />

            {/* === 管理员后台 (使用 DashboardLayout) === */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              {/* 默认子路由: 概览（现场管理员使用专属工作台） */}
              <Route index element={<DashboardIndex />} />

              {/* 超级管理员专属 */}
              <Route path="audit" element={
                <ProtectedRoute roles={[UserRole.SUPER_ADMIN]}>
                  <AuditCenter />
                </ProtectedRoute>
              } />
              <Route path="logs" element={
                <ProtectedRoute roles={[UserRole.SUPER_ADMIN]}>
                  <OperationLogView />
                </ProtectedRoute>
              } />
              <Route path="settings" element={
                <ProtectedRoute roles={[UserRole.SUPER_ADMIN]}>
                  <SystemSettings />
                </ProtectedRoute>
              } />

              {/* 业务子路由 */}
              <Route path="bases" element={<BaseManagement />} />

              <Route path="attendance" element={
                <ProtectedRoute roles={[UserRole.SUPER_ADMIN, UserRole.FIELD_MANAGER, UserRole.BASE_MANAGER]}>
                  <AttendanceManagement />
                </ProtectedRoute>
              } />

              <Route path="payroll" element={
                <ProtectedRoute roles={[UserRole.SUPER_ADMIN, UserRole.BASE_MANAGER]}>
                  <PayrollView />
                </ProtectedRoute>
              } />

              <Route path="workers" element={
                <ProtectedRoute roles={[UserRole.SUPER_ADMIN, UserRole.FIELD_MANAGER]}>
                  <WorkerManagement />
                </ProtectedRoute>
              } />

              <Route path="jobs" element={
                <ProtectedRoute roles={[UserRole.SUPER_ADMIN, UserRole.BASE_MANAGER]}>
                  <JobManagement />
                </ProtectedRoute>
              } />

              {/* 现场管理员专属 */}
              <Route path="field-workers" element={
                <ProtectedRoute roles={[UserRole.FIELD_MANAGER]}>
                  <FieldWorkers />
                </ProtectedRoute>
              } />
            </Route>

            {/* === 采摘工端 (独立布局，按计划书：浏览基地与岗位、报名、签到码、我的报名与个人信息) === */}
            <Route path="/worker" element={
              <ProtectedRoute roles={[UserRole.WORKER]}>
                <WorkerView />
              </ProtectedRoute>
            } />

            {/* === 404 === */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}