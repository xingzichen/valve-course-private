#!/usr/bin/env bash

set -euo pipefail

base_url="${BASE_URL:-http://localhost:8080/api/v1}"
cookie_jar="$(mktemp -t valve-smoke-cookie.XXXXXX)"
response_file="$(mktemp -t valve-smoke-response.XXXXXX)"
trap 'rm -f "$cookie_jar" "$response_file"' EXIT

require() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "缺少命令：$1" >&2
    exit 1
  }
}

require curl
require jq
require openssl

setup_required="$(curl -fsS "$base_url/auth/setup" | jq -r '.setupRequired')"
if [[ "$setup_required" == "true" ]]; then
  smoke_password="${SMOKE_PASSWORD:-$(openssl rand -base64 24)}"
  curl -fsS \
    -H 'Content-Type: application/json' \
    -X POST \
    --data "$(jq -nc --arg password "$smoke_password" '{password:$password}')" \
    "$base_url/auth/setup" >/dev/null
else
  : "${SMOKE_PASSWORD:?实例已经初始化，请通过 SMOKE_PASSWORD 提供测试登录密码}"
  smoke_password="$SMOKE_PASSWORD"
fi

curl -fsS \
  -c "$cookie_jar" \
  -H 'Content-Type: application/json' \
  -X POST \
  --data "$(jq -nc --arg password "$smoke_password" '{password:$password}')" \
  "$base_url/auth/login" >/dev/null

csrf_token="$(curl -fsS -b "$cookie_jar" "$base_url/auth/session" | jq -r '.csrfToken')"

mutate() {
  local method="$1"
  local path="$2"
  local body="$3"
  curl -fsS \
    -b "$cookie_jar" \
    -H 'Content-Type: application/json' \
    -H "x-csrf-token: $csrf_token" \
    -X "$method" \
    --data "$body" \
    "$base_url$path"
}

online_source="$(mutate POST /sources '{"sourceType":"ONLINE_EDUCATION","title":"网络视频中的抗凝科普","platform":"测试平台","isPatientSpecific":false,"originalQuote":"示例科普内容，不能视为患者本人医嘱。"}')"
online_source_id="$(jq -r '.id' <<<"$online_source")"

invalid_order_body="$(jq -nc --arg sourceId "$online_source_id" '{orderedAt:"2026-08-27T08:00:00+08:00",originalText:"网络视频建议选某种抗凝药",sourceId:$sourceId,options:[]}')"
invalid_status="$(curl -sS \
  -o "$response_file" \
  -w '%{http_code}' \
  -b "$cookie_jar" \
  -H 'Content-Type: application/json' \
  -H "x-csrf-token: $csrf_token" \
  -X POST \
  --data "$invalid_order_body" \
  "$base_url/orders")"
[[ "$invalid_status" == "422" ]]
[[ "$(jq -r '.code' "$response_file")" == "ORDER_SOURCE_INVALID" ]]

doctor_source="$(mutate POST /sources '{"sourceType":"TREATING_DOCTOR_ORDER","title":"心内科门诊医嘱","authorName":"测试医生","organization":"测试医院","specialty":"心内科","publishedAt":"2026-08-27T09:00:00+08:00","isPatientSpecific":true}')"
doctor_source_id="$(jq -r '.id' <<<"$doctor_source")"

order_body="$(jq -nc --arg sourceId "$doctor_source_id" '{orderedAt:"2026-08-27T09:00:00+08:00",originalText:"抗凝方案：华法林或利伐沙班，最终方案须经医生确认。",purpose:"房颤相关卒中预防",status:"PENDING_CHOICE",sourceId:$sourceId,options:[{name:"华法林方案",medicationName:"华法林",instructions:"遵医嘱服用",monitoring:"定期 INR"},{name:"利伐沙班方案",medicationName:"利伐沙班",instructions:"遵医嘱服用"}]}')"
order="$(mutate POST /orders "$order_body")"
order_id="$(jq -r '.id' <<<"$order")"
warfarin_option_id="$(jq -r '.options[] | select(.medicationName == "华法林") | .id' <<<"$order")"
[[ "$(jq -r '.doctorName' <<<"$order")" == "测试医生" ]]
[[ "$(jq -r '.hospital' <<<"$order")" == "测试医院" ]]
[[ "$(jq -r '.department' <<<"$order")" == "心内科" ]]

decision_body='{"clinicalFacts":{"rheumaticMitralStenosis":true,"moderateOrSevereMitralStenosis":true,"atrialFibrillation":true,"mechanicalValve":false},"preferences":{"canAttendRegularInrMonitoring":true,"canKeepDietAndMedicationRoutineStable":true,"acceptsDoseAdjustments":true,"stronglyPrefersNoRoutineBloodTests":false,"adherenceConfidence":"HIGH","primaryConcern":"SAFETY"}}'
decision="$(mutate POST "/orders/$order_id/decision-support" "$decision_body")"
[[ "$(jq -r '.suggestedDiscussionOption' <<<"$decision")" == "WARFARIN" ]]
[[ "$(jq -r '.eligibility[] | select(.option == "RIVAROXABAN") | .status' <<<"$decision")" == "INELIGIBLE" ]]

pending_choice="$(jq -nc --arg optionId "$warfarin_option_id" '{selectedOptionId:$optionId,choiceRationale:"医学适用性优先，带回经治医生确认。",doctorConfirmed:false}')"
mutate POST "/orders/$order_id/choice" "$pending_choice" >/dev/null

