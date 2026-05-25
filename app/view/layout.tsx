import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { buildAuthOptions } from "@/lib/auth";
import { getFilteredTree } from "@/lib/github";
import { buildNavTree } from "@/lib/nav";
import TopNav from "@/components/TopNav";
import Sidebar from "@/components/Sidebar";
import ConfigError from "@/components/ConfigError";
import { canUseChat } from "@/lib/config";

export default async function ViewLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(await buildAuthOptions());
  if (!session) redirect("/auth/signin");

  let filteredTree: Awaited<ReturnType<typeof getFilteredTree>>;
  try {
    filteredTree = await getFilteredTree(session.branchName);
  } catch (err) {
    console.error("[projectpages] Failed to load file tree in view layout:", err);
    return <ConfigError />;
  }
  const { entries, config } = filteredTree;
  const nav = buildNavTree(entries);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <TopNav siteTitle={config.site.title} chatEnabled={canUseChat(session.userGroupName, config)} />
      <div style={{ display: "flex", flex: 1 }}>
        <Sidebar tree={nav} isOpen={true} />
        {children}
      </div>
    </div>
  );
}
