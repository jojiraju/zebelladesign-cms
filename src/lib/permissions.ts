export type Role = 'admin' | 'editor' | 'fulfillment'
export type Permission =
  | 'content:write' | 'catalog:write' | 'orders:read' | 'orders:fulfil' | 'orders:refund'
  | 'inventory:write' | 'coupons:write' | 'customers:read' | 'analytics:read' | 'audit:read' | 'roles:manage'

// UI hint only. The API enforces the same table in accounts/permissions.py.
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: ['content:write', 'catalog:write', 'orders:read', 'orders:fulfil', 'orders:refund', 'inventory:write', 'coupons:write', 'customers:read', 'analytics:read', 'audit:read', 'roles:manage'],
  editor: ['content:write', 'catalog:write', 'coupons:write', 'analytics:read', 'orders:read'],
  fulfillment: ['orders:read', 'orders:fulfil', 'inventory:write', 'customers:read'],
}

export const isRole = (v: unknown): v is Role => v === 'admin' || v === 'editor' || v === 'fulfillment'
export const can = (role: Role | null, p: Permission) => !!role && ROLE_PERMISSIONS[role].includes(p)
