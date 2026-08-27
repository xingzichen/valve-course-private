import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppEnv } from '../../config/env';

interface ChatContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

@Injectable()
export class OmlxService {
  constructor(private readonly config: ConfigService<AppEnv, true>) {}

  async chat(input: {
    system: string;
    prompt: string;
    images?: Array<{ mimeType: string; base64: string }>;
    temperature?: number;
    maxTokens?: number;
  }): Promise<{ content: string; model: string; raw: Record<string, unknown> }> {
    const baseUrl = this.config.get('OMLX_BASE_URL', { infer: true }).replace(/\/$/, '');
    const model = this.config.get('OMLX_CHAT_MODEL', { infer: true });
    const apiKey = this.config.get('OMLX_API_KEY', { infer: true });
    const timeout = this.config.get('OMLX_TIMEOUT_MS', { infer: true });
    const content: ChatContentPart[] = [{ type: 'text', text: input.prompt }];
    for (const image of input.images ?? []) {
      content.push({
        type: 'image_url',
        image_url: { url: `data:${image.mimeType};base64,${image.base64}` }
      });
    }

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: input.system },
            { role: 'user', content }
          ],
          temperature: input.temperature ?? 0,
          max_tokens: input.maxTokens ?? 4096,
          stream: false,
          chat_template_kwargs: { enable_thinking: false }
        }),
        signal: AbortSignal.timeout(timeout)
      });
    } catch (error) {
      throw new ServiceUnavailableException({
        code: 'OMLX_UNREACHABLE',
        message: '本地模型服务当前不可用',
        details: error instanceof Error ? error.message : String(error)
      });
    }

    let raw: Record<string, unknown>;
    try {
      raw = (await response.json()) as Record<string, unknown>;
    } catch {
      throw new ServiceUnavailableException({
        code: 'OMLX_INVALID_RESPONSE',
        message: '本地模型返回了无法解析的响应'
      });
    }
    if (!response.ok) {
      throw new ServiceUnavailableException({
        code: 'OMLX_ERROR',
        message: '本地模型调用失败',
        details: raw
      });
    }
    const choices = raw.choices as Array<{ message?: { content?: string } }> | undefined;
    const result = choices?.[0]?.message?.content;
    if (!result)
      throw new ServiceUnavailableException({
        code: 'OMLX_EMPTY',
        message: '本地模型没有返回内容'
      });
    return { content: result, model, raw };
  }

  parseJson(content: string): unknown {
    const trimmed = content
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '');
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace < 0 || lastBrace < firstBrace) throw new Error('模型输出中没有 JSON 对象');
    return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
  }
}
