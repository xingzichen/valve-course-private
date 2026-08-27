import type { SourceType } from '@valve/contracts';

export type ExecutionPermission = 'DIRECT_AFTER_CONFIRMATION' | 'DISCUSSION_ONLY' | 'NONE';

const executionPermissions: Record<SourceType, ExecutionPermission> = {
  TREATING_DOCTOR_ORDER: 'DIRECT_AFTER_CONFIRMATION',
  PERSONALIZED_SECOND_OPINION: 'DISCUSSION_ONLY',
  DOCTOR_EXPLANATION: 'DISCUSSION_ONLY',
  MEDICAL_GUIDELINE: 'DISCUSSION_ONLY',
  DRUG_LABEL: 'DISCUSSION_ONLY',
  ONLINE_EDUCATION: 'NONE',
  PATIENT_EXPERIENCE: 'NONE',
  USER_INFERENCE: 'NONE',
  AI_ANALYSIS: 'NONE',
  DEVICE_DATA: 'NONE',
  UNKNOWN: 'NONE'
};

export function getExecutionPermission(sourceType: SourceType): ExecutionPermission {
  return executionPermissions[sourceType] ?? 'NONE';
}

export function canCreateMedicationPlan(sourceType: SourceType, sourceConfirmed: boolean): boolean {
  return sourceConfirmed && getExecutionPermission(sourceType) === 'DIRECT_AFTER_CONFIRMATION';
}

export interface UrgentSymptoms {
  chestPain: boolean;
  syncope: boolean;
  severeDyspnea: boolean;
  strokeSigns: boolean;
  majorBleeding: boolean;
  persistentFastHeartRate: boolean;
}

export interface UrgencyAssessment {
  urgent: boolean;
  matched: string[];
  instruction: string | null;
}

/** Deterministic safety gate that runs before any model call. */
export function assessUrgency(symptoms: UrgentSymptoms): UrgencyAssessment {
  const labels: Array<[keyof UrgentSymptoms, string]> = [
    ['chestPain', '胸痛或胸部压迫感'],
    ['syncope', '晕厥或意识丧失'],
    ['severeDyspnea', '严重或突发呼吸困难'],
    ['strokeSigns', '疑似卒中表现'],
    ['majorBleeding', '大量或无法止住的出血'],
    ['persistentFastHeartRate', '持续快速心率并明显不适']
  ];
  const matched = labels.filter(([key]) => symptoms[key]).map(([, label]) => label);
  return {
    urgent: matched.length > 0,
    matched,
    instruction:
      matched.length > 0
        ? '请不要等待 AI 回答，立即联系 120 或尽快前往急诊；不要自行停药、换药或改变剂量。'
        : null
  };
}

export interface AnticoagulationContext {
  treatingDoctorOfferedOptions: boolean;
  rheumaticMitralStenosis: boolean | null;
  moderateOrSevereMitralStenosis: boolean | null;
  atrialFibrillation: boolean | null;
  mechanicalValve: boolean | null;
}

export interface EligibilityResult {
  option: 'WARFARIN' | 'RIVAROXABAN';
  status: 'ELIGIBLE' | 'INELIGIBLE' | 'UNKNOWN';
  reasons: string[];
  missingData: string[];
}

export function evaluateAnticoagulationOptions(
  context: AnticoagulationContext
): EligibilityResult[] {
  const warfarin: EligibilityResult = {
    option: 'WARFARIN',
    status: context.treatingDoctorOfferedOptions ? 'ELIGIBLE' : 'UNKNOWN',
    reasons: context.treatingDoctorOfferedOptions
      ? ['经治医生已将该方案列为患者本人的备选方案']
      : [],
    missingData: context.treatingDoctorOfferedOptions ? [] : ['缺少经治医生针对患者本人的方案原文']
  };

  const rivaroxaban: EligibilityResult = {
    option: 'RIVAROXABAN',
    status: 'UNKNOWN',
    reasons: [],
    missingData: []
  };

  if (!context.treatingDoctorOfferedOptions) {
    rivaroxaban.missingData.push('缺少经治医生针对患者本人的方案原文');
  }
  if (context.rheumaticMitralStenosis === null) {
    rivaroxaban.missingData.push('二尖瓣狭窄病因未确认');
  }
  if (context.moderateOrSevereMitralStenosis === null) {
    rivaroxaban.missingData.push('二尖瓣狭窄严重程度未确认');
  }
  if (context.atrialFibrillation === null) {
    rivaroxaban.missingData.push('是否存在房颤未确认');
  }
  if (context.mechanicalValve === null) {
    rivaroxaban.missingData.push('是否存在机械瓣未确认');
  }

  if (context.mechanicalValve === true) {
    rivaroxaban.status = 'INELIGIBLE';
    rivaroxaban.reasons.push('已确认存在机械瓣，必须升级为高优先级医学适用性冲突');
  } else if (
    context.rheumaticMitralStenosis === true &&
    context.moderateOrSevereMitralStenosis === true &&
    context.atrialFibrillation === true
  ) {
    rivaroxaban.status = 'INELIGIBLE';
    rivaroxaban.reasons.push(
      '已确认风湿性中重度二尖瓣狭窄合并房颤，不能仅因便利性将利伐沙班与维生素 K 拮抗剂视为等效'
    );
  } else if (rivaroxaban.missingData.length === 0 && context.treatingDoctorOfferedOptions) {
    rivaroxaban.status = 'ELIGIBLE';
    rivaroxaban.reasons.push('当前结构化硬门槛未发现已知冲突，仍需医生最终确认');
  }

  return [warfarin, rivaroxaban];
}
