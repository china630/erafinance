import type { SeedContext } from "../../_engine/upsert";
import { ROLE_PERMISSION_MATRIX } from "./matrix.data";

export async function seedRolePermissions(ctx: SeedContext): Promise<void> {
  if (ctx.dryRun) return;
  const roles = await ctx.prisma.role.findMany({ select: { id: true, code: true } });
  const perms = await ctx.prisma.permission.findMany({ select: { id: true, code: true } });
  const roleByCode = new Map(roles.map((r) => [r.code, r.id]));
  const permByCode = new Map(perms.map((p) => [p.code, p.id]));

  for (const [roleCode, permCodes] of Object.entries(ROLE_PERMISSION_MATRIX)) {
    const roleId = roleByCode.get(roleCode);
    if (!roleId) continue;
    for (const permCode of permCodes) {
      const permissionId = permByCode.get(permCode);
      if (!permissionId) continue;
      await ctx.prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId, permissionId },
        },
        create: { roleId, permissionId },
        update: {},
      });
    }
  }
}
