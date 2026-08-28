import type { DocumentAdvice, DocumentExtraction } from '@valve/contracts';

const anticoagulationTerms =
  /(抗凝|华法林|利伐沙班|达比加群|阿哌沙班|艾多沙班|凝血|血栓|\bINR\b|\bPT\b|\bAPTT\b|D[-－]?二聚体)/i;
const unsupportedConclusionTerms =
  /(排除|确诊|证明|保证|肯定不会|无需(?:就医|复查|随访)|可以(?:停药|换药|减量|加量))/;

export function sanitizeDocumentAdvice(
  extraction: DocumentExtraction,
  advice: DocumentAdvice
): DocumentAdvice {
  const evidenceText = extraction.facts
    .flatMap((fact) => [fact.fieldKey, fact.label, fact.valueText, fact.originalText ?? ''])
    .join(' ');
  const hasAnticoagulationEvidence = anticoagulationTerms.test(evidenceText);
  const isRelevant = (text: string) =>
    hasAnticoagulationEvidence || !anticoagulationTerms.test(text);
  const isBoundedFinding = (text: string) =>
    isRelevant(text) && !unsupportedConclusionTerms.test(text);

  const overview = isBoundedFinding(advice.overview)
    ? advice.overview
    : `${extraction.title}已完成结构化识别。单项结果不能独立排除或确诊疾病，请结合症状、既往趋势及经治医生判断。`;
  const questionsForDoctor = advice.questionsForDoctor.filter(isRelevant);

  return {
    ...advice,
    overview,
    keyFindings: advice.keyFindings.filter((finding) =>
      isBoundedFinding(`${finding.label} ${finding.explanation}`)
    ),
    followUpActions: advice.followUpActions.filter(isRelevant),
    questionsForDoctor:
      questionsForDoctor.length > 0
        ? questionsForDoctor
        : ['这份报告最需要结合哪些症状、既往趋势或其他检查一起解读？'],
    limitations: [
      ...new Set([
        ...advice.limitations,
        '识别结果尚未人工核对；单项报告不能独立决定诊断、用药或随访方案。'
      ])
    ]
  };
}
