export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_GUIDANCE =
  "12자 이상으로 영문, 숫자, 특수문자를 모두 넣어 주세요. 대문자와 소문자를 섞지 않아도 됩니다.";

export function getPasswordChecks(password: string) {
  return [
    {
      id: "length",
      label: "12자 이상",
      met: Array.from(password).length >= PASSWORD_MIN_LENGTH,
    },
    {
      id: "letter",
      label: "영문 포함 (대·소문자 중 하나)",
      met: /[a-zA-Z]/.test(password),
    },
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
