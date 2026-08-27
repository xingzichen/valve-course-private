import { InjectQueue } from '@nestjs/bullmq';
import { assessUrgency } from '@valve/clinical-rules';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import type { Queue } from 'bullmq';
import { IsNull, Repository } from 'typeorm';
import { z } from 'zod';

import type { AppEnv } from '../../config/env';
import { AiAnalysisEntity } from '../../database/entities';
import { AI_PROMPT_VERSION, AI_QUEUE } from './ai.constants';

export const analysisInputSchema = z.object({
  analysisType: z.enum([
    'GENERAL_QUESTION',
    'COURSE_SUMMARY',
    'VISIT_PREPARATION',
    'MEDICATION_DISCUSSION',
    'SOURCE_REVIEW',
    'SECOND_OPINION_COMPARISON'
  ]),
  question: z.string().trim().min(2).max(10_000),
  urgentSymptoms: z
    .object({
      chestPain: z.boolean().default(false),
      syncope: z.boolean().default(false),
      severeDyspnea: z.boolean().default(false),
      strokeSigns: z.boolean().default(false),
      majorBleeding: z.boolean().default(false),
      persistentFastHeartRate: z.boolean().default(false)
    })
    .default({
      chestPain: false,
      syncope: false,
      severeDyspnea: false,
      strokeSigns: false,
      majorBleeding: false,
      persistentFastHeartRate: false
    })
});

@Injectable()
export class AiService {
  constructor(
    @InjectRepository(AiAnalysisEntity) private readonly analyses: Repository<AiAnalysisEntity>,
    @InjectQueue(AI_QUEUE) private readonly queue: Queue,
    private readonly config: ConfigService<AppEnv, true>
  ) {}

  async create(input: z.infer<typeof analysisInputSchema>): Promise<AiAnalysisEntity> {
    const urgency = assessUrgency(input.urgentSymptoms);
    if (urgency.urgent) {
      return this.analyses.save(
        this.analyses.create({
          analysisType: input.analysisType,
          question: input.question,
          status: 'COMPLETED',
          modelId: 'DETERMINISTIC_SAFETY_RULES',
          promptVersion: 'urgent-gate-v1',
          answer: `紧急提示：${urgency.instruction}\n\n已报告的高风险表现：${urgency.matched.join('、')}。`,
          citations: [],
          completedAt: new Date()
        })
      );
    }
    const analysis = await this.analyses.save(
      this.analyses.create({
        analysisType: input.analysisType,
        question: input.question,
        status: 'QUEUED',
        modelId: this.config.get('OMLX_CHAT_MODEL', { infer: true }),
        promptVersion: AI_PROMPT_VERSION
      })
    );
    await this.queue.add(
      'analyze',
      { analysisId: analysis.id },
      {
        jobId: analysis.id,
        attempts: 2,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: 100,
        removeOnFail: 100
      }
    );
    return analysis;
  }

  list(limit: number): Promise<AiAnalysisEntity[]> {
    return this.analyses.find({
      where: { archivedAt: IsNull() },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 100)
    });
  }

  async get(id: string): Promise<AiAnalysisEntity> {
    const value = await this.analyses.findOne({ where: { id, archivedAt: IsNull() } });
    if (!value)
      throw new NotFoundException({ code: 'ANALYSIS_NOT_FOUND', message: '分析记录不存在' });
    return value;
  }
}
