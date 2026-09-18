import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/common/Header";
import Footer from "@/components/common/Footer";
import { RoleProvider } from "@/lib/auth/roleContext";
import { getSessionIdentity } from "@/lib/auth/session";
import { isReviewOnly, REVIEW_MESSAGE } from "@/lib/deployment/review-mode";
export const metadata: Metadata = {
  title: "U-LIFE | 앵커사업 평생직업교육",
  description:
    "교육과정 신청부터 학습과 경력까지, 울산과학대학교 앵커사업 평생직업교육.",
};
export const dynamic = "force-dynamic";
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const identity = await getSessionIdentity();
  const reviewOnly = isReviewOnly();
  return (
    <html lang="ko">
      <body className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
        <RoleProvider identity={identity}>
          {reviewOnly && <aside className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-center text-base text-amber-950" role="status">{REVIEW_MESSAGE}</aside>}
          <Header />
          <main id="main" className="flex-grow">
            {children}
          </main>
          <Footer />
        </RoleProvider>
      </body>
    </html>
  );
}
