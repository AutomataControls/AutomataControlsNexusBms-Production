// @ts-nocheck
/**
 * Checks if a user has the required role for equipment control access
 * Allowed roles: admin, devops, DevOps, facilities, Facilities
 */
export function hasEquipmentControlAccess(userRoles: string[] = []): boolean {
  const allowedRoles = ["admin", "devops", "facilities"]

  // Case-insensitive check for allowed roles
  return userRoles.some((role) => allowedRoles.some((allowedRole) => role.toLowerCase() === allowedRole.toLowerCase()))
}
