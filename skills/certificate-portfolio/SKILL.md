---
name: certificate-portfolio
description: 평생직업교육 수료 기준 자동 판정, 위·변조 방지 QR 수료증 발급, PDF 다운로드 및 개인별 평생학습 이력 포트폴리오 관리 가이드 스킬입니다.
---

# 수료증 발급 및 평생학습 이력 관리 가이드 (CERTIFICATE-PORTFOLIO)

## 1. 개요 및 목적
평생직업교육의 신뢰도를 보장하기 위해 정확한 수료 사정, 위·변조 방지 QR 코드가 포함된 전자 수료증 발급, 그리고 학습자가 취업 및 이직 시 제출할 수 있는 체계적인 이력 관리(포트폴리오) 시스템을 구현하는 표준 스킬입니다.

---

## 2. 수료 기준 자동 판정 엔진 (Completion Evaluation)

### 2.1. 판정 공식 및 조건
```typescript
interface CompletionCriteria {
  minAttendanceRate: number; // 기본 80% (0.8)
  minTotalScore: number;      // 기본 60점
  requireSurvey: boolean;     // 만족도 설문 필수 여부 (true)
}

function evaluateCompletion(
  attendanceRate: number,
  score: number,
  surveyCompleted: boolean,
  criteria: CompletionCriteria
): boolean {
  if (attendanceRate < criteria.minAttendanceRate) return false;
  if (score < criteria.minTotalScore) return false;
  if (criteria.requireSurvey && !surveyCompleted) return false;
  return true;
}
```

---

## 3. 위·변조 방지 QR 수료증 발급 아키텍처

```
[수료 확정 이벤트]
        │
        ▼
[고유 발급 번호 생성] (예: UC-ANCHOR-2026-00042)
        │
        ▼
[위·변조 방지 SHA-256 검증 해시 생성]
(수료자ID + 강좌ID + 발급일자 + Salt 키)
        │
        ▼
[검증 QR 코드 생성]
(URL: https://uc-life.ulsan.ac.kr/verify?code=UC-ANCHOR-2026-00042&hash=... )
        │
        ▼
[PDF 수료증 동적 렌더링 & Supabase Storage 보관]
(울산과학대학교 로고, 총장/사업단장 직인 이미지, 발급번호, QR코드 포함)
```

### 3.1. 외부 공개 검증 페이지 (Public Verification Page)
- 제3자(기업 인사담당자 등)가 수료증에 인쇄된 QR 코드를 스마트폰 카메라로 스캔하면 즉시 접속되는 페이지.
- **표시 정보**: 수료생 성명(성*민 마스킹 옵션), 교육과정명, 교육기간, 이수시간, 발급기관(울산과학대학교 앵커사업단).
- 위·변조 여부("본 수료증은 울산과학대학교 앵커사업단 데이터베이스에 정식 등록된 원본입니다") 녹색 인증 마크 표시.

---

## 4. 학습자 개인 이력 포트폴리오 (Career Portfolio)
1. **타임라인 뷰**:
   - 연도별/월별로 수강한 모든 평생직업교육 과정의 진행 상태(수강중, 수료, 미수료) 시각화.
2. **역량 뱃지 및 누적 교육 시간**:
   - 총 누적 이수 시간(예: `총 120시간 이수`)
   - 직무 분야별 뱃지(예: `스마트야드 전문가`, `이차전지 실무인재`) 자동 수여.
3. **통합 교육이수 증명서 일괄 출력**:
   - 개별 수료증 외에도, 여러 과정을 한 장의 공문서 형태로 묶어 출력하는 기능 제공.
