import type { TreeEntry } from "./github";

/**
 * Turns a raw path segment ("returns_lifecycle.md" / "product-catalog" /
 * "ECOM_FRONTEND") into a human-readable label. Strips a trailing `.md`,
 * splits on `_`/`-`/`.`, then capitalises words that are entirely lowercase
 * so acronyms like `SAP`, `ECOM`, `FRONTEND` survive intact.
 */
export function prettyName(raw: string): string {
  const noExt = raw.replace(/\.(md|mdx)$/i, "");
  return noExt
    .split(/[_\-.]+/)
    .filter(Boolean)
    .map((w) => (/[A-Z]/.test(w) ? w : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

export interface NavFile {
  type: "file";
  name: string;
  path: string;
}

export interface NavFolder {
  type: "folder";
  name: string;
  path: string;
  children: NavNode[];
}

export type NavNode = NavFile | NavFolder;

/** Converts a flat list of file paths into a nested navigation tree. */
export function buildNavTree(entries: TreeEntry[]): NavNode[] {
  const root: NavFolder = { type: "folder", name: "", path: "", children: [] };

  for (const entry of entries) {
    const parts = entry.path.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join("/");

      if (isLast) {
        current.children.push({ type: "file", name: part, path: currentPath });
      } else {
        let folder = current.children.find(
          (c): c is NavFolder => c.type === "folder" && c.name === part
        );
        if (!folder) {
          folder = { type: "folder", name: part, path: currentPath, children: [] };
          current.children.push(folder);
        }
        current = folder;
      }
    }
  }

  // Sort: files first, then folders, both alphabetically
  return sortNodes(root.children);
}

function sortNodes(nodes: NavNode[]): NavNode[] {
  return nodes
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === "file" ? -1 : 1;
      return a.name.localeCompare(b.name);
    })
    .map((n) =>
      n.type === "folder" ? { ...n, children: sortNodes(n.children) } : n
    );
}
