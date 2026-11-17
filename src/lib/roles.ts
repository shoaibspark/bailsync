export const ROLES = ["SUPERADMIN", "ADMIN", "SCORER", "VIEWER"] as const

export type AppRole = (typeof ROLES)[number]

export const ROLE_LABELS: Record<AppRole, string> = {
  SUPERADMIN: "Super admin",
  ADMIN: "Club admin",
  SCORER: "Scorer",
  VIEWER: "Viewer",
}

export function isSuperadmin(role: AppRole | null | undefined): boolean {
  return role === "SUPERADMIN"
}

export function isManager(role: AppRole | null | undefined): boolean {
  return role === "SUPERADMIN" || role === "ADMIN"
}

export function canScore(role: AppRole | null | undefined): boolean {
  return role === "SUPERADMIN" || role === "ADMIN" || role === "SCORER"
}

export function canManageUsers(role: AppRole | null | undefined): boolean {
  return isSuperadmin(role)
}
