// ==============================================================================
// 울산과학대학교 앵커사업단 평생직업교육 플랫폼 - 서버용 Supabase 클라이언트
// ==============================================================================
// 파일 경로: src/lib/supabase/server.ts
// 설명:
//   Next.js 14 App Router의 서버 컴포넌트, 서버 액션 및 라우트 핸들러에서
//   사용자의 인증 쿠키를 안전하게 읽고 쓸 수 있도록 지원합니다.
// ==============================================================================

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * 서버 환경에서 쿠키와 연동되는 Supabase 클라이언트를 생성합니다.
 */
export function createServerSupabaseClient() {
  const cookieStore = cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // 서버 컴포넌트에서는 쿠키를 직접 쓸 수 없으므로 미들웨어에서 처리되도록 예외 무시
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: '', ...options });
        } catch {
          // 서버 컴포넌트에서 예외 무시
        }
      },
    },
  });
}
