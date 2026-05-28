import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { buildAuthOptions } from "@/lib/auth";
import { getConfig } from "@/lib/github";
import { getBranchChatBackendUrl } from "@/lib/config";
import { checkChatBackendHealth } from "@/lib/chat";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(await buildAuthOptions());
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let config;
  try {
    config = await getConfig();
  } catch (err) {
    console.error("[chat/health] Failed to load config:", err);
    return NextResponse.json(
      { ok: false, enabled: false, error: "Configuration error" },
      { status: 500 },
    );
  }

  if (!config.chat.enabled) {
    return NextResponse.json({ ok: false, enabled: false, reason: "disabled" });
  }

  const userGroups = config.chat.userGroups;
  if (userGroups !== null && !userGroups.includes(session.userGroupName)) {
    return NextResponse.json({ ok: false, enabled: true, reason: "forbidden" });
  }

  const backendUrl = getBranchChatBackendUrl(session.branchName, config);
  if (!backendUrl) {
    return NextResponse.json({
      ok: false,
      enabled: true,
      reason: "backend-missing",
      error: `No chat backend URL is set for branch "${session.branchName}"`,
    });
  }

  const health = await checkChatBackendHealth(backendUrl);
  return NextResponse.json({
    ok: health.ok,
    enabled: true,
    reason: health.ok ? "ready" : "backend-down",
    error: health.error,
  });
}
