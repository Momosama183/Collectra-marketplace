// รับเหตุการณ์ "เปิดหน้า" จากแอปมือถือ (Render) แล้วบันทึกลงตารางเดียวกับหน้าตรวจการ์ด
// รับเฉพาะ visit ที่ src เป็น app หรือ app-qr เท่านั้น จะอ่านหรือเขียนอย่างอื่นไม่ได้
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return new Response(null, { status: 204 });
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    const visitor = String(b?.visitor || "").replace(/[^0-9a-f]/gi, "").slice(0, 24);
    if (visitor.length !== 24) return new Response(null, { status: 204 });
    const src = b?.src === "qr" ? "app-qr" : "app";
    await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/log_event`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_kind: "visit", p_visitor: visitor, p_src: src, p_provider: null }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // เงียบไว้ ตัวนับห้ามทำให้อะไรพัง
  }
  return new Response(null, { status: 204 });
}
