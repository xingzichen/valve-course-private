import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { Public } from '../../common/public.decorator';
import { parseWithSchema } from '../../common/zod';
import type { AppEnv } from '../../config/env';
import { AuditService } from '../audit/audit.service';
import { CSRF_COOKIE, SESSION_COOKIE } from './auth.constants';
import { AuthService } from './auth.service';

const passwordSchema = z.object({ password: z.string().min(1).max(200) });

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<AppEnv, true>,
    private readonly audit: AuditService
  ) {}

  @Public()
  @Get('setup')
  setupStatus() {
    return this.auth.setupStatus();
  }

  @Public()
  @Post('setup')
  async setup(@Body() body: unknown) {
    const input = parseWithSchema(passwordSchema, body);
    const user = await this.auth.setup(input.password);
    await this.audit.record({
      actorUserId: user.id,
      action: 'AUTH_SETUP',
      resourceType: 'User',
      resourceId: user.id
    });
    return { configured: true };
  }

  @Public()
  @Post('login')
  async login(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply
  ) {
    const input = parseWithSchema(passwordSchema, body);
    const { token, session } = await this.auth.login(input.password, request.headers['user-agent']);
    this.setCookies(reply, token, session.csrfToken, session.expiresAt);
    await this.audit.record({
      actorUserId: session.userId,
      action: 'AUTH_LOGIN',
      resourceType: 'Session',
      resourceId: session.id
    });
    return {
      user: {
        id: session.user.id,
        username: session.user.username,
        displayName: session.user.displayName
      }
    };
  }

  @Get('session')
  session(@Req() request: any) {
    return { user: request.authSession.user, csrfToken: request.authSession.csrfToken };
  }

  @Post('logout')
  async logout(@Req() request: any, @Res({ passthrough: true }) reply: FastifyReply) {
    const token = request.cookies[SESSION_COOKIE];
    await this.auth.logout(token);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    reply.clearCookie(CSRF_COOKIE, { path: '/' });
    await this.audit.record({
      actorUserId: request.authSession.user.id,
      action: 'AUTH_LOGOUT',
      resourceType: 'Session',
      resourceId: request.authSession.id
    });
    return { loggedOut: true };
  }

  private setCookies(reply: FastifyReply, token: string, csrfToken: string, expires: Date): void {
    const secure = this.config.get('SESSION_COOKIE_SECURE', { infer: true });
    reply.setCookie(SESSION_COOKIE, token, {
      path: '/',
      httpOnly: true,
      secure,
      sameSite: 'strict',
      expires
    });
    reply.setCookie(CSRF_COOKIE, csrfToken, {
      path: '/',
      httpOnly: false,
      secure,
      sameSite: 'strict',
      expires
    });
  }
}
