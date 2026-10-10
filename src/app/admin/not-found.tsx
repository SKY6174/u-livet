import Link from "next/link";
import { Empty } from "@/components/portal/ui";

export default function AdminNotFound() {
  return (
    <div className="page-shell">
      <Empty title="관리 업무에 접근할 수 없습니다">
        <p className="leading-7">이 화면의 업무 권한이 없거나 요청한 항목을 찾을 수 없습니다. 계정 관리 담당자에게 담당 업무 권한을 확인해 주세요.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link href="/admin" className="btn-secondary">사업단 업무 홈</Link>
          <Link href="/" className="btn-secondary">홈페이지</Link>
        </div>
      </Empty>
    </div>
  );
}
