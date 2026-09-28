import { supabase } from "@/lib/supabase";
import { computeImageHash, hammingDistance, MATCH_THRESHOLD } from "@/lib/imageHash";

/**
 * ชุดรูปการ์ด TREASURE ที่ผู้ใช้ (เจ้าของร้าน) ยืนยันแล้วว่าเป็นของแท้ 100%
 * จากคอลเลกชันของตัวเอง/เพื่อน ใช้เป็นตัวอย่างอ้างอิงเสริมให้ AI ทั้ง 3 เจ้า
 * (Claude / GPT / Gemini) ดูประกอบการตรวจสอบการ์ดใหม่ที่ลูกค้าอัปโหลดเข้ามา
 *
 * เก็บเป็นตาราง `reference_cards` + storage bucket `reference-cards` ใน
 * Supabase โปรเจกต์เดียวกับที่ใช้เก็บ orders / payment slips อยู่แล้ว —
 * เพิ่ม/แก้ไข/ปิดใช้งานการ์ดอ้างอิงชุดนี้ได้ทุกเมื่อผ่าน Supabase dashboard
 * โดยไม่ต้องแก้โค้ดหรือ deploy ใหม่แต่อย่างใด
 *
 * หมายเหตุสำคัญ (แก้ไขจากเวอร์ชันก่อนหน้า): เดิมให้ AI เป็นคนตรวจสอบเองว่า
 * การ์ดที่กำลังตรวจสอบ "ตรงกับ" รูปอ้างอิงชุดใดชุดหนึ่งหรือไม่ (ให้ AI มอง
 * แล้วเดา) แต่ทดสอบจริงพบว่าวิธีนี้ไม่แม่นยำเลย — แม้เป็นไฟล์รูปเดียวกัน
 * เป๊ะ (byte-for-byte identical) AI ก็ยังจับคู่ไม่ได้ จึงเปลี่ยนมาให้โค้ด
 * เป็นคนเทียบภาพแทนด้วย perceptual image hashing (ดู lib/imageHash.ts)
 * ซึ่งแม่นยำกว่ามากสำหรับกรณี "รูปนี้เคยถูกอัปโหลดเป็นรูปอ้างอิงอยู่แล้ว"
 * แล้วส่งผลลัพธ์เป็นข้อความ "SYSTEM_MATCH" แนบไปให้ AI ใช้ประกอบการให้
 * คะแนนแทน (ดู buildMatchHintText ด้านล่าง และ CHECK_CARD_SYSTEM_PROMPT
 * ขั้น 0) — AI จะไม่พยายามจับคู่ภาพเองด้วยสายตาอีกต่อไป
 *
 * ข้อจำกัดของการเทียบด้วย hashing: ทนทานต่อการบีบอัด/ย่อขนาด/ปรับแสง
 * เล็กน้อย แต่ไม่ทนทานต่อการครอป/หมุนภาพต่างมุมมาก ดังนั้นจะจับคู่ได้ดี
 * เฉพาะกรณี "รูปเดียวกันหรือใกล้เคียงกันมาก" เท่านั้น ไม่ใช่การจดจำว่า
 * เป็นการ์ดใบเดียวกันที่ถ่ายคนละรูป/คนละมุม (ดูรายละเอียดใน imageHash.ts)
 *
 * ถ้าไม่ตรงกับรูปอ้างอิงใดเลย (กรณีปกติทั่วไป) AI จะใช้เปรียบเทียบเฉพาะ
 * "ลักษณะการผลิตทั่วไป" เท่านั้น (คุณภาพงานพิมพ์ ความเรียบร้อยของขอบ/มุม
 * การ์ด พื้นผิวเคลือบ ฟอนต์/เลย์เอาต์มาตรฐานของค่าย YG) เหมือนเดิม
 */

export interface ReferenceImage {
  mediaType: string;
  data: string; // base64, ไม่มี data: URI prefix
  hash: string; // perceptual hash (dHash, hex string) คำนวณจาก data ด้านบน
}

