import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const formData = await req.formData();
  const slip = formData.get("slip");
  const amount = formData.get("amount");

  if (!slip || !amount) {
    return NextResponse.json(
      { ok: false, message: "Missing slip or amount." },
      { status: 400 }
    );
  }

  // Later: connect EasySlip or SlipOK API here using API key from .env.local
  return NextResponse.json({
    ok: true,
    status: "pending_real_api",
    message: "Slip received. Real verification API connection goes here.",
  });
}