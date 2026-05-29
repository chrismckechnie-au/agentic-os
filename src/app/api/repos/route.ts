import { NextResponse } from "next/server";
import { getProvider } from "@/lib/providers";

export async function GET() {
  const repos = await getProvider().listRepos();
  return NextResponse.json(repos);
}
