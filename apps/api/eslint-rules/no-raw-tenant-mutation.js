/**
 * Forbid prisma.$executeRaw / $executeRawUnsafe in tenant domain modules (tenant mutations must go through Prisma client + extensions).
 * Whitelist: platform-recovery, audit, migration tooling, prisma layer, scripts.
 */
const RAW_METHODS = new Set(["$executeRaw", "$executeRawUnsafe"]);

function isWhitelisted(filePath) {
  const p = filePath.replace(/\\/g, "/");
  return (
    p.includes("/src/platform-recovery/") ||
    p.includes("/src/audit/") ||
    p.includes("/src/prisma/") ||
    p.includes("/src/migration/") ||
    p.includes("/src/integrations/") ||
    p.includes("/src/ocr/") ||
    p.includes("/src/customs/") ||
    p.includes("/scripts/") ||
    p.includes("/test/")
  );
}

function isRestrictedTenantModule(filePath) {
  const p = filePath.replace(/\\/g, "/");
  if (!p.includes("/src/")) {
    return false;
  }
  if (isWhitelisted(p)) {
    return false;
  }
  return /\/src\/(invoices|hr|inventory|counterparties|accounting|banking|treasury|products|kassa|fixed-assets|manufacturing|tax|integrations|ocr|customs|subscription|billing|organizations|accounts|fx|reporting|reports|signature|notifications)\//.test(
    p,
  );
}

function isPrismaRawCall(node) {
  if (node.type !== "CallExpression") {
    return false;
  }
  const c = node.callee;
  if (c.type !== "MemberExpression" || c.property.type !== "Identifier") {
    return false;
  }
  return RAW_METHODS.has(c.property.name);
}

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow Prisma $executeRaw* in tenant business modules; use delegates or platform-recovery.",
    },
    schema: [],
  },
  create(context) {
    const filename = context.getFilename();
    if (!isRestrictedTenantModule(filename)) {
      return {};
    }
    return {
      CallExpression(node) {
        if (!isPrismaRawCall(node)) {
          return;
        }
        context.report({
          node,
          message:
            "Do not use prisma.$executeRaw / $executeRawUnsafe here; tenant mutations must use Prisma models (tenant + soft-delete extensions). Use platform-recovery or prisma/ for raw SQL.",
        });
      },
    };
  },
};
