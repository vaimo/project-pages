import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { buildAuthOptions } from "@/lib/auth";
import {
  getFilteredTree,
  getDocsRepoName,
  downloadBranchZipball,
} from "@/lib/github";
import JSZip from "jszip";

// Always run fresh per request (the branch comes from the session) and on the
// Node runtime, which JSZip + Buffer require.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(await buildAuthOptions());
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const branch = session.branchName;

  try {
    // The set of files this branch's audience is allowed to see (same files as
    // the nav). Filtering to this set keeps internal-only files — notably
    // projectpages.config, which holds every audience's passphrase — out of
    // the archive.
    const { entries } = await getFilteredTree(branch);
    const allowed = new Set(entries.map((e) => e.path));
    if (allowed.size === 0) {
      return NextResponse.json(
        { error: "Nothing to download on this branch" },
        { status: 404 },
      );
    }

    // One GitHub call for the whole branch, then filter in-memory.
    const raw = await downloadBranchZipball(branch);
    const source = await JSZip.loadAsync(raw);

    const out = new JSZip();
    await Promise.all(
      Object.values(source.files).map(async (entry) => {
        if (entry.dir) return;
        // GitHub wraps everything in a top-level "owner-repo-sha/" folder;
        // strip that first segment to get the repo-relative path.
        const rel = entry.name.slice(entry.name.indexOf("/") + 1);
        if (!allowed.has(rel)) return;
        out.file(rel, await entry.async("nodebuffer"));
      }),
    );

    const zipBuffer = await out.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
    });

    const safeBranch = branch.replace(/[^a-zA-Z0-9._-]+/g, "-");
    const zipName = `${getDocsRepoName()}-${safeBranch}.zip`;

    return new NextResponse(zipBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipName}"`,
        "Content-Length": zipBuffer.byteLength.toString(),
        // Small private cache so a quick re-click is instant, without serving
        // stale content across pushes (a push redeploys and busts this anyway).
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (err) {
    console.error("download/archive error:", err);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}
