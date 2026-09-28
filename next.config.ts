import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  // sharp ใช้ native binary (.node) — ถ้าไม่ประกาศไว้ตรงนี้ Next.js อาจไม่
  // bundle ไฟล์ native ให้ครบตอน deploy เป็น Vercel serverless function
  // ทำให้ sharp โยน error ตอนรันจริงบน production (แต่รันได้ปกติตอน dev
  // in local เพราะใช้ node_modules ตรงๆ) ซึ่งเป็นสาเหตุที่ computeImageHash()
  // ใน lib/imageHash.ts ล้มเหลวเงียบๆ (ถูก catch ใน urlToBase64Image)
  // ทำให้ referenceCards กลายเป็น array ว่างเสมอในการใช้งานจริง
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
