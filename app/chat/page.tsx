import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { buildAuthOptions } from "@/lib/auth";
import { getConfig } from "@/lib/github";
import { canUseChat } from "@/lib/config";
import { isChatBackendConfigured } from "@/lib/chat";
import TopNav from "@/components/TopNav";
import ChatView from "@/components/Chat/ChatView";
import ConfigError from "@/components/ConfigError";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const session = await getServerSession(await buildAuthOptions());
  if (!session) redirect("/auth/signin");

  let config;
  try {
    config = await getConfig();
  } catch (err) {
    console.error("[projectpages] Failed to load config on chat page:", err);
    return <ConfigError />;
  }

  if (!canUseChat(session.userGroupName, config)) {
    // Chat is disabled for this config or user group — fall back to docs.
    redirect("/");
  }

  const backendConfigured = isChatBackendConfigured();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <TopNav siteTitle={config.site.title} chatEnabled={true} />
      <ChatView
        title={config.chat.title}
        welcome={config.chat.welcome}
        backendConfigured={backendConfigured}
        maxQueryChars={config.chat.security.maxQueryChars}
      />
    </div>
  );
}
