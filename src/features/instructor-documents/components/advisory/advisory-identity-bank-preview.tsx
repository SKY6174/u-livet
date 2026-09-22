/* eslint-disable @next/next/no-img-element -- Private upload previews must remain canvas-readable. */
import type { AdvisoryStoredDocumentStatus } from "../../types/advisory-intake";
import { formatBankAccountNumber } from "../../utils/bank-account";

interface AdvisoryIdentityBankPreviewProps {
  memberName: string;
  residentNumber: string;
  address: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  idVerification: AdvisoryStoredDocumentStatus;
  bankVerification: AdvisoryStoredDocumentStatus;
  idImage?: string;
  bankImage?: string;
}

const normalizedPersonName = (value: string) => value.normalize("NFKC").toLocaleLowerCase("ko-KR").replace(new RegExp("[^\\p{L}\\p{N}]", "gu"), "");

export function AdvisoryIdentityBankPreview({ memberName, residentNumber, address, bankName, accountNumber, accountHolder, idVerification, bankVerification, idImage, bankImage }: AdvisoryIdentityBankPreviewProps) {
  const mismatches = [
    idVerification.name_matches_member === false ? "신분증 성명" : "",
    bankVerification.name_matches_member === false ? "통장사본 예금주" : "",
    accountHolder.trim() && normalizedPersonName(accountHolder) !== normalizedPersonName(memberName) ? "이력서 예금주" : ""
  ].filter(Boolean);
  return (
    <article className="advisory-paper advisory-identity-preview" aria-label="신분증 및 통장 사본 출력 미리보기">
      <h2 className="advisory-identity-heading">[첨부] 신분증 사본 및 통장 사본</h2>
      {mismatches.length > 0 && <div className="advisory-name-mismatch-alert is-preview" role="alert"><strong>⚠ 성명 불일치</strong><span>전문가 성명과 {mismatches.join("·")}가 일치하지 않습니다.</span></div>}
      <table className="advisory-identity-account">
        <colgroup><col className="label" /><col className="value" /><col className="label" /><col className="value" /></colgroup>
        <tbody>
          <tr><th>성명</th><td>{memberName || "-"}</td><th>주민등록번호</th><td>{residentNumber || "-"}</td></tr>
          <tr><th>주소</th><td colSpan={3} className="address">{address || "-"}</td></tr>
          <tr><th>은행명</th><td>{bankName || "-"}</td><th>계좌번호</th><td className="account-number">{formatBankAccountNumber(bankName, accountNumber) || "-"}</td></tr>
        </tbody>
      </table>
      <h3 className="advisory-identity-label">신분증 사본</h3>
      <div className="advisory-id-preview-zone">{idImage ? <img src={idImage} alt="신분증 사본" /> : <span>신분증 파일을 선택해 주세요.</span>}</div>
      <h3 className="advisory-identity-label">통장 사본</h3>
      <div className="advisory-bank-preview-zone">{bankImage ? <img src={bankImage} alt="통장 사본" /> : <span>통장정보 페이지 파일을 선택해 주세요.</span>}</div>
    </article>
  );
}
