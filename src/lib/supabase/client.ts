// ==============================================================================
// 울산과학대학교 앵커사업단 평생직업교육 플랫폼 - 브라우저용 Supabase 클라이언트
// ==============================================================================
// 파일 경로: src/lib/supabase/client.ts
// 설명:
//   클라이언트 컴포넌트('use client')에서 수강신청, 출결 체크, 로그인 상태 확인 등
//   브라우저 환경에서 Supabase 데이터베이스 및 인증 기능을 사용할 때 호출합니다.
// ==============================================================================

import { createBrowserClient } from '@supabase/ssr';

/**
 * 브라우저 환경에서 싱글톤으로 동작하는 Supabase 클라이언트를 반환합니다.
 * 환경변수 NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY를 사용합니다.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
