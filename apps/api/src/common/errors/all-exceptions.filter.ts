import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import type { ApiError } from "@kiataker/contracts";
import type { ErrorReporter } from "../observability/error-reporter.service.js";

/** One error shape across the whole API (§29, §42): { code, message, details, requestId }. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly reporter?: ErrorReporter) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const requestId = (req.headers["x-request-id"] as string) ?? randomUUID();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = "INTERNAL_ERROR";
    let message = "Something went wrong";
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === "object" && response !== null) {
        const r = response as Record<string, unknown>;
        code = (r.code as string) ?? code;
        message = (r.message as string) ?? exception.message;
        details = r.details;
      } else {
        message = String(response);
      }
    } else if (exception instanceof Error) {
      // Never leak an internal error's message or stack to the client (§34, Phase 5 hardening).
      // The client gets a generic 500 with the request id; the real cause is captured server-side
      // through the error-reporter seam (structured log now, external tracker when configured).
      this.reporter?.capture(exception, { requestId, path: req.path, method: req.method });
    }

    // Echo the request id so a client (and support) can correlate with the server log.
    res.setHeader("x-request-id", requestId);
    const body: ApiError = { code, message, details, requestId };
    res.status(status).json(body);
  }
}