export interface ReferenceCard {
  id: string;
  label: string;
  front: ReferenceImage;
  back: ReferenceImage;
}

export interface ImageMatch {
  card: ReferenceCard;
  side: "front" | "back";
  distance: number; // Hamming distance (0-256, ยิ่งน้อยยิ่งคล้ายกัน)
}

const REFERENCE_BUCKET = "reference-cards";
const REFERENCE_TABLE = "reference_cards";

async function urlToBase64Image(url: string): Promise<ReferenceImage | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const mediaType = res.headers.get("content-type") || "image/jpeg";
    const hash = await computeImageHash(buffer);
    return { mediaType, data: buffer.toString("base64"), hash };
  } catch (err) {
    // ชั่วคราว: เก็บ error message ไว้ debug (ดู lastFetchErrors ด้านล่าง)
    lastFetchErrors.push(err instanceof Error ? err.message : String(err));
    return null;
  }
}

/** ชั่วคราว: เก็บ error message ล่าสุดจากการโหลด/hash รูปอ้างอิง ไว้ debug
 * ปัญหา referenceCards ว่างเปล่าใน production (ลบออกหลัง verify เสร็จ) */
export const lastFetchErrors: string[] = [];

/**
 * ดึงชุดรูปการ์ดอ้างอิงที่ยืนยันแท้แล้วจาก Supabase (ตาราง reference_cards
 * + storage bucket reference-cards) ตอนที่มีการตรวจสอบการ์ดแต่ละครั้ง
 *
 * ถ้าดึงไม่สำเร็จด้วยเหตุผลใดก็ตาม (ยังไม่ได้ตั้งตาราง/bucket, ยังไม่มี
 * ข้อมูล, หรือ Supabase มีปัญหาชั่วคราว) จะคืนอาร์เรย์ว่างเสมอ — ระบบ
 * ตรวจสอบการ์ดหลักยังทำงานได้ตามปกติเหมือนไม่มีรูปอ้างอิงเลย (ฟีเจอร์นี้
 * เป็นส่วนเสริม ไม่ใช่ hard dependency ของการตรวจสอบการ์ด)
 */
