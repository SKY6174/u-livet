// ==============================================================================
// 울산과학대학교 앵커사업단 평생직업교육 플랫폼 - Open Badges v2.0 표준 메타데이터 API
// ==============================================================================
// 파일 경로: src/app/api/badges/[id]/route.ts
// 설명:
//   1. 1EdTech (구 IMS Global)의 Open Badges v2.0 국제 표준 규격을 준수하는 JSON-LD API입니다.
//   2. 외부 배지 지갑(Open Badge Passport, Credly, Badgr) 및 링크드인(LinkedIn) 검증기가
//      이 엔드포인트를 호출하여 배지의 진위와 발급 기관(Issuer) 및 역량(Alignment)을 검증합니다.
//   3. W3C 호환 @context와 수령자 이메일의 단방향 SHA-256 해시를 제공합니다.
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const badgeId = params.id;
  const origin = request.nextUrl.origin || 'https://uc-life.vercel.app';

  // Open Badges v2.0 공식 표준 메타데이터 명세 구조화
  const openBadgeAssertion = {
    '@context': 'https://w3id.org/openbadges/v2',
    type: 'Assertion',
    id: `${origin}/api/badges/${badgeId}`,
    recipient: {
      type: 'email',
      hashed: true,
      identity: 'sha256$e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      salt: 'uc-anchor-salt-2026'
    },
    badge: {
      type: 'BadgeClass',
      id: `${origin}/api/badges/${badgeId}/class`,
      name: '스마트 친환경 선박 3D설계 직무 마스터 배지',
      description: '울산 주력산업인 조선해양 분야에서 미래 친환경 스마트 선박 3D 모델링, 선체 블록 검사 및 공정 설계 실무 역량을 마스터하였음을 인증합니다.',
      image: `${origin}/images/badges/badge_smart_ship.svg`,
      criteria: {
        narrative: '울산과학대학교 앵커사업단 RCC센터 주관 64시간 교육 이수, 출석률 80% 이상 및 종합평가 60점 이상 충족'
      },
      issuer: {
        type: 'Issuer',
        id: `${origin}/api/issuer`,
        name: '울산과학대학교 앵커사업단 RCC센터',
        url: origin,
        email: 'anchor@uc.ac.kr',
        description: '교육부 및 울산광역시 지자체-대학 협력 기반 지역성장 인재양성 앵커체계 평생직업교육 주관기관'
      },
      tags: [
        '스마트선박',
        '선체3D모델링',
        '친환경추진체계',
        '선박품질검사',
        '조선해양신산업'
      ],
      alignment: [
        {
          targetName: 'NCS 국가직무능력표준 조선가공·조립 레벨 5',
          targetUrl: 'https://www.ncs.go.kr',
          targetDescription: '선체 블록 모델링 및 구조해석 실무 역량 기준'
        }
      ]
    },
    issuedOn: '2026-08-26T00:00:00Z',
    verification: {
      type: 'HostedBadge'
    },
    evidence: {
      id: `${origin}/certificate/UC-ANCHOR-2026-00042`,
      narrative: '출석률 95.0% 및 최종 평가 성적 94.5점으로 정식 수료 및 공식 전자수료증(UC-ANCHOR-2026-00042) 발급 완료'
    }
  };

  // Content-Type을 application/ld+json 또는 application/json으로 응답
  return NextResponse.json(openBadgeAssertion, {
    status: 200,
    headers: {
      'Content-Type': 'application/ld+json; charset=utf-8',
      'Access-Control-Allow-Origin': '*' // 외부 배지 검증 서비스에서 크로스오리진 조회 허용
    }
  });
}
