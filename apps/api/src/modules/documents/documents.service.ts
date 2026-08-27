import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';

import { InjectQueue } from '@nestjs/bullmq';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnsupportedMediaTypeException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import type { MultipartFile } from '@fastify/multipart';
import type { FastifyReply } from 'fastify';
import type { Queue } from 'bullmq';
import { IsNull, Repository } from 'typeorm';
import { z } from 'zod';

import type { AppEnv } from '../../config/env';
import {
  DocumentEntity,
  ExtractedFactEntity,
  ExtractionRunEntity,
  SourceEntity
} from '../../database/entities';
import { parseWithSchema } from '../../common/zod';
import { DOCUMENT_PROMPT_VERSION, DOCUMENT_QUEUE } from './documents.constants';

const documentTypeSchema = z.enum([
  'ECG_PDF',
  'AFIB_HISTORY_PDF',
  'MEDICATION_LIST',
  'ECHO_REPORT',
  'LAB_REPORT',
  'PRESCRIPTION',
  'OUTPATIENT_RECORD',
  'DISCHARGE_SUMMARY',
  'OTHER'
]);
const verificationSchema = z.object({
  status: z.enum(['CONFIRMED', 'REJECTED']),
  valueText: z.string().max(30_000).optional()
});

@Injectable()
export class DocumentsService {
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
    documentTypeInput: unknown,
    sourceId?: string
  ): Promise<{ document: DocumentEntity; duplicate: boolean }> {
    const documentType = parseWithSchema(documentTypeSchema, documentTypeInput || 'OTHER');
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
          message: '仅支持 PDF、JPEG 和 PNG 文件'
        });
      const sha256 = hash.digest('hex');
      const duplicate = await this.documents.findOne({ where: { sha256 } });
      if (duplicate) {
        await rm(tempPath, { force: true });
        return { document: duplicate, duplicate: true };
      }
      const ext =
        detected === 'application/pdf' ? '.pdf' : detected === 'image/png' ? '.png' : '.jpg';
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
          documentType,
          status: 'UPLOADED',
          sourceId: sourceId ?? null
        })
      );
      return { document, duplicate: false };
    } catch (error) {
      await rm(tempPath, { force: true });
      throw error;
    }
  }

  list(limit: number): Promise<DocumentEntity[]> {
    return this.documents.find({
      where: { archivedAt: IsNull() },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 200)
    });
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
      where: { documentId: id, status: 'QUEUED' },
      order: { createdAt: 'DESC' }
    });
    if (active)
      throw new ConflictException({
        code: 'EXTRACTION_ALREADY_QUEUED',
        message: '此文档已在等待解析',
        runId: active.id
      });
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
    return run;
  }

  async extraction(
    id: string
  ): Promise<{ runs: ExtractionRunEntity[]; facts: ExtractedFactEntity[] }> {
    await this.get(id);
    const [runs, facts] = await Promise.all([
      this.runs.find({ where: { documentId: id }, order: { createdAt: 'DESC' } }),
      this.facts.find({ where: { documentId: id }, order: { createdAt: 'ASC' } })
    ]);
    return { runs, facts };
  }

  async verifyFact(id: string, body: unknown): Promise<ExtractedFactEntity> {
    const input = parseWithSchema(verificationSchema, body);
    const fact = await this.facts.findOne({ where: { id } });
    if (!fact) throw new NotFoundException({ code: 'FACT_NOT_FOUND', message: '抽取字段不存在' });
    fact.verificationStatus = input.status;
    if (input.valueText !== undefined) fact.valueText = input.valueText;
    return this.facts.save(fact);
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
  ): Promise<'application/pdf' | 'image/jpeg' | 'image/png' | null> {
    const handle = await open(path, 'r');
    try {
      const bytes = Buffer.alloc(16);
      await handle.read(bytes, 0, bytes.length, 0);
      if (bytes.subarray(0, 5).toString() === '%PDF-') return 'application/pdf';
      if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
      if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
        return 'image/png';
      return null;
    } finally {
      await handle.close();
    }
  }
}
