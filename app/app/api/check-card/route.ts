import { NextResponse } from "next/server";
import { CHECK_CARD_SYSTEM_PROMPT, cleanJsonText, fileToBase64 } from "@/lib/checkCardPrompt";

/**
 * PC Check — /app/api/check-card (ผู้ให้บริการ AI: Claude / Anthropic)
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
 *
 * ดู /app/api/check-card-openai และ /app/api/check-card-gemini
 * สำหรับเวอร์ชันที่ใช้ AI เจ้าอื่น — ทั้งสามตัวใช้ SYSTEM_PROMPT
 * เดียวกันจาก lib/checkCardPrompt.ts เพื่อให้เทียบผลลัพธ์กันได้
 * อย่างยุติธรรม (apples-to-apples)
 *
 * เปิดใช้ web_search tool ของ Claude (server-side) ให้ AI ค้นเว็บ
 * ประกอบการวิเคราะห์ได้เมื่อพอระบุได้ว่าเป็นการ์ดอัลบั้ม/เวอร์ชันใด
 * (ดู lib/checkCardPrompt.ts) — เผื่อเวลาค้นเว็บ จึงตั้ง maxDuration
 * ยาวขึ้น และอ่านเฉพาะ text block สุดท้ายเป็นคำตอบ เพราะเมื่อมีการ
 * ค้นเว็บ content จะมี server_tool_use / web_search_tool_result
 * ปนอยู่ด้วย ไม่ใช่แค่ text block เดียวเหมือนก่อน
 */

export const maxDuration = 60;

const SYSTEM_PROMPT = CHECK_CARD_SYSTEM_PROMPT;

type ClaudeContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

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
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content }],
        tools: [
          {
            type: "web_search_20250305",
            name: "web_search",
            max_uses: 3,
          },
        ],
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
    // เมื่อ Claude ใช้ web_search tool, content จะมี server_tool_use /
    // web_search_tool_result ปนอยู่กับ text — เอาเฉพาะ text block
    // "สุดท้าย" เป็นคำตอบจริง (ไม่รวมข้อความระหว่างขั้นตอนค้นเว็บ)
    const textBlocks = (data.content ?? []).filter(
      (b: { type: string }) => b.type === "text"
    ) as { type: string; text: string }[];
    const rawText = (textBlocks[textBlocks.length - 1]?.text ?? "").trim();

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
