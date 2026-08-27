import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  type ExceptionFilter
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';

import type { ValveRequest } from './http';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<ValveRequest>();
    const reply = context.getResponse<FastifyReply>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const response = exception instanceof HttpException ? exception.getResponse() : null;

    let code = status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED';
    let message =
      status === 500
        ? '服务器处理请求时发生错误'
        : exception instanceof Error
          ? exception.message
          : '请求失败';
    let details: unknown;

    if (typeof response === 'object' && response !== null) {
      const payload = response as Record<string, unknown>;
      if (typeof payload.code === 'string') code = payload.code;
      if (typeof payload.message === 'string') message = payload.message;
      details = payload.details;
    } else if (typeof response === 'string') {
      message = response;
    }

    void reply.status(status).send({ code, message, details, requestId: request.requestId });
  }
}
