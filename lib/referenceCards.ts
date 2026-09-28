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
 * หมายเหตุสำคัญ: การ์ดอ้างอิงเหล่านี้เป็นคนละใบ คนละอัลบั้ม/สมาชิกกับการ์ด
 * ที่กำลังตรวจสอบอยู่เสมอ จึงใช้เปรียบเทียบได้เฉพาะ "ลักษณะการผลิตทั่วไป"
 * เท่านั้น (คุณภาพงานพิมพ์ ความเรียบร้อยของขอบ/มุมการ์ด พื้นผิวเคลือบ
 * ฟอนต์/เลย์เอาต์มาตรฐานของค่าย YG) ไม่ใช่การเทียบว่าลวดลาย/รูปภาพ/สี
 * พื้นหลังต้องตรงกันเป๊ะ เพราะเป็นคนละดีไซน์กันโดยธรรมชาติ
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
  "ของแท้ 100% จากคอลเลกชันของตัวเอง/เพื่อน (คนละใบ คนละอัลบั้ม/สมาชิกกับการ์ดที่" +
  "กำลังจะตรวจสอบต่อจากนี้) ใช้เป็นตัวอย่างอ้างอิงเปรียบเทียบเฉพาะ \"ลักษณะการผลิต" +
  "ทั่วไป\" เท่านั้น เช่น คุณภาพงานพิมพ์ ความคมชัด ความเรียบร้อยของขอบ/มุมการ์ด " +
  "พื้นผิวเคลือบ และรูปแบบฟอนต์/เลย์เอาต์มาตรฐานของค่าย YG — ห้ามใช้เปรียบเทียบว่า" +
  "ลวดลาย/รูปภาพศิลปิน/สีพื้นหลังต้องตรงกันเป๊ะ เพราะเป็นคนละดีไซน์กันโดยธรรมชาติ " +
  "(คนละอัลบั้ม/สมาชิก)";

export const REFERENCE_END_TEXT =
  "จบตัวอย่างการ์ดอ้างอิงที่ยืนยันแท้แล้ว ต่อไปนี้คือการ์ดจริงที่ต้องการให้ตรวจสอบ:";
