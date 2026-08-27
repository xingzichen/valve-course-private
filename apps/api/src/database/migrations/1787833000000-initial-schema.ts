import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1787833000000 implements MigrationInterface {
  name = 'InitialSchema1787833000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS vector');
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    await queryRunner.query(`
      CREATE TABLE users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        username varchar(80) NOT NULL UNIQUE,
        password_hash varchar(255) NOT NULL,
        display_name varchar(120) NOT NULL DEFAULT '家庭管理员',
        password_changed_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        version integer NOT NULL DEFAULT 1,
        archived_at timestamptz
      )
    `);
    await queryRunner.query(`
      CREATE TABLE sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        token_hash char(64) NOT NULL UNIQUE,
        csrf_token varchar(128) NOT NULL,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at timestamptz NOT NULL,
        last_seen_at timestamptz NOT NULL DEFAULT now(),
        user_agent varchar(500),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        version integer NOT NULL DEFAULT 1,
        archived_at timestamptz
      )
    `);
    await queryRunner.query('CREATE INDEX sessions_expires_at_idx ON sessions(expires_at)');
    await queryRunner.query(`
      CREATE TABLE patient_profiles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        singleton_key varchar(32) NOT NULL DEFAULT 'primary' UNIQUE,
        full_name varchar(120),
        birth_date date,
        sex varchar(32),
        blood_type varchar(16),
        height_cm numeric(6,2),
        weight_kg numeric(6,2),
        allergies text,
        diagnosis_summary text,
        mitral_stenosis_cause varchar(80),
        mitral_stenosis_severity varchar(80),
        atrial_fibrillation_status varchar(40),
        anticoagulation_summary text,
        emergency_contact jsonb NOT NULL DEFAULT '{}'::jsonb,
        preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        version integer NOT NULL DEFAULT 1,
        archived_at timestamptz
      )
    `);
    await queryRunner.query(`
      CREATE TABLE sources (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        source_type varchar(64) NOT NULL,
        title varchar(300) NOT NULL,
        author_name varchar(160),
        organization varchar(200),
        specialty varchar(120),
        platform varchar(120),
        url text,
        published_at timestamptz,
        captured_at timestamptz NOT NULL DEFAULT now(),
        is_patient_specific boolean NOT NULL DEFAULT false,
        data_nature varchar(40),
        original_quote text,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        version integer NOT NULL DEFAULT 1,
        archived_at timestamptz
      )
    `);
    await queryRunner.query('CREATE INDEX sources_source_type_idx ON sources(source_type)');
    await queryRunner.query(`
      CREATE TABLE timeline_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        event_type varchar(64) NOT NULL,
        title varchar(300) NOT NULL,
        description text,
        occurred_at timestamptz NOT NULL,
        source_id uuid REFERENCES sources(id) ON DELETE SET NULL,
        verification_status varchar(32) NOT NULL DEFAULT 'CONFIRMED',
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        version integer NOT NULL DEFAULT 1,
        archived_at timestamptz
      )
    `);
    await queryRunner.query(
      'CREATE INDEX timeline_events_occurred_at_idx ON timeline_events(occurred_at DESC)'
    );
    await queryRunner.query(`
      CREATE TABLE medical_orders (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        ordered_at timestamptz NOT NULL,
        doctor_name varchar(120),
        hospital varchar(200),
        department varchar(120),
        original_text text NOT NULL,
        purpose text,
        status varchar(40) NOT NULL DEFAULT 'PENDING_CONFIRMATION',
        source_id uuid NOT NULL REFERENCES sources(id) ON DELETE RESTRICT,
        selected_option_id uuid,
        choice_rationale text,
        doctor_confirmation_note text,
        selected_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        version integer NOT NULL DEFAULT 1,
        archived_at timestamptz
      )
    `);
    await queryRunner.query(
      'CREATE INDEX medical_orders_status_date_idx ON medical_orders(status, ordered_at DESC)'
    );
    await queryRunner.query(`
      CREATE TABLE order_options (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id uuid NOT NULL REFERENCES medical_orders(id) ON DELETE CASCADE,
        name varchar(200) NOT NULL,
        medication_name varchar(200),
        instructions text,
        conditions text,
        risks text,
        monitoring text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        version integer NOT NULL DEFAULT 1,
        archived_at timestamptz
      )
    `);
    await queryRunner.query(
      'ALTER TABLE medical_orders ADD CONSTRAINT medical_orders_selected_option_fk FOREIGN KEY (selected_option_id) REFERENCES order_options(id) ON DELETE SET NULL'
    );
    await queryRunner.query(`
      CREATE TABLE medications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        generic_name varchar(200) NOT NULL,
        brand_name varchar(200),
        dosage_form varchar(120),
        active boolean NOT NULL DEFAULT true,
        source_id uuid REFERENCES sources(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        version integer NOT NULL DEFAULT 1,
        archived_at timestamptz
      )
    `);
    await queryRunner.query(
      'CREATE INDEX medications_generic_name_idx ON medications(generic_name)'
    );
    await queryRunner.query(`
      CREATE TABLE medication_plans (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        medication_id uuid NOT NULL REFERENCES medications(id) ON DELETE RESTRICT,
        medical_order_id uuid NOT NULL REFERENCES medical_orders(id) ON DELETE RESTRICT,
        dose varchar(120) NOT NULL,
        frequency varchar(120) NOT NULL,
        start_date date NOT NULL,
        end_date date,
        status varchar(32) NOT NULL DEFAULT 'ACTIVE',
        source_id uuid NOT NULL REFERENCES sources(id) ON DELETE RESTRICT,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        version integer NOT NULL DEFAULT 1,
        archived_at timestamptz
      )
    `);
    await queryRunner.query(`
      CREATE TABLE medication_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        medication_plan_id uuid NOT NULL REFERENCES medication_plans(id) ON DELETE CASCADE,
        event_type varchar(40) NOT NULL,
        event_at timestamptz NOT NULL,
        notes text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        version integer NOT NULL DEFAULT 1,
        archived_at timestamptz
      )
    `);
    await queryRunner.query(`
      CREATE TABLE documents (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        sha256 char(64) NOT NULL UNIQUE,
        original_filename varchar(500) NOT NULL,
        mime_type varchar(120) NOT NULL,
        size_bytes bigint NOT NULL,
        storage_path text NOT NULL,
        document_type varchar(64) NOT NULL DEFAULT 'OTHER',
        status varchar(40) NOT NULL DEFAULT 'UPLOADED',
        source_id uuid REFERENCES sources(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        version integer NOT NULL DEFAULT 1,
        archived_at timestamptz
      )
    `);
    await queryRunner.query('CREATE INDEX documents_status_idx ON documents(status)');
    await queryRunner.query(`
      CREATE TABLE extraction_runs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        status varchar(40) NOT NULL DEFAULT 'QUEUED',
        model_id varchar(200) NOT NULL,
        prompt_version varchar(80) NOT NULL,
        raw_output jsonb,
        error_message text,
        started_at timestamptz,
        completed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        version integer NOT NULL DEFAULT 1,
        archived_at timestamptz
      )
    `);
    await queryRunner.query(`
      CREATE TABLE extracted_facts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        extraction_run_id uuid NOT NULL REFERENCES extraction_runs(id) ON DELETE CASCADE,
        document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        field_key varchar(160) NOT NULL,
        label varchar(240) NOT NULL,
        value_text text NOT NULL,
        value_numeric numeric,
        unit varchar(80),
        page_number integer,
        original_text text,
        confidence numeric(5,4),
        high_risk boolean NOT NULL DEFAULT false,
        verification_status varchar(32) NOT NULL DEFAULT 'PENDING',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        version integer NOT NULL DEFAULT 1,
        archived_at timestamptz
      )
    `);
    await queryRunner.query(`
      CREATE TABLE observations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name_original varchar(240) NOT NULL,
        name_normalized varchar(240) NOT NULL,
        value_numeric numeric,
        value_text text,
        unit_original varchar(80),
        reference_text varchar(200),
        abnormal_flag varchar(32),
        observed_at timestamptz NOT NULL,
        source_id uuid REFERENCES sources(id) ON DELETE SET NULL,
        verification_status varchar(32) NOT NULL DEFAULT 'CONFIRMED',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        version integer NOT NULL DEFAULT 1,
        archived_at timestamptz
      )
    `);
    await queryRunner.query(
      'CREATE INDEX observations_name_date_idx ON observations(name_normalized, observed_at DESC)'
    );
    await queryRunner.query(`
      CREATE TABLE vital_records (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        vital_type varchar(80) NOT NULL,
        value_numeric numeric NOT NULL,
        unit varchar(40) NOT NULL,
        observed_at timestamptz NOT NULL,
        source_id uuid REFERENCES sources(id) ON DELETE SET NULL,
        notes text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        version integer NOT NULL DEFAULT 1,
        archived_at timestamptz
      )
    `);
    await queryRunner.query(
      'CREATE INDEX vital_records_type_date_idx ON vital_records(vital_type, observed_at DESC)'
    );
    await queryRunner.query(`
      CREATE TABLE ecg_records (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        healthkit_uuid uuid,
        recorded_at timestamptz NOT NULL,
        source_format varchar(40) NOT NULL,
        classification_original varchar(80),
        average_heart_rate numeric,
        symptoms_status varchar(80),
        sampling_frequency numeric,
        sample_count integer,
        apple_algorithm_version varchar(80),
        document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
        source_id uuid REFERENCES sources(id) ON DELETE SET NULL,
        user_notes text,
        clinician_interpretation text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        version integer NOT NULL DEFAULT 1,
        archived_at timestamptz
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX ecg_records_healthkit_uuid_idx ON ecg_records(healthkit_uuid) WHERE healthkit_uuid IS NOT NULL'
    );
    await queryRunner.query(
      'CREATE INDEX ecg_records_recorded_at_idx ON ecg_records(recorded_at DESC)'
    );
    await queryRunner.query(`
      CREATE TABLE ai_analyses (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        analysis_type varchar(64) NOT NULL,
        question text NOT NULL,
        status varchar(40) NOT NULL DEFAULT 'QUEUED',
        model_id varchar(200) NOT NULL,
        prompt_version varchar(80) NOT NULL,
        answer text,
        citations jsonb NOT NULL DEFAULT '[]'::jsonb,
        error_message text,
        completed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        version integer NOT NULL DEFAULT 1,
        archived_at timestamptz
      )
    `);
    await queryRunner.query(`
      CREATE TABLE audit_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
        action varchar(120) NOT NULL,
        resource_type varchar(120) NOT NULL,
        resource_id uuid,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        version integer NOT NULL DEFAULT 1,
        archived_at timestamptz
      )
    `);
    await queryRunner.query(
      'CREATE INDEX audit_events_created_at_idx ON audit_events(created_at DESC)'
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tables = [
      'audit_events',
      'ai_analyses',
      'ecg_records',
      'vital_records',
      'observations',
      'extracted_facts',
      'extraction_runs',
      'documents',
      'medication_events',
      'medication_plans',
      'medications',
      'order_options',
      'medical_orders',
      'timeline_events',
      'sources',
      'patient_profiles',
      'sessions',
      'users'
    ];
    for (const table of tables) {
      await queryRunner.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
    }
  }
}
