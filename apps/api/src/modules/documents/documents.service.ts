import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';

import { InjectQueue } from '@nestjs/bullmq';
import {
  Injectable,
  Logger,
  NotFoundException,
  UnsupportedMediaTypeException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import type { MultipartFile } from '@fastify/multipart';
import { documentAdviceSchema, documentExtractionSchema } from '@valve/contracts';
import type { FastifyReply } from 'fastify';
import type { Queue } from 'bullmq';
import { In, IsNull, Repository } from 'typeorm';
import { z } from 'zod';

import type { AppEnv } from '../../config/env';
import {
  DocumentEntity,
  ExtractedFactEntity,
  ExtractionRunEntity,
  SourceEntity
} from '../../database/entities';
import { parseWithSchema } from '../../common/zod';
import { sanitizeDocumentAdvice } from './document-advice-safety';
import { DOCUMENT_PROMPT_VERSION, DOCUMENT_QUEUE } from './documents.constants';

const verificationSchema = z.object({
  status: z.enum(['CONFIRMED', 'REJECTED']),
  valueText: z.string().max(30_000).optional()
});

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    @InjectRepository(DocumentEntity) private readonly documents: Repository<DocumentEntity>,
    @InjectRepository(ExtractionRunEntity) private readonly runs: Repository<ExtractionRunEntity>,
    @InjectRepository(ExtractedFactEntity) private readonly facts: Repository<ExtractedFactEntity>,
    @InjectRepository(SourceEntity) private readonly sources: Repository<SourceEntity>,
    @InjectQueue(DOCUMENT_QUEUE) private readonly queue: Queue,
    private readonly config: ConfigService<AppEnv, true>
  ) {}

  async upload(
    file: MultipartFile,
    sourceId?: string
  ): Promise<{
    document: DocumentEntity;
    duplicate: boolean;
    extractionRun: ExtractionRunEntity | null;
  }> {
    if (
      sourceId &&
      !(await this.sources.exist({ where: { id: sourceId, archivedAt: IsNull() } }))
    ) {
      throw new NotFoundException({ code: 'SOURCE_NOT_FOUND', message: '信息来源不存在' });
    }
    const root = this.config.get('FILE_STORAGE_ROOT', { infer: true });
    const tempDir = join(root, '.incoming');
    await mkdir(tempDir, { recursive: true });
    const tempPath = join(tempDir, randomUUID());
    const hash = createHash('sha256');
    let bytes = 0;
    file.file.on('data', (chunk: Buffer) => {
      hash.update(chunk);
      bytes += chunk.length;
    });
    try {
      await pipeline(file.file, createWriteStream(tempPath, { flags: 'wx', mode: 0o600 }));
      const detected = await this.detectMime(tempPath);
      if (!detected)
        throw new UnsupportedMediaTypeException({
          code: 'FILE_TYPE_NOT_ALLOWED',
          message: '仅支持 PDF、JPEG、PNG 和 HEIC/HEIF 文件'
        });
      const sha256 = hash.digest('hex');
      const duplicate = await this.documents.findOne({ where: { sha256 } });
      if (duplicate) {
        await rm(tempPath, { force: true });
        return {
          document: duplicate,
          duplicate: true,
          extractionRun: await this.ensureAutomaticQueue(duplicate)
        };
      }
      const ext =
        detected === 'application/pdf'
          ? '.pdf'
          : detected === 'image/png'
            ? '.png'
            : detected === 'image/heic'
              ? '.heic'
              : '.jpg';
      const finalPath = join(root, sha256.slice(0, 2), sha256.slice(2, 4), `${sha256}${ext}`);
      await mkdir(dirname(finalPath), { recursive: true });
      await rename(tempPath, finalPath);
      const document = await this.documents.save(
        this.documents.create({
          sha256,
          originalFilename: basename(file.filename).slice(0, 500),
          mimeType: detected,
          sizeBytes: String(bytes),
          storagePath: finalPath,
          documentType: 'OTHER',
          status: 'UPLOADED',
          sourceId: sourceId ?? null
        })
      );
      return {
        document,
        duplicate: false,
        extractionRun: await this.enqueue(document.id)
      };
    } catch (error) {
      await rm(tempPath, { force: true });
      throw error;
    }
  }

  list(limit: number): Promise<DocumentEntity[]> {
    return this.documents
      .createQueryBuilder('document')
      .where('document.archived_at IS NULL')
      .orderBy('COALESCE(document.documented_at, document.created_at)', 'DESC')
      .addOrderBy('document.created_at', 'DESC')
      .take(Math.min(Math.max(limit, 1), 200))
      .getMany();
  }

  async get(id: string): Promise<DocumentEntity> {
    const document = await this.documents.findOne({ where: { id, archivedAt: IsNull() } });
    if (!document)
      throw new NotFoundException({ code: 'DOCUMENT_NOT_FOUND', message: '文档不存在' });
    return document;
  }

  async sendFile(id: string, reply: FastifyReply): Promise<void> {
    const document = await this.get(id);
    reply.header('Content-Type', document.mimeType);
    reply.header(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(document.originalFilename)}`
    );
    return reply.send(createReadStream(document.storagePath));
  }

  async enqueue(id: string): Promise<ExtractionRunEntity> {
    const document = await this.get(id);
    const active = await this.runs.findOne({
      where: { documentId: id, status: In(['QUEUED', 'PROCESSING']) },
      order: { createdAt: 'DESC' }
    });
    if (active) return active;
    const run = await this.runs.save(
      this.runs.create({
        documentId: id,
        status: 'QUEUED',
        modelId: this.config.get('OMLX_CHAT_MODEL', { infer: true }),
        promptVersion: DOCUMENT_PROMPT_VERSION
      })
    );
    document.status = 'QUEUED';
    await this.documents.save(document);
    try {
      await this.queue.add(
        'extract',
        { runId: run.id },
        {
          jobId: run.id,
          attempts: 2,
          backoff: { type: 'exponential', delay: 10_000 },
          removeOnComplete: 100,
          removeOnFail: 100
        }
      );
    } catch (error) {
      run.status = 'FAILED';
      run.errorMessage = '识别队列暂时不可用，重新上传或重启 Worker 后会自动恢复';
      run.completedAt = new Date();
      document.status = 'UPLOADED';
      await Promise.all([this.runs.save(run), this.documents.save(document)]);
      throw error;
    }
    return run;
  }

  async extraction(id: string): Promise<{
    document: DocumentEntity;
    runs: ExtractionRunEntity[];
    facts: ExtractedFactEntity[];
  }> {
    const document = await this.get(id);
    const [runs, facts] = await Promise.all([
      this.runs.find({ where: { documentId: id }, order: { createdAt: 'DESC' } }),
      this.facts.find({ where: { documentId: id }, order: { createdAt: 'ASC' } })
    ]);
    return { document, runs, facts };
  }

  async verifyFact(id: string, body: unknown): Promise<ExtractedFactEntity> {
    const input = parseWithSchema(verificationSchema, body);
    const fact = await this.facts.findOne({ where: { id } });
    if (!fact) throw new NotFoundException({ code: 'FACT_NOT_FOUND', message: '抽取字段不存在' });
    fact.verificationStatus = input.status;
    if (input.valueText !== undefined) fact.valueText = input.valueText;
    const saved = await this.facts.save(fact);
    const pending = await this.facts.count({
      where: { documentId: fact.documentId, verificationStatus: 'PENDING', archivedAt: IsNull() }
    });
    if (pending === 0) {
      await this.documents.update({ id: fact.documentId }, { status: 'CONFIRMED' });
    }
    return saved;
  }

  async recoverIncomplete(): Promise<number> {
    const documents = await this.documents.find({
      where: {
        status: In(['UPLOADED', 'FAILED', 'REVIEW_REQUIRED']),
        archivedAt: IsNull()
      },
      order: { createdAt: 'ASC' },
      take: 200
    });
    let queued = 0;
    for (const document of documents) {
      const latest = await this.runs.findOne({
        where: { documentId: document.id },
        order: { createdAt: 'DESC' }
      });
      if (
        latest?.promptVersion === DOCUMENT_PROMPT_VERSION &&
        document.status === 'REVIEW_REQUIRED'
      )
        continue;
      try {
        await this.enqueue(document.id);
        queued += 1;
      } catch (error) {
        this.logger.error(
          `Failed to recover document ${document.id}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
    return queued;
  }

  async sanitizeExistingAdvice(): Promise<number> {
    const documents = await this.documents
      .createQueryBuilder('document')
      .where('document.archived_at IS NULL')
      .andWhere('document.ai_advice IS NOT NULL')
      .getMany();
    let updated = 0;
    for (const document of documents) {
      const advice = documentAdviceSchema.safeParse(document.aiAdvice);
      if (!advice.success) continue;
      const facts = await this.facts.find({
        where: { documentId: document.id, archivedAt: IsNull() },
        order: { createdAt: 'ASC' }
      });
      const extraction = documentExtractionSchema.safeParse({
        documentType: document.documentType,
        title: document.title ?? document.originalFilename,
        summary: document.summary ?? '',
        documentedAt: document.documentedAt?.toISOString() ?? null,
        datePrecision: document.datePrecision,
        facility: document.facility,
        department: document.department,
        warnings: document.warnings,
        facts: facts.map((fact) => ({
          fieldKey: fact.fieldKey,
          label: fact.label,
          valueText: fact.valueText,
          valueNumeric: fact.valueNumeric,
          unit: fact.unit,
          referenceRange: fact.referenceRange,
          abnormalFlag: fact.abnormalFlag,
          factKind: fact.factKind,
          pageNumber: fact.pageNumber,
          originalText: fact.originalText,
          confidence: fact.confidence,
          highRisk: fact.highRisk
        }))
      });
      if (!extraction.success) continue;
      const sanitized = sanitizeDocumentAdvice(extraction.data, advice.data);
      if (JSON.stringify(sanitized) === JSON.stringify(advice.data)) continue;
      document.aiAdvice = sanitized;
      await this.documents.save(document);
      updated += 1;
    }
    return updated;
  }

  async documentImages(
    document: DocumentEntity
  ): Promise<Array<{ mimeType: string; base64: string }>> {
    if (document.mimeType.startsWith('image/')) {
      return [
        {
          mimeType: document.mimeType,
          base64: (await readFile(document.storagePath)).toString('base64')
        }
      ];
    }
    throw new Error('PDF_RENDER_REQUIRED');
  }

  private async detectMime(
    path: string
  ): Promise<'application/pdf' | 'image/jpeg' | 'image/png' | 'image/heic' | null> {
    const handle = await open(path, 'r');
    try {
      const bytes = Buffer.alloc(16);
      await handle.read(bytes, 0, bytes.length, 0);
      if (bytes.subarray(0, 5).toString() === '%PDF-') return 'application/pdf';
      if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
      if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
        return 'image/png';
      const containerBrand = bytes.subarray(4, 12).toString('ascii');
      if (/^ftyp(heic|heix|hevc|hevx|mif1|msf1)$/.test(containerBrand)) return 'image/heic';
      return null;
    } finally {
      await handle.close();
    }
  }

  private async ensureAutomaticQueue(
    document: DocumentEntity
  ): Promise<ExtractionRunEntity | null> {
    if (!['UPLOADED', 'FAILED'].includes(document.status)) return null;
    return this.enqueue(document.id);
  }
}
