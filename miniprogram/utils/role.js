/**
 * Layer: Mini Program Utility
 * Responsibility: Provides role normalization helpers for routing and permission checks.
 */

function resolveRole(user) {
  if (!user) return 'worker';
  return user.role || user.roleKey || 'worker';
}

function isSuperAdminRole(role) {
  return role === 'super_admin' || role === 'region_admin';
}

function isAdminRole(role) {
  return isSuperAdminRole(role) || role === 'base_manager' || role === 'field_manager';
}

function roleLabel(role) {
  switch (role) {
    case 'super_admin':
    case 'region_admin':
      return '超级管理员';
    case 'base_manager':
      return '基地管理员';
    case 'field_manager':
      return '现场管理员';
    default:
      return '采摘工';
  }
}

module.exports = {
  resolveRole,
  isAdminRole,
  isSuperAdminRole,
  roleLabel,
};