export async function fetchReferenceCards(): Promise<ReferenceCard[]> {
  lastFetchErrors.length = 0; // เคลียร์ error จากรอบก่อนหน้า
  try {
    const { data: rows, error } = await supabase
      .from(REFERENCE_TABLE)
      .select("id, label, front_path, back_path")
      .eq("active", true);

    if (error) {
      lastFetchErrors.push(`supabase query error: ${error.message}`);
      return [];
    }
    if (!rows || rows.length === 0) {
      lastFetchErrors.push("supabase query returned 0 rows");
      return [];
    }

    const cards: ReferenceCard[] = [];
    for (const row of rows as {
      id: string;
      label: string;
      front_path: string;
      back_path: string;
    }[]) {
      const frontUrl = supabase.storage.from(REFERENCE_BUCKET).getPublicUrl(row.front_path).data.publicUrl;
      const backUrl = supabase.storage.from(REFERENCE_BUCKET).getPublicUrl(row.back_path).data.publicUrl;

      const [front, back] = await Promise.all([urlToBase64Image(frontUrl), urlToBase64Image(backUrl)]);
      if (!front || !back) continue; // ข้ามใบนี้ถ้าโหลดรูปไม่สำเร็จ ไม่ทำให้ทั้งระบบล้ม

      cards.push({ id: row.id, label: row.label, front, back });
    }
    return cards;
  } catch (err) {
    lastFetchErrors.push(`unexpected error: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

export const REFERENCE_INTRO_TEXT =
  "ต่อไปนี้คือรูปตัวอย่างการ์ด TREASURE ที่ผู้ใช้ (เจ้าของร้าน) ยืนยันแล้วว่าเป็น" +
  "ของแท้ 100% จากคอลเลกชันของตัวเอง/เพื่อน ใช้เปรียบเทียบ \"ลักษณะการผลิต" +
  "ทั่วไป\" เท่านั้น เช่น คุณภาพงานพิมพ์ ความคมชัด ความเรียบร้อยของขอบ/มุม" +
  "การ์ด พื้นผิวเคลือบ และรูปแบบฟอนต์/เลย์เอาต์มาตรฐานของค่าย YG — ห้าม" +
  "พยายามเดาเองด้วยสายตาว่าการ์ดที่กำลังตรวจสอบ \"ตรงกับ\" รูปตัวอย่างชุดใด" +
  "ชุดหนึ่งหรือไม่ (การประเมินแบบ eyeball ของ AI ไม่แม่นยำพอสำหรับงานเทียบ" +
  "ภาพระดับพิกเซล) เรื่องนี้ระบบจะคำนวณด้วยโค้ดแยกต่างหากด้วย image hashing" +
  " แล้วแจ้งผลเป็นข้อความขึ้นต้นด้วย \"🔍 SYSTEM_MATCH:\" ให้ก่อนรูปการ์ดจริง" +
  " (ถ้าพบว่าตรงกัน) ดูวิธีใช้ผลลัพธ์นี้ที่ \"ขั้น 0\" ในคำแนะนำ";

export const REFERENCE_END_TEXT =
  "จบตัวอย่างการ์ดอ้างอิงที่ยืนยันแท้แล้ว ต่อไปนี้คือการ์ดจริงที่ต้องการให้ตรวจสอบ:";

/**
 * เทียบรูปการ์ดที่กำลังตรวจสอบ (front/back) กับรูปอ้างอิงทุกใบในฐานข้อมูล
 * ด้วย perceptual image hash คืนค่าคู่ที่คล้ายกันที่สุดถ้าต่ำกว่าเกณฑ์
 * MATCH_THRESHOLD มิเช่นนั้นคืนค่า null (ถือว่าไม่ตรงกับใบไหนเลย)
 */
export async function findImageMatch(
  frontBuffer: Buffer,
  backBuffer: Buffer | null,
  referenceCards: ReferenceCard[]
): Promise<ImageMatch | null> {
  const frontHash = await computeImageHash(frontBuffer);
  const backHash = backBuffer ? await computeImageHash(backBuffer) : null;

  let best: ImageMatch | null = null;
  for (const card of referenceCards) {
    const frontDistance = hammingDistance(frontHash, card.front.hash);
    if (frontDistance <= MATCH_THRESHOLD && (!best || frontDistance < best.distance)) {
      best = { card, side: "front", distance: frontDistance };
    }
    if (backHash) {
      const backDistance = hammingDistance(backHash, card.back.hash);
      if (backDistance <= MATCH_THRESHOLD && (!best || backDistance < best.distance)) {
        best = { card, side: "back", distance: backDistance };
      }
    }
  }
  return best;
}

/** สร้างข้อความ "SYSTEM_MATCH" จากผลจับคู่ภาพ เพื่อแนบเข้าไปในพร้อมพ์ให้ AI ใช้ */
export function buildMatchHintText(match: ImageMatch): string {
  const similarityPct = Math.round(((256 - match.distance) / 256) * 100);
  const sideText = match.side === "front" ? "ด้านหน้า" : "ด้านหลัง";
  return (
    `🔍 SYSTEM_MATCH: ระบบตรวจพบด้วยอัลกอริทึม image hashing (คำนวณจากโค้ด` +
    `โดยตรง ไม่ใช่การประเมินของ AI) ว่ารูป${sideText}ของการ์ดที่กำลังตรวจสอบ` +
    ` ตรงกับรูปอ้างอิง "${match.card.label}" (${sideText}) อย่างมีนัยสำคัญ ` +
    `— ความคล้ายกันของพิกเซลหลัง resize ${similarityPct}% (Hamming distance` +
    ` = ${match.distance}/256) ให้ถือเป็นหลักฐานยืนยันความแท้ที่หนักแน่น` +
    `ที่สุดตาม "ขั้น 0" ในคำแนะนำ`
  );
}
