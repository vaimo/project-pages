import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { buildAuthOptions } from "@/lib/auth";
import { getRawFileBuffer, getFilteredTree } from "@/lib/github";
import { verifyRawAssetToken } from "@/lib/rawAssetToken";
import mime from "mime";

const RAW_EXTENSIONS = new Set([
  // Images
  "png", "jpg", "jpeg", "gif", "webp", "svg", "ico", "bmp", "tiff",
  // Assets referenced by standalone HTML guides (rendered via iframe srcDoc)
  "css", "js", "mjs", "json", "woff", "woff2", "ttf", "otf", "mp4", "webm", "mp3",
]);

export async function GET(req: NextRequest) {
  const filePath = req.nextUrl.searchParams.get("path");
  if (!filePath) return NextResponse.json({ error: "path is required" }, { status: 400 });

  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  if (!RAW_EXTENSIONS.has(ext)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Sandboxed guide iframes (no allow-same-origin) have an opaque origin, so
  // the browser won't attach the session cookie to their subresource
  // requests. A signed token — issued server-side when the guide's HTML was
  // rendered, scoped to this exact path+branch — stands in for the session
  // in that case. Any other caller authenticates the normal way.
  const token = req.nextUrl.searchParams.get("token");
  const tokenBranch = req.nextUrl.searchParams.get("branch");
  let branch: string;
  if (token && tokenBranch && verifyRawAssetToken(token, filePath, tokenBranch)) {
    branch = tokenBranch;
  } else {
    const session = await getServerSession(await buildAuthOptions());
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    branch = session.branchName;
  }

  try {
    // Only serve files within this branch's configured include/exclude
    // filters — the same set the nav and archive download are scoped to.
    const { entries } = await getFilteredTree(branch);
    if (!entries.some((e) => e.path === filePath)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { buffer, name } = await getRawFileBuffer(filePath, branch);
    const contentType = mime.getType(name) ?? "application/octet-stream";

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Length": buffer.byteLength.toString(),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
