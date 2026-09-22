/* eslint-disable @next/next/no-img-element -- Private upload previews must remain canvas-readable. */
import React from "react";

interface AdvisoryConsentPreviewProps {
  memberName: string;
  submittedDate: string;
  personalInfoConsent: boolean;
  uniqueIdConsent: boolean;
  signatureUrl?: string;
}

export function AdvisoryConsentPreview({
  memberName,
  submittedDate,
  personalInfoConsent,
  uniqueIdConsent,
  signatureUrl
}: AdvisoryConsentPreviewProps) {
  const dateParts = submittedDate.replace(/\./g, " ").trim().split(/\s+/);
  return (
    <article className="advisory-paper advisory-consent-preview" aria-label="개인정보 수집 및 이용 동의서 출력 미리보기">
      <h2>개인정보 수집 및 이용 동의서</h2>
      <p>울산과학대학교에서는 강연(자문)료 지급을 위하여 다음과 같이 개인정보를 수집하고자 합니다. 개인정보는 「개인정보보호법」 제15조 내지 제22조에 의거하여 정보주체의 동의를 얻어 수집하고 있습니다. 아래 내용을 상세히 읽어보신 후 동의 여부를 결정하여 주시기 바랍니다.</p>
      <h3>1. 수집하는 개인정보의 항목</h3>
      <p>울산과학대학교는 업무를 수행하기 위해 아래와 같은 목적으로 개인정보를 수집하고 있습니다.</p>
      <p className="advisory-consent-law">◉ 관련법규: 개인정보보호법 제15조, 제22조/국세기본법 제85조의3</p>
      <table><thead><tr><th>수집하려는 개인정보의 항목</th><th>개인정보 수집, 이용의 목적</th><th>개인정보 보유기간</th></tr></thead><tbody>
        <tr><td>이름, 연락처, 근무처, 직위</td><td>본인 식별 절차에 이용</td><td rowSpan={3}>세무 신고 및 과세에<br />활용/5년 보관</td></tr>
        <tr><td>주소, 주민등록번호</td><td>원천징수 영수증 발송</td></tr>
        <tr><td>계좌번호</td><td>대금지급</td></tr>
        <tr><td>전공분야, 학력, 학위, 경력사항</td><td>교육 참여자에게 강의자 이력 소개</td><td>증빙자료로 활용/3년 보관</td></tr>
      </tbody></table>
      <h3>2. 개인정보의 수집 및 이용목적</h3>
      <ul><li>정보 주체가 작성하는 상기 개인정보는 교육 참여자에게 강사의 이력을 소개하고, 행정업무(수당 지급 및 원천징수)의 원활한 진행을 위해 수집됩니다.</li><li>수집되는 개인정보는 우리 협의회의 행정업무에 사용하는 작업 외에는 사용되지 않습니다.</li><li>정보주체가 작성하는 상기 개인정보는 제3의 기관 및 단체들에 제공되지 않습니다.</li><li>정보제공주체는 개인정보 수집 및 이용에 동의하지 않을 권리가 있으며, 동의하지 않을 경우 행정업무 처리와 관련하여 불이익을 받을 수 있습니다.</li><li>개인정보 제공 동의를 거부할 권리가 있으나, 거부할 경우 관련 사례비 지급 및 세무신고가 불가능함을 알려드립니다.</li></ul>
      <h3>3. 개인정보 보유 및 이용기간</h3><p>개인정보의 수집 및 이용목적이 달성되면 지체없이 파기합니다. 단, 다음의 정보에 대해서는 아래의 이유로 명시기간동안 보존합니다.</p><p>◉ 보존항목: 강사카드　◉ 보존근거/기간: 서류 보존 방침(내부규정)</p>
      <h3>4. 개인정보의 파기절차 및 방법</h3><p>개인정보를 법률에 의한 경우가 아니고서는 보유되는 이외의 다른 목적으로 이용되지 않습니다.</p><ul><li>파기절차: 지원자의 입력 정보는 내부규정 및 기타 관련 법령에 의한 정보보호 사유에 따라(보유 및 이용기간 참조) 명시된 보존기간동안 보관 후 파기됩니다.</li><li>파기방법: 전자적 파일 형태로 저장된 개인정보는 기록을 재생할 수 없는 기술적 방법으로 사용하여 삭제합니다. 서류의 경우 파쇄 처리합니다.</li></ul>
      <h3>5. 개인정보 처리 위탁에 관한 안내</h3><p>울산과학대학교는 원칙적으로 이용자의 동의 없이 해당 개인정보의 처리를 타인에게 위탁하지 않습니다.</p>
      <div className="advisory-consent-decisions">
        <strong>상기 내용을 숙지하시고 개인정보 제공에 동의하십니까?</strong><span>{personalInfoConsent ? "☑ 예　□ 아니오" : "□ 예　□ 아니오　(미선택)"}</span>
        <strong>주민등록번호 등 고유식별 정보 제공에 동의하십니까?</strong><span>{uniqueIdConsent ? "☑ 예　□ 아니오" : "□ 예　□ 아니오　(미선택)"}</span>
      </div>
      <div className="advisory-consent-signature-line"><span>{dateParts[0] || ""}년　{dateParts[1] || ""}월　{dateParts[2] || ""}일</span><span className="consent-name">성명 : <strong>{memberName}</strong></span><span className="signature-slot"><span>(서명)</span>{signatureUrl && <img src={signatureUrl} alt="성명 서명" />}</span></div>
      <p className="advisory-consent-recipient">울산과학대학교 앵커사업단장 귀하</p>
    </article>
  );
}
