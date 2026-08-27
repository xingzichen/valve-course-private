import { describe, expect, it } from 'vitest';

import {
  assessUrgency,
  canCreateMedicationPlan,
  evaluateAnticoagulationOptions,
  getExecutionPermission
} from './index.js';

describe('deterministic urgency gate', () => {
  it('stops before model analysis when a red-flag symptom is explicitly reported', () => {
    const result = assessUrgency({
      chestPain: true,
      syncope: false,
      severeDyspnea: false,
      strokeSigns: false,
      majorBleeding: false,
      persistentFastHeartRate: false
    });
    expect(result.urgent).toBe(true);
    expect(result.matched).toContain('胸痛或胸部压迫感');
    expect(result.instruction).toContain('120');
  });

  it('does not invent urgency when every explicit flag is false', () => {
    expect(
      assessUrgency({
        chestPain: false,
        syncope: false,
        severeDyspnea: false,
        strokeSigns: false,
        majorBleeding: false,
        persistentFastHeartRate: false
      }).urgent
    ).toBe(false);
  });
});

describe('source execution boundary', () => {
  it('only permits a confirmed treating-doctor order to create a medication plan', () => {
    expect(canCreateMedicationPlan('TREATING_DOCTOR_ORDER', true)).toBe(true);
    expect(canCreateMedicationPlan('TREATING_DOCTOR_ORDER', false)).toBe(false);
    expect(canCreateMedicationPlan('ONLINE_EDUCATION', true)).toBe(false);
    expect(canCreateMedicationPlan('AI_ANALYSIS', true)).toBe(false);
    expect(getExecutionPermission('DEVICE_DATA')).toBe('NONE');
  });
});

describe('anticoagulation eligibility', () => {
  it('blocks convenience scoring for rivaroxaban in confirmed rheumatic MS with AF', () => {
    const results = evaluateAnticoagulationOptions({
      treatingDoctorOfferedOptions: true,
      rheumaticMitralStenosis: true,
      moderateOrSevereMitralStenosis: true,
      atrialFibrillation: true,
      mechanicalValve: false
    });

    expect(results.find((item) => item.option === 'RIVAROXABAN')?.status).toBe('INELIGIBLE');
  });

  it('returns unknown instead of guessing when key facts are missing', () => {
    const results = evaluateAnticoagulationOptions({
      treatingDoctorOfferedOptions: true,
      rheumaticMitralStenosis: null,
      moderateOrSevereMitralStenosis: null,
      atrialFibrillation: null,
      mechanicalValve: null
    });

    const rivaroxaban = results.find((item) => item.option === 'RIVAROXABAN');
    expect(rivaroxaban?.status).toBe('UNKNOWN');
    expect(rivaroxaban?.missingData.length).toBeGreaterThan(0);
  });
});
