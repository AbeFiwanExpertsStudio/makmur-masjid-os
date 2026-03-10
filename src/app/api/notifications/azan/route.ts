import { NextRequest, NextResponse } from "next/server";
import { sendAzanNotification } from "@/lib/server/notifications";

export async function POST(req: NextRequest) {
  try {
    const { prayerKey } = await req.json();

    if (!prayerKey) {
      return NextResponse.json({ error: "Invalid prayerKey" }, { status: 400 });
    }

    const { success, sent, failed, error } = await sendAzanNotification(prayerKey);

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ success, sent, failed });
  } catch (err: any) {
    console.error("[azan push]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
