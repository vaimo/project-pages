import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { buildAuthOptions } from "@/lib/auth";
import { getConfig } from "@/lib/github";
import { canUseChat, getBranchChatBackendUrl } from "@/lib/config";
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

  if (!canUseChat(session.userGroupName, config, session.branchName)) {
    // Chat is disabled for this config / user group / branch — fall back to docs.
    redirect("/");
  }

  // canUseChat guarantees this is non-null when it returns true.
  const backendConfigured = getBranchChatBackendUrl(session.branchName, config) !== null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <TopNav siteTitle={config.site.title} chatEnabled={true} />
      {/* key={branchName} forces ChatView to remount when the user switches
          branch via the branch switcher, so localStorage is re-hydrated from
          the new branch's history. */}
      <ChatView
        key={session.branchName}
        branchName={session.branchName}
        title={config.chat.title}
        welcome={config.chat.welcome}
        backendConfigured={backendConfigured}
        maxQueryChars={config.chat.security.maxQueryChars}
      />
    </div>
  );
}
