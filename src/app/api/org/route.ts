import { NextResponse } from "next/server";
import { RunwayClient, RunwayError } from "@/lib/runway/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const client = new RunwayClient();
    const org = await client.getOrganization();
    return NextResponse.json({ ok: true, org });
  } catch (err) {
    if (err instanceof RunwayError) {
      return NextResponse.json({ ok: false, status: err.status, message: err.message }, { status: 200 });
    }
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : "unknown error" },
      { status: 200 },
    );
  }
}
