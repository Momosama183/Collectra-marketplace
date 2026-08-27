import { NextResponse } from "next/server";

/**
 * Collectra — /app/api/check-packing
 *
 * พอร์ตมาจาก pack_check.py (Python) เป็น TypeScript
 *
 * รับ: multipart/form-data
 *   field "packing"  (จำเป็น) — File รูปตอนผู้ขายแพ็คสินค้า
 *   field "unboxing" (จำเป็น) — File รูปตอนผู้ซื้อแกะกล่อง
 *
 * คืนค่า JSON:
 *   { match_verdict, match_verdict_th, confidence_score, sleeve_detected,
 *     summary, observations, disclaimer }
 */

const SYSTEM_PROMPT = `คุณเป็นผู้ช่วยตรวจสอบข้อพิพาทการซื้อขาย photo card
K-pop มือสอง โดยเปรียบเทียบรูปสองรูป:
1. รูปตอนผู้ขาย "แพ็คสินค้า" ก่อนส่ง (packing photo)
2. รูปตอนผู้ซื้อ "แกะกล่อง" หลังได้รับ (unboxing photo)

หน้าที่ของคุณคือช่วยประเมินว่า:
- การ์ดที่เห็นในรูปทั้งสองเป็นใบเดียวกันหรือไม่ (ดูจากภาพศิลปินบนการ์ด
  สี องค์ประกอบ ตำแหน่งต่างๆ บนการ์ด)
- ในรูปตอนแพ็ค มีการใส่ซองกันรอย (sleeve) หรือท็อปโหลดเดอร์
  (toploader) ป้องกันการ์ดหรือไม่
- มีสัญญาณของการตัดต่อภาพ หรือความผิดปกติที่บ่งชี้ว่ารูปถูกดัดแปลง
  หรือไม่

ให้พิจารณาจากสิ่งที่มองเห็นได้จริงในภาพเท่านั้น ห้ามคาดเดาสิ่งที่ไม่
ปรากฏในรูป และห้ามฟันธงว่ามีการโกงเกิดขึ้นจริง เพราะภาพนิ่งเพียงสอง
ภาพไม่สามารถพิสูจน์เหตุการณ์ทั้งหมดได้ ให้ใช้คำว่า "สอดคล้องกัน" หรือ
"ไม่สอดคล้องกัน" แทนการตัดสินขาด

ถ้าผู้ใช้ส่งรูปด้านหลังมาด้วย ให้ใช้ขั้นตอนนี้ในการคำนวณ
confidence_score:

ขั้น 1: ประเมิน "base_score" จากรูปด้านหน้าเพียงอย่างเดียวก่อน
เสมอ (0-100) — นี่คือคะแนนหลักที่น่าเชื่อถือที่สุด เพราะมีสัญญาณ
ให้ตรวจสอบได้ครบถ้วนกว่า

ขั้น 2: ประเมินด้านหลังแยกต่างหาก แล้วปรับ base_score ได้ไม่เกิน
±10 คะแนนเท่านั้น ตามเกณฑ์นี้:
- ด้านหลังดูสอดคล้องกับมาตรฐานค่ายชัดเจน → ปรับเพิ่มได้สูงสุด +10
- ด้านหลังดูมีจุดน่าสงสัยเล็กน้อย → ปรับลดได้สูงสุด -5
- ด้านหลังดูผิดปกติชัดเจน (บาร์โค้ดผิด, ดีไซน์ไม่ตรงมาตรฐาน) →
  ปรับลดได้สูงสุด -10
- ห้ามปรับเกิน ±10 คะแนนจาก base_score ไม่ว่ากรณีใดก็ตาม เพราะ
  ยังไม่มีฐานข้อมูลอ้างอิงด้านหลังที่น่าเชื่อถือเพียงพอที่จะให้
  น้ำหนักมากกว่านี้

ขั้น 3: confidence_score สุดท้าย = base_score ที่ปรับแล้ว
(ห้ามต่ำกว่า 0 หรือเกิน 100)

ในฟิลด์ observations ให้ระบุแยกให้ชัดว่าข้อสังเกตไหนมาจาก "ด้านหน้า"
และข้อไหนมาจาก "ด้านหลัง" เพื่อให้ผู้ใช้เห็นที่มาของการปรับคะแนน

ตอบกลับเป็น JSON เท่านั้น ห้ามมีข้อความอื่นนอกเหนือจาก JSON ห้ามใส่
markdown code fence รูปแบบ:
{
  "match_verdict": "<ต้องเป็นหนึ่งใน 'Match', 'Mismatch', 'Needs Manual Review' เท่านั้น>",
  "match_verdict_th": "<คำแปลไทย เช่น 'สอดคล้องกัน' / 'ไม่สอดคล้องกัน' / 'ต้องตรวจสอบเพิ่มเติม'>",
  "confidence_score": <0-100>,
  "sleeve_detected": <true หรือ false>,
  "summary": "<สรุป 1-2 ประโยคภาษาไทย>",
  "observations": [{"type": "positive หรือ concern", "text": "<ข้อสังเกต>"}],
  "disclaimer": "<คำเตือนภาษาไทย โทนมืออาชีพ>"
}
ให้มี observations 3-6 ข้อ

เกณฑ์เลือก match_verdict:
- confidence_score >= 70 → "Match"
- confidence_score 40-69 → "Needs Manual Review"
- confidence_score < 40 → "Mismatch"`;

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
    const packing = formData.get("packing");
    const unboxing = formData.get("unboxing");

    if (!packing || !(packing instanceof File) || packing.size === 0) {
      return NextResponse.json(
        { error: "กรุณาอัปโหลดรูปตอนแพ็คสินค้า (field: packing)" },
        { status: 400 }
      );
    }
    if (!unboxing || !(unboxing instanceof File) || unboxing.size === 0) {
      return NextResponse.json(
        { error: "กรุณาอัปโหลดรูปตอนแกะกล่อง (field: unboxing)" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ไม่พบ ANTHROPIC_API_KEY บนเซิร์ฟเวอร์ — ตั้งค่าใน Environment Variables ก่อน" },
        { status: 500 }
      );
    }

    const packImg = await fileToBase64(packing);
    const unboxImg = await fileToBase64(unboxing);

    const content: ClaudeContentBlock[] = [
      { type: "text", text: "นี่คือรูปตอนผู้ขายแพ็คสินค้าก่อนส่ง:" },
      {
        type: "image",
        source: { type: "base64", media_type: packImg.mediaType, data: packImg.data },
      },
      { type: "text", text: "นี่คือรูปตอนผู้ซื้อแกะกล่องหลังได้รับ:" },
      {
        type: "image",
        source: { type: "base64", media_type: unboxImg.mediaType, data: unboxImg.data },
      },
      { type: "text", text: "เปรียบเทียบรูปทั้งสองตามคำสั่งของระบบ ตอบเป็น JSON เท่านั้น" },
    ];

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
        { error: "AI ตอบกลับมาไม่ใช่ JSON ที่ถูกต้อง", raw: cleaned },
        { status: 502 }
      );
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาดไม่ทราบสาเหตุ";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
