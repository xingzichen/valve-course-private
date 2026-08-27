import { BadRequestException } from '@nestjs/common';
import type { ZodType } from 'zod';

export function parseWithSchema<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new BadRequestException({
      code: 'VALIDATION_FAILED',
      message: '输入内容不符合要求',
      details: result.error.flatten()
    });
  }
  return result.data;
}
