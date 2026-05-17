import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";

/**
 * Единый JSON для клиента: message — всегда строка (в т.ч. из массива class-validator).
 * `@Catch()` без аргументов: ловим всё (HttpException + любую не-Http ошибку), чтобы
 *  - не возвращать клиенту стектрейс из not-Http исключений (например `TypeError` из `res.json`);
 *  - в логе всегда был `method url` — иначе по `ExceptionsHandler` непонятно, какой роут упал.
 */
@Catch()
export class HttpApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const routeInfo = `${req.method ?? "-"} ${req.originalUrl ?? req.url ?? "-"}`;

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();

      let message = exception.message;
      let code: string | undefined;

      if (typeof body === "string") {
        message = body;
      } else if (body && typeof body === "object") {
        const o = body as Record<string, unknown>;
        if (typeof o.code === "string") code = o.code;
        const m = o.message;
        if (typeof m === "string") message = m;
        else if (Array.isArray(m) && m.every((x) => typeof x === "string")) {
          message = m.join("; ");
        } else if (Array.isArray(m)) {
          message = m
            .map((x) => (typeof x === "string" ? x : JSON.stringify(x)))
            .join("; ");
        }
      }

      if (status >= 500) {
        this.logger.warn(`${status} ${routeInfo} ${message}`);
      }

      const payload: Record<string, unknown> = {
        statusCode: status,
        message,
        error: HttpStatus[status] ?? "Error",
      };
      if (code) payload.code = code;

      res.status(status).json(payload);
      return;
    }

    const errMessage =
      exception instanceof Error
        ? exception.stack ?? exception.message
        : String(exception);
    this.logger.error(`500 ${routeInfo} ${errMessage}`);

    if (res.headersSent) {
      res.end();
      return;
    }
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "Internal server error",
      error: HttpStatus[HttpStatus.INTERNAL_SERVER_ERROR] ?? "Internal Server Error",
    });
  }
}
