// Server-only configuration: never derived from a cookie, query or request header.
export function isReviewOnly() {
  return process.env.PREVIEW_REVIEW_ONLY === "true";
}

export const REVIEW_MESSAGE =
  "검토용 미리보기입니다. 화면과 공개 과정만 확인할 수 있으며 로그인·회원가입·자료 저장은 지원하지 않습니다.";
