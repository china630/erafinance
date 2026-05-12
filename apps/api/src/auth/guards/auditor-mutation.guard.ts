import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { UserRole } from "@erafinance/database";
import type { AuthUser } from "../types/auth-user";

const MUTATION_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

@Injectable()
export class AuditorMutationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      method?: string;
      path?: string;
      url?: string;
      originalUrl?: string;
      body?: unknown;
      user?: AuthUser;
    }>();
    const method = (req.method ?? "").toUpperCase();
    if (!MUTATION_METHODS.has(method)) {
      return true;
    }

    const user = req.user;
    if (!user?.role || user.role !== UserRole.AUDITOR) {
      return true;
    }

    const url = (req.originalUrl ?? req.url ?? req.path ?? "").split("?")[0] ?? "";
    if (url.endsWith("/auth/logout") || url.includes("/api/auth/logout")) {
      return true;
    }
    if (url.includes("/early-access/")) {
      return true;
    }

    /** AUDITOR may post/patch/delete activity-stream comments only as audit notes (cowork layer). */
    const isActivityCommentPost = /\/activity\/[^/]+\/[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}\/comments$/i.test(
      url,
    );
    const isActivityCommentById =
      /\/activity\/comments\/[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}$/i.test(
        url,
      );
    const body = req.body as { kind?: unknown } | undefined;
    if (method === "POST" && isActivityCommentPost) {
      if (body?.kind === "AUDIT_NOTE") {
        return true;
      }
      throw new ForbiddenException({
        code: "AUDITOR_READ_ONLY",
        message:
          "AUDITOR may only create comments with kind AUDIT_NOTE (audit requests / notes).",
      });
    }
    if ((method === "PATCH" || method === "DELETE") && isActivityCommentById) {
      return true;
    }

    throw new ForbiddenException({
      code: "AUDITOR_READ_ONLY",
      message: "AUDITOR role has read-only access. Mutations are not allowed.",
    });
  }
}
