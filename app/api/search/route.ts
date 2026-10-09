import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { buildAuthOptions } from "@/lib/auth";
import { getSearchIndex, searchDocs } from "@/lib/search";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await getServerSession(await buildAuthOptions());
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (!q.trim()) return NextResponse.json({ results: [] });

  try {
    const docs = await getSearchIndex(session.branchName);
    const results = searchDocs(docs, q);
    return NextResponse.json({ results });
  } catch (err) {
    console.error("search error:", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
