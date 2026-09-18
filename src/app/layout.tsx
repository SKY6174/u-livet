// ==============================================================================
// 울산과학대학교 앵커사업단 평생직업교육 플랫폼 - 루트 레이아웃
// ==============================================================================
// 파일 경로: src/app/layout.tsx
// 설명:
//   Next.js 14 App Router의 최상위 루트 레이아웃입니다.
//   모든 페이지에서 공통으로 표시되는 헤더(Header), 푸터(Footer), 전역 스타일을 주입합니다.
// ==============================================================================

import type { Metadata } from 'next';
import './globals.css';
import Header from '@/components/common/Header';
import Footer from '@/components/common/Footer';

export const metadata: Metadata = {
  title: '울산과학대학교 앵커사업단 RCC센터 | LMS 및 수강신청 포털',
  description: '울산 지역 재직자, 성인학습자 및 구직자를 위한 직무역량 강화 평생직업교육 플랫폼입니다. 강좌 수강신청, 출결 관리, 위변조 방지 전자수료증 발급 지원.',
  keywords: ['울산과학대학교', '앵커사업단 RCC센터', '앵커사업단', 'LMS', '수강신청', '수료증', '재직자교육', '울산직업훈련'],
  authors: [{ name: '울산과학대학교 앵커사업단 RCC센터' }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="flex flex-col min-h-screen bg-slate-50 text-slate-900 selection:bg-uc-orange selection:text-white">
        {/* 상단 공통 네비게이션 헤더 */}
        <Header />

        {/* 메인 컨텐츠 영역 (페이지별 가변 본문) */}
        <main className="flex-grow">
          {children}
        </main>

        {/* 하단 공통 푸터 */}
        <Footer />
      </body>
    </html>
  );
}
