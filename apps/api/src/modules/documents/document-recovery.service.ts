import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';

import { DocumentsService } from './documents.service';

@Injectable()
export class DocumentRecoveryService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DocumentRecoveryService.name);

  constructor(private readonly documents: DocumentsService) {}

  async onApplicationBootstrap(): Promise<void> {
    const sanitized = await this.documents.sanitizeExistingAdvice();
    if (sanitized > 0) {
      this.logger.log(`Applied medical advice safety rules to ${sanitized} existing documents`);
    }
    const recovered = await this.documents.recoverIncomplete();
    if (recovered > 0) {
      this.logger.log(`Queued ${recovered} documents for automatic v2 recognition`);
    }
  }
}