medication="$(mutate POST /medications "$(jq -nc --arg sourceId "$doctor_source_id" '{genericName:"华法林",dosageForm:"片剂",sourceId:$sourceId}')")"
medication_id="$(jq -r '.id' <<<"$medication")"
plan_body="$(jq -nc --arg medicationId "$medication_id" --arg orderId "$order_id" '{medicationId:$medicationId,medicalOrderId:$orderId,dose:"以经治医生最终确认为准",frequency:"每日一次",startDate:"2026-08-28"}')"
pending_plan_status="$(curl -sS \
  -o "$response_file" \
  -w '%{http_code}' \
  -b "$cookie_jar" \
  -H 'Content-Type: application/json' \
  -H "x-csrf-token: $csrf_token" \
  -X POST \
  --data "$plan_body" \
  "$base_url/medication-plans")"
[[ "$pending_plan_status" == "422" ]]
[[ "$(jq -r '.code' "$response_file")" == "MEDICATION_PLAN_REQUIRES_CONFIRMED_ORDER" ]]

confirmed_choice="$(jq -nc --arg optionId "$warfarin_option_id" '{selectedOptionId:$optionId,choiceRationale:"已与经治医生确认。",doctorConfirmed:true,doctorConfirmationNote:"仅为端到端测试数据"}')"
mutate POST "/orders/$order_id/choice" "$confirmed_choice" >/dev/null
mutate POST /medication-plans "$plan_body" >/dev/null

mutate POST /vitals '{"vitalType":"INR","valueNumeric":2.3,"unit":"INR","observedAt":"2026-08-27T10:00:00+08:00","notes":"端到端测试"}' >/dev/null
mutate POST /ecg '{"recordedAt":"2026-08-27T10:05:00+08:00","sourceFormat":"APPLE_ECG_PDF","classificationOriginal":"窦性心律（设备原始分类）","averageHeartRate":72,"userNotes":"端到端测试"}' >/dev/null

document_tested=false
if [[ -n "${SMOKE_DOCUMENT:-}" ]]; then
  [[ -f "$SMOKE_DOCUMENT" ]]
  upload="$(curl -fsS \
    -b "$cookie_jar" \
    -H "x-csrf-token: $csrf_token" \
    -F "file=@$SMOKE_DOCUMENT" \
    "$base_url/documents/upload?documentType=LAB_REPORT")"
  document_id="$(jq -r '.document.id' <<<"$upload")"
  [[ "$(jq -r '.duplicate' <<<"$upload")" == "false" ]]

  duplicate_upload="$(curl -fsS \
    -b "$cookie_jar" \
    -H "x-csrf-token: $csrf_token" \
    -F "file=@$SMOKE_DOCUMENT" \
    "$base_url/documents/upload?documentType=LAB_REPORT")"
  [[ "$(jq -r '.duplicate' <<<"$duplicate_upload")" == "true" ]]
  [[ "$(jq -r '.document.id' <<<"$duplicate_upload")" == "$document_id" ]]

  mutate POST "/documents/$document_id/analyze" '{}' >/dev/null
  extraction_status=QUEUED
  for _ in $(seq 1 90); do
    extraction="$(curl -fsS -b "$cookie_jar" "$base_url/documents/$document_id/extraction")"
    extraction_status="$(jq -r '.runs[0].status' <<<"$extraction")"
    [[ "$extraction_status" == "COMPLETED" || "$extraction_status" == "FAILED" ]] && break
    sleep 2
  done
  [[ "$extraction_status" == "COMPLETED" ]]
  [[ "$(jq -r '.facts | length' <<<"$extraction")" -gt 0 ]]
  [[ "$(curl -fsS -b "$cookie_jar" "$base_url/documents/$document_id" | jq -r '.status')" == "REVIEW_REQUIRED" ]]
  document_tested=true
fi

urgent="$(mutate POST /ai/analyses '{"analysisType":"GENERAL_QUESTION","question":"现在胸痛，应该怎么办？","urgentSymptoms":{"chestPain":true}}')"
[[ "$(jq -r '.status' <<<"$urgent")" == "COMPLETED" ]]
[[ "$(jq -r '.modelId' <<<"$urgent")" == "DETERMINISTIC_SAFETY_RULES" ]]

analysis="$(mutate POST /ai/analyses '{"analysisType":"VISIT_PREPARATION","question":"请根据现有档案整理下次复诊要向医生确认的问题，并严格区分医嘱与网络科普。"}')"
analysis_id="$(jq -r '.id' <<<"$analysis")"
analysis_status="$(jq -r '.status' <<<"$analysis")"
for _ in $(seq 1 60); do
  analysis="$(curl -fsS -b "$cookie_jar" "$base_url/ai/analyses/$analysis_id")"
  analysis_status="$(jq -r '.status' <<<"$analysis")"
  [[ "$analysis_status" == "COMPLETED" || "$analysis_status" == "FAILED" ]] && break
  sleep 2
done
[[ "$analysis_status" == "COMPLETED" ]]
[[ "$(jq -r '.modelId' <<<"$analysis")" != "DETERMINISTIC_SAFETY_RULES" ]]
[[ "$(jq -r '.answer | length' <<<"$analysis")" -gt 20 ]]

curl -fsS -b "$cookie_jar" "$base_url/dashboard" | jq -e '.profile and .recentVitals and .recentEcgs' >/dev/null

echo 'SMOKE_E2E=PASSED'
echo 'SOURCE_ISOLATION=PASSED'
echo 'ANTICOAGULATION_GATE=PASSED'
echo 'CONFIRMED_ORDER_GATE=PASSED'
echo 'URGENT_RULE_GATE=PASSED'
echo 'LOCAL_MODEL_WORKER=PASSED'
if [[ "$document_tested" == "true" ]]; then
  echo 'MULTIMODAL_DOCUMENT=PASSED'
  echo 'DOCUMENT_DEDUPLICATION=PASSED'
fi
