import { supabase } from "@/lib/supabase";

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
 * หมายเหตุสำคัญ: โดยทั่วไปการ์ดอ้างอิงเหล่านี้มักเป็นคนละใบคนละอัลบั้ม/
 * สมาชิกกับการ์ดที่กำลังตรวจสอบ แต่ตอนนี้ AI จะตรวจสอบก่อนเสมอว่าการ์ด
 * ที่กำลังตรวจสอบตรงกับรูปอ้างอิงชุดใดชุดหนึ่งหรือไม่ (image matching) —
 * ถ้าตรงกันชัดเจน (ดีไซน์/ลวดลาย/องค์ประกอบตรงกันเป็นส่วนใหญ่ หรือเป็น
 * ภาพเดียวกันเป๊ะ) จะถือเป็นหลักฐานยืนยันความแท้ที่หนักแน่นเป็นพิเศษและ
 * ดันคะแนนเริ่มต้นขึ้นสูง ถ้าไม่ตรงกัน (กรณีปกติทั่วไป) จะใช้เปรียบเทียบ
 * เฉพาะ "ลักษณะการผลิตทั่วไป" เท่านั้น (คุณภาพงานพิมพ์ ความเรียบร้อยของ
 * ขอบ/มุมการ์ด พื้นผิวเคลือบ ฟอนต์/เลย์เอาต์มาตรฐานของค่าย YG) เหมือนเดิม
 * — ดูรายละเอียดขั้นตอนเต็มใน CHECK_CARD_SYSTEM_PROMPT (ขั้น 0)
 */

export interface ReferenceImage {
  mediaType: string;
  data: string; // base64, ไม่มี data: URI prefix
}

export interface ReferenceCard {
  id: string;
  label: string;
  front: ReferenceImage;
  back: ReferenceImage;
}

const REFERENCE_BUCKET = "reference-cards";
const REFERENCE_TABLE = "reference_cards";

async function urlToBase64Image(url: string): Promise<ReferenceImage | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const mediaType = res.headers.get("content-type") || "image/jpeg";
    return { mediaType, data: buffer.toString("base64") };
  } catch {
    return null;
  }
}

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
  try {
    const { data: rows, error } = await supabase
      .from(REFERENCE_TABLE)
      .select("id, label, front_path, back_path")
      .eq("active", true);

    if (error || !rows || rows.length === 0) return [];

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
  } catch {
    return [];
  }
}

export const REFERENCE_INTRO_TEXT =
  "ต่อไปนี้คือรูปตัวอย่างการ์ด TREASURE ที่ผู้ใช้ (เจ้าของร้าน) ยืนยันแล้วว่าเป็น" +
  "ของแท้ 100% จากคอลเลกชันของตัวเอง/เพื่อน ให้ตรวจสอบก่อนเสมอว่าการ์ดที่กำลัง" +
  "จะตรวจสอบต่อจากนี้ มีดีไซน์ตรงกันหรือใกล้เคียงกันมากกับรูปตัวอย่างอ้างอิงชุด" +
  "ใดชุดหนึ่งหรือไม่ (ดูวิธีคำนวณคะแนนที่ \"ขั้น 0\" ในคำแนะนำ) ถ้าพบว่าตรงกัน" +
  "ชัดเจน ให้ถือเป็นหลักฐานยืนยันความแท้ที่หนักแน่นเป็นพิเศษ แต่ถ้าไม่ตรงกับรูป" +
  "ใดเลย (ซึ่งเป็นกรณีปกติทั่วไป เพราะมักเป็นคนละใบคนละอัลบั้ม/สมาชิก) ให้ใช้" +
  "เปรียบเทียบเฉพาะ \"ลักษณะการผลิตทั่วไป\" เท่านั้น เช่น คุณภาพงานพิมพ์ ความ" +
  "คมชัด ความเรียบร้อยของขอบ/มุมการ์ด พื้นผิวเคลือบ และรูปแบบฟอนต์/เลย์เอาต์" +
  "มาตรฐานของค่าย YG";

export const REFERENCE_END_TEXT =
  "จบตัวอย่างการ์ดอ้างอิงที่ยืนยันแท้แล้ว ต่อไปนี้คือการ์ดจริงที่ต้องการให้ตรวจสอบ:";
