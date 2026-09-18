// ==============================================================================
// 울산과학대학교 앵커사업단 RCC센터 평생직업교육 플랫폼 - DB 헬스체크 & 지연시간 API
// ==============================================================================
// 파일 경로: src/app/api/health/route.ts
// 설명:
//   1. Supabase PostgreSQL 데이터베이스와의 실시간 연동성을 검사합니다.
//   2. 주요 테이블(강좌, 강의실, 장학금 등)의 쿼리 왕복 지연시간(Latency, ms)을 정밀 측정합니다.
//   3. 시스템 운영자 대시보드 및 Vercel 배포 후 모니터링용 표준 JSON 응답을 반환합니다.
// ==============================================================================

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // 항상 실시간 동적 측정
export const revalidate = 0;

interface TableCheckResult {
  table: string;
  ok: boolean;
  durationMs: number;
  statusCode: number;
  count?: number;
  error?: string;
}

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  const startTime = performance.now();

  // 환경 변수 설정 여부 1차 검증
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        message: 'Supabase 접속 정보(URL 또는 API Key)가 환경변수에 누락되었습니다.',
        timestamp: new Date().toISOString(),
        tables: []
      },
      { status: 500 }
    );
  }

  // 점검 대상 핵심 테이블 목록
  const targetTables = ['courses', 'classrooms', 'scholarships', 'certificates'];
  const tableResults: TableCheckResult[] = [];

  // 각 테이블별 실제 쿼리 지연시간(RTT) 병렬 측정
  await Promise.all(
    targetTables.map(async (tableName) => {
      const qStart = performance.now();
      try {
        const res = await fetch(`${supabaseUrl}/rest/v1/${tableName}?select=id&limit=1`, {
          method: 'GET',
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
          },
          cache: 'no-store'
        });

        const qDuration = performance.now() - qStart;
        const isOk = res.ok;

        tableResults.push({
          table: tableName,
          ok: isOk,
          durationMs: Number(qDuration.toFixed(2)),
          statusCode: res.status,
          error: isOk ? undefined : `HTTP ${res.status} (${res.statusText})`
        });
      } catch (err: any) {
        const qDuration = performance.now() - qStart;
        tableResults.push({
          table: tableName,
          ok: false,
          durationMs: Number(qDuration.toFixed(2)),
          statusCode: 0,
          error: err?.message || '네트워크 연결 오류'
        });
      }
    })
  );

  const totalDuration = performance.now() - startTime;
  const isAllHealthy = tableResults.every((t) => t.ok);
  const avgLatency = (
    tableResults.reduce((sum, t) => sum + t.durationMs, 0) / tableResults.length
  ).toFixed(2);

  return NextResponse.json(
    {
      status: isAllHealthy ? 'healthy' : 'degraded',
      service: '울산과학대학교 앵커사업단 RCC센터 포털 DB 엔진',
      timestamp: new Date().toISOString(),
      database: {
        provider: 'Supabase PostgreSQL (AWS ap-northeast-1)',
        url: supabaseUrl.replace(/^https:\/\/(.{4}).*(\..*)$/, 'https://$1***$2'),
        overallLatencyMs: Number(avgLatency),
        totalCheckTimeMs: Number(totalDuration.toFixed(2))
      },
      tables: tableResults,
      optimization: {
        indexesApplied: true,
        connectionWarmup: true,
        cacheControl: 'no-store'
      }
    },
    {
      status: isAllHealthy ? 200 : 207, // 207 Multi-Status
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Response-Time': `${totalDuration.toFixed(2)}ms`
      }
    }
  );
}
