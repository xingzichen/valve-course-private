import { createHash, randomBytes } from 'node:crypto';

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { LessThan, Repository } from 'typeorm';
import { z } from 'zod';

import { SessionEntity, UserEntity } from '../../database/entities';
import type { AppEnv } from '../../config/env';

const username = 'admin';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(SessionEntity) private readonly sessions: Repository<SessionEntity>,
    private readonly config: ConfigService<AppEnv, true>
  ) {}

  async setupStatus(): Promise<{ setupRequired: boolean }> {
    return { setupRequired: (await this.users.count()) === 0 };
  }

  async setup(password: string): Promise<UserEntity> {
    if ((await this.users.count()) > 0) {
      throw new UnauthorizedException({ code: 'SETUP_CLOSED', message: '初始化入口已经关闭' });
    }
    this.validatePassword(password);
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    return this.users.save(
      this.users.create({ username, passwordHash, displayName: '家庭管理员' })
    );
  }

  async login(
    password: string,
    userAgent?: string
  ): Promise<{ token: string; session: SessionEntity }> {
    const user = await this.users.findOne({ where: { username } });
    const passwordValid = user ? await argon2.verify(user.passwordHash, password) : false;
    if (!user || !passwordValid) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: '密码错误' });
    }

    const token = randomBytes(32).toString('base64url');
    const csrfToken = randomBytes(24).toString('base64url');
    const ttlDays = this.config.get('SESSION_TTL_DAYS', { infer: true });
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
    const session = await this.sessions.save(
      this.sessions.create({
        tokenHash: this.hashToken(token),
        csrfToken,
        userId: user.id,
        expiresAt,
        userAgent: userAgent?.slice(0, 500) ?? null
      })
    );
    session.user = user;
    return { token, session };
  }

  async authenticate(token?: string): Promise<SessionEntity | null> {
    if (!token) return null;
    const session = await this.sessions.findOne({
      where: { tokenHash: this.hashToken(token) },
      relations: { user: true }
    });
    if (!session || session.expiresAt.getTime() <= Date.now() || session.archivedAt) return null;
    return session;
  }

  async logout(token?: string): Promise<void> {
    if (!token) return;
    await this.sessions.delete({ tokenHash: this.hashToken(token) });
  }

  async cleanupExpired(): Promise<number> {
    const result = await this.sessions.delete({ expiresAt: LessThan(new Date()) });
    return result.affected ?? 0;
  }

  private validatePassword(password: string): void {
    const result = z.string().min(12).max(200).safeParse(password);
    if (!result.success) {
      throw new UnauthorizedException({
        code: 'WEAK_PASSWORD',
        message: '管理密码至少需要 12 个字符'
      });
    }
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
