import { NextResponse } from "next/server";
import { getProvider } from "@/lib/providers";

export async function GET() {
  const data = await getProvider().getOverview();
  return NextResponse.json(data);
}
