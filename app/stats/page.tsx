import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Collectra Stats", robots: { index: false, follow: false } };

type Summary = {
  visits_total: number;
  visitors_unique: number;
  visits_qr: number;
  checks_total: number;
  visits_today: number;
  checks_today: number;
  by_provider: Record<string, number>;
  by_day: { day: string; visits: number; checks: number }[];
};

async function getSummary(): Promise<Summary | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const r = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/usage_summary`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: "{}",
      cache: "no-store",
    });
    if (!r.ok) return null;
    return (await r.json()) as Summary;
  } catch {
    return null;
  }
}

const nf = (n: number) => new Intl.NumberFormat("th-TH").format(n ?? 0);

export default async function StatsPage({
  searchParams,
}: {
  // รองรับ Next.js ทั้งรุ่นเก่า (ค่าตรงๆ) และรุ่นใหม่ (Promise)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  searchParams?: any;
}) {
  const sp: { key?: string } = (await searchParams) || {};
  const need = process.env.STATS_KEY;
  if (need && sp.key !== need) {
    return (
      <main style={wrap}>
        <h1 style={h1}>Collectra Stats</h1>
        <p>หน้านี้ต้องใส่รหัส เช่น /stats?key=รหัสของคุณ</p>
      </main>
    );
  }
  const s = await getSummary();
  if (!s) {
    return (
      <main style={wrap}>
        <h1 style={h1}>Collectra Stats</h1>
        <p>ยังอ่านตัวเลขไม่ได้ ตรวจว่ารัน SQL ตั้งค่าใน Supabase แล้ว และตั้งค่า Supabase URL/Key ใน Vercel ครบ</p>
      </main>
    );
  }
  const cards: [string, number, string][] = [
    ["เข้าหน้าตรวจการ์ด (ครั้ง)", s.visits_total, `วันนี้ ${nf(s.visits_today)}`],
    ["ผู้เข้าชมไม่ซ้ำ (คน)", s.visitors_unique, "นับจากคุกกี้ของเบราว์เซอร์"],
    ["เข้าผ่าน QR (ครั้ง)", s.visits_qr, "ลิงก์ที่มี ?src=qr"],
    ["กดตรวจการ์ด (ครั้ง)", s.checks_total, `วันนี้ ${nf(s.checks_today)}`],
  ];
  return (
    <main style={wrap}>
      <h1 style={h1}>Collectra Stats</h1>
      <p style={{ color: "#555", marginTop: 0 }}>ตัวเลขรวมตั้งแต่เริ่มนับ (วันนี้ = ตามเวลาไทย)</p>
      <div style={grid}>
        {cards.map(([label, value, note]) => (
          <div key={label} style={card}>
            <div style={{ fontSize: 14, color: "#555" }}>{label}</div>
            <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.2 }}>{nf(value)}</div>
            <div style={{ fontSize: 13, color: "#777" }}>{note}</div>
          </div>
        ))}
      </div>

      <h2 style={h2}>แยกตาม AI ที่ใช้ตรวจ</h2>
      <p style={{ margin: 0 }}>
        {Object.keys(s.by_provider || {}).length === 0
          ? "ยังไม่มีข้อมูล"
          : Object.entries(s.by_provider)
              .map(([k, v]) => `${k}: ${nf(v)}`)
              .join("  ·  ")}
      </p>

      <h2 style={h2}>14 วันล่าสุด</h2>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", minWidth: 320 }}>
          <thead>
            <tr>
              <th style={th}>วันที่</th>
              <th style={thR}>เข้าหน้า</th>
              <th style={thR}>กดตรวจ</th>
            </tr>
          </thead>
          <tbody>
            {(s.by_day || []).length === 0 && (
              <tr>
                <td style={td} colSpan={3}>ยังไม่มีข้อมูล</td>
              </tr>
            )}
            {[...(s.by_day || [])].reverse().map((d) => (
              <tr key={d.day}>
                <td style={td}>{d.day}</td>
                <td style={tdR}>{nf(d.visits)}</td>
                <td style={tdR}>{nf(d.checks)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ color: "#777", fontSize: 13, marginTop: 24 }}>
        หมายเหตุ: &quot;กดตรวจ&quot; นับทุกครั้งที่กดปุ่มตรวจ รวมครั้งที่ AI ตอบผิดพลาดด้วย ไม่นับบอตและตัวแสดงตัวอย่างลิงก์
      </p>
    </main>
  );
}

const wrap: React.CSSProperties = { maxWidth: 760, margin: "0 auto", padding: "32px 16px", fontFamily: "system-ui, sans-serif", color: "#14213d" };
const h1: React.CSSProperties = { fontSize: 28, margin: "0 0 8px" };
const h2: React.CSSProperties = { fontSize: 18, margin: "28px 0 8px" };
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 };
const card: React.CSSProperties = { border: "1px solid #dbe3f5", borderRadius: 10, padding: 14, background: "#f7f9ff" };
const th: React.CSSProperties = { textAlign: "left", padding: "6px 14px 6px 0", borderBottom: "2px solid #14213d" };
const thR: React.CSSProperties = { ...th, textAlign: "right" };
const td: React.CSSProperties = { padding: "6px 14px 6px 0", borderBottom: "1px solid #e5e9f5" };
const tdR: React.CSSProperties = { ...td, textAlign: "right" };
