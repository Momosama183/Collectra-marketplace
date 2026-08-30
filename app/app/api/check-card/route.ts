import { NextResponse } from "next/server";

/**
 * PC Check — /app/api/check-card
 *
 * พอร์ตมาจาก checker.py (Python) เป็น TypeScript ให้รันอยู่ใน
 * Next.js project เดียวกันเลย ไม่ต้องมี Python backend แยก
 *
 * รับ: multipart/form-data
 *   field "front" (จำเป็น) — File รูปหน้าการ์ด
 *   field "back"  (ไม่บังคับ) — File รูปหลังการ์ด
 *
 * คืนค่า JSON:
 *   { confidence_score, verdict, verdict_th, summary, observations, disclaimer }
 *
 * ต้องตั้งค่า ANTHROPIC_API_KEY ใน .env.local ก่อนใช้งาน
 * (ห้ามใส่ NEXT_PUBLIC_ นำหน้า เพราะต้องอยู่ฝั่งเซิร์ฟเวอร์เท่านั้น)
 */

const SYSTEM_PROMPT = `คุณเป็นผู้ช่วยวิเคราะห์คุณภาพภาพของ photo card ศิลปิน K-pop
เพื่อช่วยผู้สะสมสังเกตสัญญาณเบื้องต้นที่ "อาจ" บ่งชี้ว่าการ์ดเป็นของ
ก็อปปี้/พิมพ์ซ้ำ (bootleg) เทียบกับการ์ดแท้จากค่าย ผู้ใช้อาจส่งมาแค่
รูปหน้า หรือทั้งหน้าและหลัง

ให้พิจารณาเฉพาะสิ่งที่สังเกตได้จากคุณภาพภาพเท่านั้น เช่น:
- ความคมชัดของภาพพิมพ์ ตัวหนังสือ และโลโก้ค่าย
- ความแม่นยำของสีเมื่อเทียบกับโทนสีที่สมจริง
- ความเรียบร้อยของขอบการ์ดและรูปร่างมุมการ์ด (corner shape)
- ลักษณะแสงสะท้อนบนผิวการ์ด (surface reflection)
- ตำแหน่งโลโก้/ตัวหนังสือว่าเยื้องหรือผิดสัดส่วนหรือไม่
- ลาย moiré หรือสัญญาณว่าเป็นภาพถ่ายซ้ำจากหน้าจอ/สำเนา
- ถ้ามีรูปด้านหลัง: ความสอดคล้องของดีไซน์ด้านหลังกับมาตรฐานการ์ดค่าย
- ร่องรอยการตัดต่อ/แก้ไขภาพ

ห้ามอ้างว่ารู้จักดีไซน์การ์ดจริงของศิลปินคนใดคนหนึ่งโดยเฉพาะ เพราะไม่มี
ฐานข้อมูลอ้างอิง เตือนผู้ใช้เสมอว่านี่คือการประเมินเบื้องต้น ไม่ใช่การ
ยืนยันความแท้

ตอบกลับเป็น JSON เท่านั้น ห้ามมีข้อความอื่นนอกเหนือจาก JSON ห้ามใส่
markdown code fence รูปแบบ:
{
  "confidence_score": <0-100>,
  "verdict": "<'Likely Authentic' หรือ 'Suspicious' หรือ 'Needs Manual Review'>",
  "verdict_th": "<คำแปลไทย>",
  "summary": "<สรุป 1-2 ประโยค>",
  "observations": [{"type": "positive หรือ concern", "text": "<ข้อสังเกต>"}],
  "disclaimer": "<คำเตือนภาษาไทย เขียนโทนมืออาชีพ เน้นว่าเป็นการประเมินเบื้องต้น ควรตรวจสอบเพิ่มเติมก่อนตัดสินใจซื้อขาย>"
}
ให้มี observations 3-7 ข้อ ถ้าได้รับรูปหลังด้วยให้มีอย่างน้อย 1 ข้อ
ที่พูดถึงด้านหลังการ์ดโดยเฉพาะ

เกณฑ์เลือก verdict:
- confidence_score >= 70 → "Likely Authentic"
- confidence_score 40-69 → "Needs Manual Review"
- confidence_score < 40 → "Suspicious"`;

type ClaudeContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

function cleanJsonText(raw: string): string {
  return raw
    .replace(/^```json/i, "")
    .replace(/^```/, "")
    .replace(/```$/, "")
    .trim();
}

async function fileToBase64(file: File): Promise<{ data: string; mediaType: string }> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return { data: buffer.toString("base64"), mediaType: file.type || "image/jpeg" };
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const front = formData.get("front");
    const back = formData.get("back");

    if (!front || !(front instanceof File) || front.size === 0) {
      return NextResponse.json(
        { error: "กรุณาอัปโหลดรูปหน้าการ์ดอย่างน้อย 1 รูป (field: front)" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ไม่พบ ANTHROPIC_API_KEY บนเซิร์ฟเวอร์ — ตั้งค่าใน .env.local ก่อน" },
        { status: 500 }
      );
    }

    const frontImg = await fileToBase64(front);

    const content: ClaudeContentBlock[] = [
      { type: "text", text: "นี่คือรูปด้านหน้าของการ์ดที่ต้องการตรวจสอบ:" },
      {
        type: "image",
        source: { type: "base64", media_type: frontImg.mediaType, data: frontImg.data },
      },
    ];

    if (back && back instanceof File && back.size > 0) {
      const backImg = await fileToBase64(back);
      content.push({ type: "text", text: "นี่คือรูปด้านหลังของการ์ดใบเดียวกัน:" });
      content.push({
        type: "image",
        source: { type: "base64", media_type: backImg.mediaType, data: backImg.data },
      });
    }

    content.push({
      type: "text",
      text: "วิเคราะห์รูป photo card นี้ตามคำสั่งของระบบ ตอบเป็น JSON เท่านั้น",
    });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `เรียก Claude API ไม่สำเร็จ (${response.status}): ${errText}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const rawText = (data.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("")
      .trim();

    const cleaned = cleanJsonText(rawText);

    let result: unknown;
    try {
      result = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: "AI ตอบกลับมาไม่ใช่ JSON ที่ถูกต้อง (อาจตอบยาวเกิน max_tokens)", raw: cleaned },
        { status: 502 }
      );
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาดไม่ทราบสาเหตุ";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}