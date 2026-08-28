import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ReportDateTimelineOnly1787929200000 implements MigrationInterface {
  name = 'ReportDateTimelineOnly1787929200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM timeline_events AS event
      USING documents AS document
      WHERE event.metadata ->> 'documentId' = document.id::text
        AND document.documented_at IS NULL
    `);
  }

  public async down(): Promise<void> {
    // Generated timeline entries are recreated by document recognition after a date is available.
  }
}
