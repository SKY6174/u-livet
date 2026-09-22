import type { AdvisoryResume } from "../../types/advisory-intake";
import { compactAdvisoryResumeRows } from "../../features/committee/utils/advisory-resume-content";
import { normalizeAdvisoryResumeLineBreaks } from "../../features/committee/utils/advisory-resume-line-breaks";
import { formatBankAccountNumber } from "../../utils/bank-account";

function ResumeText({ value, className = "" }: { value: string; className?: string }) {
  return (
    <span className={`advisory-resume-forced-break ${className}`.trim()}>
      {normalizeAdvisoryResumeLineBreaks(value)}
    </span>
  );
}

export function AdvisoryResumePreview({ resume }: { resume: AdvisoryResume }) {
  const educationRows = compactAdvisoryResumeRows(resume.education);
  const careerRows = compactAdvisoryResumeRows(resume.careers);
  const policyResearchRows = compactAdvisoryResumeRows(resume.policy_research);
  const licenseRows = compactAdvisoryResumeRows(resume.licenses);

  return (
    <article className="advisory-paper advisory-resume-preview" aria-label="이력서 출력 미리보기">
      <h2 className="advisory-document-title">이력서</h2>
      <table className="advisory-resume-personal advisory-resume-section-table"><colgroup><col className="label" /><col className="value" /><col className="label" /><col className="account" /><col className="label" /><col className="value" /></colgroup><tbody>
        <tr><th>성명</th><td colSpan={5} className="advisory-resume-equal-cell"><div className="advisory-resume-name-grid"><strong>한글</strong><ResumeText value={resume.korean_name} /><strong>한자</strong><ResumeText value={resume.hanja_name} /><strong>영문</strong><ResumeText value={resume.english_name} className="advisory-resume-english-name" /></div></td></tr>
        <tr><th>E-Mail</th><td colSpan={5}><ResumeText value={resume.email} /></td></tr>
        <tr><th>주민등록번호</th><td colSpan={5}><ResumeText value={resume.resident_number} /></td></tr>
        <tr><th>주소</th><td colSpan={5}><ResumeText value={resume.address} /></td></tr>
        <tr className="advisory-resume-bank-row"><th>은행</th><td><ResumeText value={resume.bank_name} /></td><th>계좌번호</th><td><ResumeText value={formatBankAccountNumber(resume.bank_name, resume.account_number)} /></td><th>예금주</th><td><ResumeText value={resume.account_holder} /></td></tr>
        <tr><th>전화번호</th><td colSpan={5} className="advisory-resume-equal-cell"><div className="advisory-resume-phone-grid"><strong>직장</strong><ResumeText value={resume.phones.work} /><strong>휴대폰</strong><ResumeText value={resume.phones.mobile} /></div></td></tr>
      </tbody></table>
      {educationRows.length > 0 && <section className="advisory-resume-section"><h3>학력사항</h3><table><thead><tr><th>기간</th><th>학교명</th><th>학과명</th><th>학위구분</th></tr></thead><tbody>{educationRows.map((row, index) => <tr key={index}><td><ResumeText value={row.period} /></td><td><ResumeText value={row.school} /></td><td className="advisory-resume-keep-words"><ResumeText value={row.department_major} /></td><td><ResumeText value={row.degree_type} /></td></tr>)}</tbody></table></section>}
      {careerRows.length > 0 && <section className="advisory-resume-section"><h3>교육 및 산업체 경력사항</h3><table><thead><tr><th>재직기간</th><th>근무기관명</th><th>직위</th><th>담당직무</th></tr></thead><tbody>{careerRows.map((row, index) => <tr key={index}><td><ResumeText value={row.employment_period} /></td><td className="advisory-resume-keep-words"><ResumeText value={row.organization} /></td><td><ResumeText value={row.position} /></td><td><ResumeText value={row.duties} /></td></tr>)}</tbody></table></section>}
      {resume.include_policy_research && policyResearchRows.length > 0 && <section className="advisory-resume-section"><h3>(정책)연구경력</h3><table className="advisory-policy-research-table"><colgroup><col className="year" /><col className="title" /><col className="role" /><col className="client" /><col className="notes" /></colgroup><thead><tr><th>연도</th><th>연구명</th><th>역할</th><th>발주처</th><th>비고</th></tr></thead><tbody>{policyResearchRows.map((row, index) => <tr key={index}><td><ResumeText value={row.year} /></td><td className="advisory-resume-keep-words"><ResumeText value={row.title} /></td><td><ResumeText value={row.role} /></td><td><ResumeText value={row.client} /></td><td><ResumeText value={row.notes} /></td></tr>)}</tbody></table></section>}
      {resume.include_licenses && licenseRows.length > 0 && <section className="advisory-resume-section"><h3>자격증·면허증</h3><table><thead><tr><th>취득 연월일</th><th>종류</th><th>시행기관</th></tr></thead><tbody>{licenseRows.map((row, index) => <tr key={index}><td><ResumeText value={row.acquired_date} /></td><td><ResumeText value={row.type} /></td><td><ResumeText value={row.issuer} /></td></tr>)}</tbody></table></section>}
    </article>
  );
}
