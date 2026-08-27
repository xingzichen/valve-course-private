import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { ValveRequest } from '../../common/http';
import { IS_PUBLIC_KEY } from '../../common/public.decorator';

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<ValveRequest>();
    if (safeMethods.has(request.method)) return true;
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (isPublic) return true;
    const csrfHeader = request.headers['x-csrf-token'];
    if (typeof csrfHeader !== 'string' || csrfHeader !== request.authSession?.csrfToken) {
      throw new ForbiddenException({
        code: 'CSRF_INVALID',
        message: '安全校验已失效，请刷新页面重试'
      });
    }
    return true;
  }
}
