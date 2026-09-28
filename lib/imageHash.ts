import sharp from "sharp";

/**
 * Perceptual image hashing (dHash) — ใช้เทียบว่ารูป 2 รูปเป็น "รูปเดียวกัน"
 * หรือรูปที่เกือบจะเหมือนกันเป๊ะ (ถูกบีบอัด/ย่อขนาด/ปรับความสว่างเล็กน้อย)
 * หรือไม่ ด้วยการคำนวณจากโค้ดโดยตรง (deterministic) แทนที่จะให้ AI มอง
 * ภาพแล้วเดาเอาเองว่า "เหมือนกันไหม"
 *
 * เหตุผลที่ต้องทำแบบนี้: ทดสอบจริงพบว่า AI vision (ทั้ง Claude/GPT/Gemini)
 * ไม่สามารถระบุได้ว่ารูป 2 รูปเป็น "ไฟล์เดียวกันเป๊ะ" แม้จะเป็นไฟล์
 * เดียวกันจริง (byte-for-byte identical) — การให้ AI ประเมินด้วยสายตา
 * ไม่แม่นยำพอสำหรับงานเทียบภาพระดับพิกเซล จึงต้องใช้อัลกอริทึมเทียบภาพ
 * แทน แล้วส่งผลลัพธ์ (ไม่ใช่ตัวรูป) เป็นข้อความบอก AI อีกที
 *
 * ข้อจำกัดของวิธีนี้ (ทดสอบแล้วจริง เพื่อไม่ให้คาดหวังเกินจริง):
 * - ทนทานดีต่อ: การบีบอัด JPEG คุณภาพต่างกัน, การย่อ/ขยายขนาดภาพ,
 *   การปรับความสว่าง/คอนทราสต์เล็กน้อย (Hamming distance เปลี่ยนแค่ ~8-11
 *   จาก 256 บิต ในการทดสอบจริง)
 * - ไม่ทนทานต่อ: การครอปภาพต่างมุม (แม้แค่ 5% ต่อขอบ ก็ทำให้ distance
 *   พุ่งไปถึง ~42 ซึ่งใกล้เคียงกับการ์ดคนละใบ) หรือการถ่ายเอียง/หมุนภาพ
 *   (หมุนแค่ 3 องศา distance พุ่งไปถึง ~71)
 * ดังนั้นวิธีนี้เหมาะสำหรับตรวจจับกรณี "รูปนี้เคยถูกอัปโหลดเป็นรูปอ้างอิง
 * ในฐานข้อมูลอยู่แล้ว" (รูปเดียวกันหรือใกล้เคียงกันมาก) ได้แม่นยำสูง แต่
 * "ไม่เหมาะ" สำหรับจดจำว่า "การ์ดใบเดียวกันที่ถ่ายคนละรูป/คนละมุม" เป็น
 * ใบเดียวกัน — งานหลังนี้ต้องใช้เทคนิคขั้นสูงกว่านี้มาก (feature/keypoint
 * matching หรือ trained embedding model) ซึ่งอยู่นอกขอบเขตของฟีเจอร์นี้
 */

const HASH_GRID = 16; // -> resize เป็น 17x16 แล้วเทียบพิกเซลติดกันแนวนอน = 256 บิต

/** คำนวณ dHash (256-bit) ของรูปภาพ คืนค่าเป็น hex string ยาว 64 ตัวอักษร */
export async function computeImageHash(input: Buffer): Promise<string> {
  const { data, info } = await sharp(input)
    .greyscale()
    .resize(HASH_GRID + 1, HASH_GRID, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  let bits = "";
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width - 1; x++) {
      bits += data[y * width + x] > data[y * width + x + 1] ? "1" : "0";
    }
  }

  let hex = "";
  for (let i = 0; i < bits.length; i += 4) {
    hex += parseInt(bits.slice(i, i + 4).padEnd(4, "0"), 2).toString(16);
  }
  return hex;
}

/** Hamming distance ระหว่าง hash 2 ตัว (hex string) — ยิ่งน้อยยิ่งคล้ายกัน
 * (0 = พิกเซลรูปแบบเดียวกันเป๊ะหลัง resize, 256 = ต่างกันสุดขั้ว) */
export function hammingDistance(hexA: string, hexB: string): number {
  if (hexA.length !== hexB.length) return Infinity;
  let distance = 0;
  for (let i = 0; i < hexA.length; i++) {
    let diff = parseInt(hexA[i], 16) ^ parseInt(hexB[i], 16);
    while (diff) {
      distance += diff & 1;
      diff >>= 1;
    }
  }
  return distance;
}

/**
 * เกณฑ์ตัดสินว่า "ตรงกัน" ได้จากการทดลองจริงกับการ์ดทดสอบ 10 ใบ:
 * - การ์ดคนละใบกัน (คนละดีไซน์): Hamming distance อยู่ที่ ~40-111 บิต
 * - รูปเดียวกันที่ถูกบีบอัด/ย่อ/ปรับแสงต่างกันเล็กน้อย: อยู่ที่ ~8-11 บิต
 * ตั้งไว้ที่ 20 บิต เพื่อให้มี margin ปลอดภัยทั้งสองด้าน (สูงกว่าความ
 * แปรปรวนจากการบีบอัด/ย่อภาพเกือบ 2 เท่า แต่ยังต่ำกว่าค่าต่ำสุดที่พบ
 * ระหว่างการ์ดคนละใบอยู่มาก)
 */
export const MATCH_THRESHOLD = 20;
