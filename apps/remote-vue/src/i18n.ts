import type { Language } from "@poc/platform-contracts";

const en = {
  heading: "Fictional Vue Account Summary",
  "Open orders": "Open orders",
  Language: "Language",
  Account: "Account",
  "Account summary": "Account summary",
  Summary: "Summary",
  "Shell user": "Shell user",
};

const th: Record<keyof typeof en, string> = {
  heading: "สรุปบัญชี Vue (สมมติ)",
  "Open orders": "คำสั่งซื้อที่เปิดอยู่",
  Language: "ภาษา",
  Account: "บัญชี",
  "Account summary": "สรุปบัญชี",
  Summary: "สรุป",
  "Shell user": "ผู้ใช้เชลล์",
};

export function t(language: Language, key: keyof typeof en): string {
  return (language === "th" ? th : en)[key];
}
