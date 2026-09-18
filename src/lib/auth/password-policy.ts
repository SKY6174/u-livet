export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_GUIDANCE =
  "12자 이상으로 영문 대문자, 소문자, 숫자, 특수문자를 모두 넣어 주세요.";

export function getPasswordChecks(password: string) {
  return [
    {
      id: "length",
      label: "12자 이상",
      met: Array.from(password).length >= PASSWORD_MIN_LENGTH,
    },
    {
      id: "lowercase",
      label: "영문 소문자 포함 (a–z)",
      met: /[a-z]/.test(password),
    },
    { id: "uppercase", label: "영문 대문자 포함 (A–Z)", met: /[A-Z]/.test(password) },
    { id: "number", label: "숫자 포함", met: /[0-9]/.test(password) },
    {
      id: "symbol",
      label: "특수문자 포함 (예: ! @ # ?)",
      met: /[!-/:-@\[-`{-~]/.test(password),
    },
  ];
}

export function isValidPassword(password: string) {
  return (
    password.length <= PASSWORD_MAX_LENGTH &&
    getPasswordChecks(password).every((check) => check.met)
  );
}
