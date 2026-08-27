import { randomUUID } from 'node:crypto';

import type { FastifyReply, FastifyRequest } from 'fastify';

export interface AuthenticatedUser {
  id: string;
  username: string;
  displayName: string;
}

export interface RequestSession {
  id: string;
  csrfToken: string;
  user: AuthenticatedUser;
}

export type ValveRequest = FastifyRequest & {
  requestId: string;
  authSession?: RequestSession;
};

export function assignRequestId(request: FastifyRequest, reply: FastifyReply): void {
  const requestIdHeader = request.headers['x-request-id'];
  const requestId = typeof requestIdHeader === 'string' ? requestIdHeader : randomUUID();
  (request as ValveRequest).requestId = requestId;
  reply.header('x-request-id', requestId);
}
