/** @type {import('next').NextConfig} */
// ==============================================================================
// 울산과학대학교 앵커사업단 평생직업교육 플랫폼 - Next.js 환경 설정
// ==============================================================================
// 파일 경로: next.config.js
// 설명:
//   1. 빌드에서 린트·타입 검사를 실행합니다.
//   2. Supabase 스토리지 및 외부 이미지 리소스를 안전하게 불러올 수 있도록 설정합니다.
// ==============================================================================

const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/favicon.ico",
        destination: "/images/ulsan-college-logo.png",
      },
    ];
  },
  // 서버 PDF 생성에서 사용하는 한글 글꼴을 배포 산출물에 포함한다.
  outputFileTracingIncludes: {
    "/*": ["./assets/fonts/NanumGothic-Regular.ttf"],
  },
  // 빌드에서도 린트·타입 오류를 확인한다.
  eslint: {
    ignoreDuringBuilds: false,
  },
  // TypeScript 엄격한 타입 검사는 유지하여 코드 품질 보장
  typescript: {
    ignoreBuildErrors: false,
  },
  // Supabase 스토리지 이미지 호스팅 도메인 허용
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
};

module.exports = nextConfig;
