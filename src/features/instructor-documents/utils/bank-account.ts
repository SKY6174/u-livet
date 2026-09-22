export const BANK_ACCOUNT_FORMATS: Record<string, string> = {
  "KB국민은행": "000000-00-000000",
  "신한은행": "000-000-000000",
  "우리은행": "0000-000-000000",
  "하나은행": "000-000000-00000",
  "NH농협은행": "000-0000-0000-00",
  "IBK기업은행": "000-000000-00-000",
  "카카오뱅크": "3333-00-0000000",
  "토스뱅크": "1000-0000-0000",
  "케이뱅크": "100-000-000000",
  "새마을금고": "9000-0000-0000-0",
  "부산은행": "000-00-000000-0",
  "대구은행": "000-00-000000-0",
  "경남은행": "000-00-0000000",
  "광주은행": "000-000-000000",
  "전북은행": "000-00-0000000",
  "SC제일은행": "000-00-000000",
  "수협은행": "000-00-000000",
  "신협": "00000-00-000000",
  "우체국": "000000-00-000000",
  "기타은행": ""
};

const BANK_NAME_ALIASES: Record<string, string> = {
  국민은행: "KB국민은행",
  KB국민: "KB국민은행",
  농협: "NH농협은행",
  농협은행: "NH농협은행",
  기업은행: "IBK기업은행",
  IBK기업: "IBK기업은행",
  SC제일: "SC제일은행",
  수협: "수협은행"
};

const normalizeBankName = (value: string): string =>
  value.normalize("NFKC").replace(/\s+/g, "").trim();

const resolveBankName = (bankName: string): string => {
  const normalized = normalizeBankName(bankName);
  if (BANK_ACCOUNT_FORMATS[normalized] !== undefined) return normalized;
  return BANK_NAME_ALIASES[normalized] || normalized;
};

export const formatBankAccountNumber = (bankName: string, value: string): string => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (!/^[\d\s-]+$/.test(trimmed)) return trimmed;

  const digits = trimmed.replace(/\D/g, "");
  const pattern = BANK_ACCOUNT_FORMATS[resolveBankName(bankName)];
  if (!pattern) return digits;

  const groupSizes = pattern.split("-").map(group => group.length);
  const groups: string[] = [];
  let offset = 0;
  groupSizes.forEach(size => {
    if (offset >= digits.length) return;
    groups.push(digits.slice(offset, offset + size));
    offset += size;
  });
  if (offset < digits.length) groups.push(digits.slice(offset));
  return groups.join("-");
};

export const maskBankAccountNumber = (bankName: string, value: string, maskedDigits = 5): string => {
  const formatted = formatBankAccountNumber(bankName, value);
  let remaining = maskedDigits;
  return Array.from(formatted).reverse().map(character => {
    if (remaining > 0 && /\d/.test(character)) {
      remaining -= 1;
      return "*";
    }
    return character;
  }).reverse().join("");
};
