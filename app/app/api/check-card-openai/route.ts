import { NextResponse } from "next/server";
import { CHECK_CARD_SYSTEM_PROMPT, cleanJsonText, fileToBase64 } from "@/lib/checkCardPrompt";

/**
 * PC Check — /app/api/check-card-openai (ผู้ให้บริการ AI: OpenAI GPT-4o)
 *
 * เวอร์ชันเดียวกับ /app/api/check-card แต่เปลี่ยนไปเรียก OpenAI
 * Chat Completions API แทน Anthropic — ใช้ SYSTEM_PROMPT ตัวเดียวกัน
 * ทุกตัวอักษรจาก lib/checkCardPrompt.ts เพื่อให้เทียบผลลัพธ์กับ
 * Claude/Gemini ได้อย่างยุติธรรม
 *
 * รับ: multipart/form-data
 *   field "front" (จำเป็น) — File รูปหน้าการ์ด
 *   field "back"  (ไม่บังคับ) — File รูปหลังการ์ด
 *
 * คืนค่า JSON:
 *   { confidence_score, verdict, verdict_th, summary, observations, disclaimer }
 *
 * ต้องตั้งค่า OPENAI_API_KEY ใน .env.local ก่อนใช้งาน
 * (ห้ามใส่ NEXT_PUBLIC_ นำหน้า เพราะต้องอยู่ฝั่งเซิร์ฟเวอร์เท่านั้น)
 * ขอ API key ได้ที่ https://platform.openai.com/api-keys
 */

type OpenAIContentBlock =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

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

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ไม่พบ OPENAI_API_KEY บนเซิร์ฟเวอร์ — ตั้งค่าใน .env.local ก่อน" },
        { status: 500 }
      );
    }

    const frontImg = await fileToBase64(front);

    const content: OpenAIContentBlock[] = [
      { type: "text", text: "นี่คือรูปด้านหน้าของการ์ดที่ต้องการตรวจสอบ:" },
      { type: "image_url", image_url: { url: `data:${frontImg.mediaType};base64,${frontImg.data}` } },
    ];

    if (back && back instanceof File && back.size > 0) {
      const backImg = await fileToBase64(back);
      content.push({ type: "text", text: "นี่คือรูปด้านหลังของการ์ดใบเดียวกัน:" });
      content.push({
        type: "image_url",
        image_url: { url: `data:${backImg.mediaType};base64,${backImg.data}` },
      });
    }

    content.push({
      type: "text",
      text: "วิเคราะห์รูป photo card นี้ตามคำสั่งของระบบ ตอบเป็น JSON เท่านั้น",
    });

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 2000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: CHECK_CARD_SYSTEM_PROMPT },
          { role: "user", content },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `เรียก OpenAI API ไม่สำเร็จ (${response.status}): ${errText}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const rawText = (data.choices?.[0]?.message?.content ?? "").trim();
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
