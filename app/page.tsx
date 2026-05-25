import { getServerSession } from "next-auth";
import { buildAuthOptions } from "@/lib/auth";
import { getFilteredTree, getFileContent } from "@/lib/github";
import { buildNavTree } from "@/lib/nav";
import { renderMarkdown } from "@/lib/markdown";
import { canUseChat } from "@/lib/config";
import TopNav from "@/components/TopNav";
import Sidebar from "@/components/Sidebar";
import MarkdownView from "@/components/FileView/MarkdownView";
import CommentPanel from "@/components/Comments/CommentPanel";
import ConfigError from "@/components/ConfigError";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await getServerSession(await buildAuthOptions());
  if (!session) redirect("/auth/signin");

  let filteredTree: Awaited<ReturnType<typeof getFilteredTree>>;
  try {
    filteredTree = await getFilteredTree(session.branchName);
  } catch (err) {
    console.error("[projectpages] Failed to load file tree on home page:", err);
    return <ConfigError />;
  }
  const { entries, config } = filteredTree;
  const nav = buildNavTree(entries);

  // Look for a root-level README (case-insensitive, md or mdx)
  const readmeEntry = entries.find((e) => /^readme\.(md|mdx)$/i.test(e.path));

  const branchConfig = config.branches.find((b) => b.name === session.branchName);
  const commentsEnabled = branchConfig?.comments.enabled ?? false;

  let mainContent: React.ReactNode;

  if (readmeEntry) {
    const file = await getFileContent(readmeEntry.path, session.branchName);
    const raw = Buffer.from(file.content, "base64").toString("utf-8");
    const html = await renderMarkdown(raw, readmeEntry.path);
    mainContent = <MarkdownView html={html} filePath={readmeEntry.path} commentsEnabled={commentsEnabled} />;
  } else {
    mainContent = (
      <p style={{ color: "var(--color-grey-400)", fontSize: "0.9375rem" }}>
        Select a file from the left navigation to get started.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <TopNav siteTitle={config.site.title} chatEnabled={canUseChat(session.userGroupName, config)} />
      <div style={{ display: "flex", flex: 1 }}>
        <Sidebar tree={nav} isOpen={true} activePath={readmeEntry?.path} />

        <main
          style={{
            flex: 1,
            padding: "1.5rem 2rem",
            overflowY: "auto",
            minWidth: 0,
            ...(readmeEntry ? {} : {
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }),
          }}
        >
          {mainContent}
        </main>

        {readmeEntry && commentsEnabled && (
          <CommentPanel filePath={readmeEntry.path} />
        )}
      </div>
    </div>
  );
}
