import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";

/**
 * Collectra usage counter
 * - นับการเข้าหน้า /verify (visit) และการกดตรวจการ์ด (check) ลงตาราง usage_events ใน Supabase
 * - ไม่แก้ไฟล์เดิมของเว็บ และไม่ทำให้หน้าเว็บช้าลง (ส่งข้อมูลหลังตอบผู้ใช้แล้ว)
 * - ถ้า Supabase มีปัญหา เว็บยังทำงานปกติ แค่ไม่นับครั้งนั้น
 * - เก็บแค่รหัสสุ่มในคุกกี้ (ไม่มีชื่อ อีเมล หรือ IP)
 */

export const config = {
  matcher: [
    "/verify",
    "/app/api/check-card",
    "/app/api/check-card-openai",
    "/app/api/check-card-gemini",
  ],
};

const COOKIE = "cx_vid";
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|line-poker|whatsapp|telegram|headless|lighthouse|vercel|curl|wget/i;

function newId(): string {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

function send(event: NextFetchEvent, body: Record<string, string | null>) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return;
  event.waitUntil(
    fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/log_event`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }).catch(() => {})
  );
}

export function middleware(req: NextRequest, event: NextFetchEvent) {
  const res = NextResponse.next();
  try {
    const ua = req.headers.get("user-agent") || "";
    if (BOT.test(ua)) return res;

    const path = req.nextUrl.pathname;
    let vid = req.cookies.get(COOKIE)?.value || "";
    const isNew = !/^[0-9a-f]{24}$/.test(vid);
    if (isNew) vid = newId();

    if (req.method === "GET" && path === "/verify") {
      // นับเฉพาะการเปิดหน้าจริง ไม่นับ prefetch หรือคำขอภายในของ Next
      const dest = req.headers.get("sec-fetch-dest");
      const isPrefetch =
        req.headers.has("next-router-prefetch") ||
        req.headers.get("purpose") === "prefetch" ||
        /prefetch|prerender/i.test(req.headers.get("sec-purpose") || "") ||
        req.headers.has("rsc");
      const isPage = dest ? dest === "document" : (req.headers.get("accept") || "").includes("text/html");
      if (isPage && !isPrefetch) {
        const src = (req.nextUrl.searchParams.get("src") || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
        send(event, { p_kind: "visit", p_visitor: vid, p_src: src || null, p_provider: null });
      }
    } else if (req.method === "POST" && path.startsWith("/app/api/check-card")) {
      const provider = path.endsWith("-openai") ? "openai" : path.endsWith("-gemini") ? "gemini" : "claude";
      send(event, { p_kind: "check", p_visitor: vid, p_src: ua.startsWith("collectra-mobile") ? "app" : null, p_provider: provider });
    }

    if (isNew) {
      res.cookies.set(COOKIE, vid, { maxAge: 60 * 60 * 24 * 365, path: "/", sameSite: "lax", httpOnly: true });
    }
  } catch {
    // ไม่ให้ตัวนับทำให้เว็บล่ม
  }
  return res;
}
