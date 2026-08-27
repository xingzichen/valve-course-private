import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { ValveRequest } from './http';

export interface CurrentUserValue {
  id: string;
  username: string;
  displayName: string;
}

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<ValveRequest>();
  return request.authSession?.user;
});
