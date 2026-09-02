import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { ActiveUser } from '../types/active-user.type';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);
// Public auth routes (login/refresh/OTP) have no req.user and are already
// skipped by that check below; only /v1/health and the gateway webhook need an
// explicit path skip.
const SKIP_PATH_PREFIXES = ['/v1/health', '/v1/payments/webhook'];
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REDACTED_KEYS = new Set([
  'password',
  'passwordhash',
  'newpassword',
  'currentpassword',
  'refreshtoken',
  'otp',
  'token',
  'firebaseidtoken',
]);

/**
 * Best-effort, fire-and-forget audit trail for every mutating request, on top of
 * the richer, transactional audit rows some services (fees/payments) already
 * write for their own actions. Two different "shapes" of audit_logs row will
 * exist going forward — that's intentional, see the plan doc; don't try to
 * reconcile the two into one format.
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request & { tenantId?: string; user?: ActiveUser }>();

    if (!MUTATING_METHODS.has(req.method)) return next.handle();
    if (SKIP_PATH_PREFIXES.some((p) => req.path.startsWith(p))) return next.handle();
    if (!req.user) return next.handle();

    const { action, entityType, pathEntityId } = this.describeRoute(req);
    const res = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      tap((responseBody) => {
        const entityId = pathEntityId ?? this.extractIdFromBody(responseBody) ?? null;
        this.write({
          tenantId: req.tenantId ?? null,
          actorId: req.user!.id,
          action,
          entityType,
          entityId,
          diff: {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            body: this.redact(req.body),
          },
        });
      }),
    );
  }

  private describeRoute(req: Request) {
    const segments = req.path.replace(/^\/v1\//, '').split('/').filter(Boolean);
    let pathEntityId: string | null = null;

    const normalized = segments.map((segment) => {
      if (UUID_REGEX.test(segment)) {
        pathEntityId = segment;
        return ':id';
      }
      return segment;
    });

    return {
      action: `${req.method} /${normalized.join('/')}`,
      entityType: segments[0] ?? 'unknown',
      pathEntityId,
    };
  }

  private extractIdFromBody(body: unknown): string | null {
    if (body && typeof body === 'object' && 'id' in body && typeof (body as { id: unknown }).id === 'string') {
      return (body as { id: string }).id;
    }
    return null;
  }

  private redact(body: unknown): unknown {
    if (!body || typeof body !== 'object') return body;
    const clone: Record<string, unknown> = { ...(body as Record<string, unknown>) };
    for (const key of Object.keys(clone)) {
      if (REDACTED_KEYS.has(key.toLowerCase())) {
        clone[key] = '[REDACTED]';
      }
    }
    return clone;
  }

  private write(data: {
    tenantId: string | null;
    actorId: string;
    action: string;
    entityType: string;
    entityId: string | null;
    diff: Record<string, unknown>;
  }) {
    this.prisma.auditLog
      .create({ data: data as unknown as Prisma.AuditLogCreateInput })
      .catch((err) => this.logger.error(`audit log write failed: ${(err as Error).message}`));
  }
}
