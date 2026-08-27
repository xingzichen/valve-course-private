import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res
} from '@nestjs/common';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { CurrentUser, type CurrentUserValue } from '../../common/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { DocumentsService } from './documents.service';

@ApiTags('documents')
@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documents: DocumentsService,
    private readonly audit: AuditService
  ) {}

  @Get()
  list(@Query('limit') limit?: string) {
    return this.documents.list(Number(limit ?? 50));
  }

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  async upload(
    @Req() request: FastifyRequest,
    @Query('documentType') documentType: string | undefined,
    @Query('sourceId') sourceId: string | undefined,
    @CurrentUser() user: CurrentUserValue
  ) {
    const file = await request.file();
    if (!file) throw new BadRequestException({ code: 'FILE_REQUIRED', message: '请选择一个文件' });
    const result = await this.documents.upload(file, documentType, sourceId);
    await this.audit.record({
      actorUserId: user.id,
      action: result.duplicate ? 'DOCUMENT_DUPLICATE' : 'DOCUMENT_UPLOAD',
      resourceType: 'Document',
      resourceId: result.document.id
    });
    return result;
  }

  @Get(':id') get(@Param('id') id: string) {
    return this.documents.get(id);
  }
  @Get(':id/file') file(@Param('id') id: string, @Res() reply: FastifyReply) {
    return this.documents.sendFile(id, reply);
  }
  @Get(':id/extraction') extraction(@Param('id') id: string) {
    return this.documents.extraction(id);
  }

  @Post(':id/analyze')
  async analyze(@Param('id') id: string, @CurrentUser() user: CurrentUserValue) {
    const run = await this.documents.enqueue(id);
    await this.audit.record({
      actorUserId: user.id,
      action: 'DOCUMENT_ANALYSIS_QUEUE',
      resourceType: 'ExtractionRun',
      resourceId: run.id,
      metadata: { documentId: id }
    });
    return run;
  }

  @Patch('facts/:id/verification')
  async verify(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: CurrentUserValue
  ) {
    const fact = await this.documents.verifyFact(id, body);
    await this.audit.record({
      actorUserId: user.id,
      action: 'EXTRACTED_FACT_VERIFY',
      resourceType: 'ExtractedFact',
      resourceId: fact.id,
      metadata: { status: fact.verificationStatus }
    });
    return fact;
  }
}
