/** @type {import('next').NextConfig} */
// ==============================================================================
// 울산과학대학교 앵커사업단 평생직업교육 플랫폼 - Next.js 환경 설정
// ==============================================================================
// 파일 경로: next.config.js
// 설명:
//   1. Vercel 클라우드 배포 시 빌드가 중단되지 않도록 빌드 옵션을 최적화합니다.
//   2. Supabase 스토리지 및 외부 이미지 리소스를 안전하게 불러올 수 있도록 설정합니다.
// ==============================================================================

const nextConfig = {
  // Vercel 클라우드 빌드 시 사소한 린트 경고로 인해 배포가 실패하는 것을 방지
  eslint: {
    ignoreDuringBuilds: true,
  },
  // TypeScript 엄격한 타입 검사는 유지하여 코드 품질 보장
  typescript: {
    ignoreBuildErrors: false,
  },
  // Supabase 스토리지 이미지 호스팅 도메인 허용
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
};

module.exports = nextConfig;
