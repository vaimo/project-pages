import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { buildAuthOptions } from "@/lib/auth";
import { getConfig } from "@/lib/github";
import { canUseChat } from "@/lib/config";
import { checkChatBackendHealth, isChatBackendConfigured } from "@/lib/chat";

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

  const enabledInConfig = config.chat.enabled;
  const allowedForUser = canUseChat(session.userGroupName, config);
  const backendConfigured = isChatBackendConfigured();

  if (!enabledInConfig) {
    return NextResponse.json({ ok: false, enabled: false, reason: "disabled" });
  }
  if (!allowedForUser) {
    return NextResponse.json({ ok: false, enabled: true, reason: "forbidden" });
  }
  if (!backendConfigured) {
    return NextResponse.json({
      ok: false,
      enabled: true,
      reason: "backend-missing",
      error: "Chat backend URL is not configured on this deployment",
    });
  }

  const health = await checkChatBackendHealth();
  return NextResponse.json({
    ok: health.ok,
    enabled: true,
    reason: health.ok ? "ready" : "backend-down",
    error: health.error,
  });
}
