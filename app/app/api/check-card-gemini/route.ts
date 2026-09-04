import { NextResponse } from "next/server";
import { CHECK_CARD_SYSTEM_PROMPT, cleanJsonText, fileToBase64 } from "@/lib/checkCardPrompt";

/**
 * PC Check — /app/api/check-card-gemini (ผู้ให้บริการ AI: Google Gemini)
 *
 * เวอร์ชันเดียวกับ /app/api/check-card แต่เปลี่ยนไปเรียก Google
 * Generative Language API (Gemini) แทน Anthropic — ใช้ SYSTEM_PROMPT
 * ตัวเดียวกันทุกตัวอักษรจาก lib/checkCardPrompt.ts เพื่อให้เทียบ
 * ผลลัพธ์กับ Claude/OpenAI ได้อย่างยุติธรรม
 *
 * รับ: multipart/form-data
 *   field "front" (จำเป็น) — File รูปหน้าการ์ด
 *   field "back"  (ไม่บังคับ) — File รูปหลังการ์ด
 *
 * คืนค่า JSON:
 *   { confidence_score, verdict, verdict_th, summary, observations, disclaimer }
 *
 * ต้องตั้งค่า GEMINI_API_KEY ใน .env.local ก่อนใช้งาน
 * (ห้ามใส่ NEXT_PUBLIC_ นำหน้า เพราะต้องอยู่ฝั่งเซิร์ฟเวอร์เท่านั้น)
 * ขอ API key ได้ฟรีที่ https://aistudio.google.com/app/apikey
 */

type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

const GEMINI_MODEL = "gemini-2.0-flash";

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

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ไม่พบ GEMINI_API_KEY บนเซิร์ฟเวอร์ — ตั้งค่าใน .env.local ก่อน" },
        { status: 500 }
      );
    }

    const frontImg = await fileToBase64(front);

    const parts: GeminiPart[] = [
      { text: "นี่คือรูปด้านหน้าของการ์ดที่ต้องการตรวจสอบ:" },
      { inline_data: { mime_type: frontImg.mediaType, data: frontImg.data } },
    ];

    if (back && back instanceof File && back.size > 0) {
      const backImg = await fileToBase64(back);
      parts.push({ text: "นี่คือรูปด้านหลังของการ์ดใบเดียวกัน:" });
      parts.push({ inline_data: { mime_type: backImg.mediaType, data: backImg.data } });
    }

    parts.push({
      text: "วิเคราะห์รูป photo card นี้ตามคำสั่งของระบบ ตอบเป็น JSON เท่านั้น",
    });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: CHECK_CARD_SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts }],
        generationConfig: {
          maxOutputTokens: 2000,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `เรียก Gemini API ไม่สำเร็จ (${response.status}): ${errText}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const rawText = (
      data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? ""
    ).trim();
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
