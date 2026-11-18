import type { Language } from "@poc/platform-contracts";

const en = {
  "Fictional React Orders": "Fictional React Orders",
  "Sign in to view fictional orders.": "Sign in to view fictional orders.",
  Open: "Open",
  "Back to orders": "Back to orders",
  "Order not found": "Order not found",
  "Open orders": "Open orders",
  "Refresh orders": "Refresh orders",
  Orders: "Orders",
  Order: "Order",
  "Shell user": "Shell user",
};

const th: Record<keyof typeof en, string> = {
  "Fictional React Orders": "คำสั่งซื้อ React (สมมติ)",
  "Sign in to view fictional orders.": "เข้าสู่ระบบเพื่อดูคำสั่งซื้อสมมติ",
  Open: "เปิด",
  "Back to orders": "กลับไปที่คำสั่งซื้อ",
  "Order not found": "ไม่พบคำสั่งซื้อ",
  "Open orders": "คำสั่งซื้อที่เปิดอยู่",
  "Refresh orders": "รีเฟรชคำสั่งซื้อ",
  Orders: "คำสั่งซื้อ",
  Order: "คำสั่งซื้อ",
  "Shell user": "ผู้ใช้เชลล์",
};

export function t(language: Language, key: keyof typeof en): string {
  return (language === "th" ? th : en)[key];
}
