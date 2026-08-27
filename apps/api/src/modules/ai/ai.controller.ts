import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { CurrentUser, type CurrentUserValue } from '../../common/current-user.decorator';
import { parseWithSchema } from '../../common/zod';
import { AuditService } from '../audit/audit.service';
import { analysisInputSchema, AiService } from './ai.service';

@ApiTags('ai')
@Controller('ai/analyses')
export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly audit: AuditService
  ) {}

  @Get() list(@Query('limit') limit?: string) {
    return this.ai.list(Number(limit ?? 30));
  }
  @Get(':id') get(@Param('id') id: string) {
    return this.ai.get(id);
  }

  @Post()
  async create(@Body() body: unknown, @CurrentUser() user: CurrentUserValue) {
    const result = await this.ai.create(parseWithSchema(analysisInputSchema, body));
    await this.audit.record({
      actorUserId: user.id,
      action: 'AI_ANALYSIS_QUEUE',
      resourceType: 'AiAnalysis',
      resourceId: result.id
    });
    return result;
  }
}
