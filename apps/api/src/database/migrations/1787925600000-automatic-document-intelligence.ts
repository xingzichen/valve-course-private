import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AutomaticDocumentIntelligence1787925600000 implements MigrationInterface {
  name = 'AutomaticDocumentIntelligence1787925600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE documents
        ADD COLUMN title varchar(300),
        ADD COLUMN summary text,
        ADD COLUMN documented_at timestamptz,
        ADD COLUMN date_precision varchar(20) NOT NULL DEFAULT 'UNKNOWN',
        ADD COLUMN facility varchar(200),
        ADD COLUMN department varchar(120),
        ADD COLUMN warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN ai_advice jsonb
    `);
    await queryRunner.query(
      'CREATE INDEX documents_documented_at_idx ON documents(documented_at DESC)'
    );
    await queryRunner.query(`
      ALTER TABLE extracted_facts
        ADD COLUMN reference_range varchar(200),
        ADD COLUMN abnormal_flag varchar(32) NOT NULL DEFAULT 'UNKNOWN',
        ADD COLUMN fact_kind varchar(40) NOT NULL DEFAULT 'OTHER'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE extracted_facts
        DROP COLUMN fact_kind,
        DROP COLUMN abnormal_flag,
        DROP COLUMN reference_range
    `);
    await queryRunner.query('DROP INDEX documents_documented_at_idx');
    await queryRunner.query(`
      ALTER TABLE documents
        DROP COLUMN ai_advice,
        DROP COLUMN warnings,
        DROP COLUMN department,
        DROP COLUMN facility,
        DROP COLUMN date_precision,
        DROP COLUMN documented_at,
        DROP COLUMN summary,
        DROP COLUMN title
    `);
  }
}
