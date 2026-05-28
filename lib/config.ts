import yaml from "js-yaml";
import micromatch from "micromatch";

export interface UserGroupConfig {
  name: string;
  passphrase: string;
}

export interface BranchChatConfig {
  /**
   * Backend URL for the LightRAG-compatible chat service indexed over this
   * branch's content. The Chat tab is visible only on branches that declare
   * this field.
   */
  backendUrl?: string;
}

export interface VaimoBranchConfig {
  name: string;
  userGroups: string[];
  comments?: {
    enabled?: boolean;
  };
  chat?: BranchChatConfig;
}

export interface ChatSecurityConfig {
  maxQueryChars?: number;
  maxHistoryTurns?: number;
  rateLimit?: {
    perMinute?: number;
    perHour?: number;
  };
}

export interface ChatConfig {
  enabled?: boolean;
  title?: string;
  welcome?: string;
  userGroups?: string[];
  security?: ChatSecurityConfig;
}

export interface VaimoConfig {
  site: {
    title: string;
    description?: string;
  };
  auth?: {
    sessionDurationDays?: number;
  };
  userGroups: UserGroupConfig[];
  branches: VaimoBranchConfig[];
  features?: {
    images?: boolean;
  };
  chat?: ChatConfig;
  include: string[];
  exclude?: string[];
}

export interface ParsedUserGroup {
  name: string;
  passphrase: string;
}

export interface ParsedBranch {
  name: string;
  userGroups: string[];
  comments: { enabled: boolean };
  chat: { backendUrl: string | null };
}

export interface ParsedChatSecurity {
  maxQueryChars: number;
  maxHistoryTurns: number;
  rateLimit: {
    perMinute: number;
    perHour: number;
  };
}

export interface ParsedChat {
  enabled: boolean;
  title: string;
  welcome: string;
  userGroups: string[] | null;
  security: ParsedChatSecurity;
}

export interface ParsedConfig {
  site: { title: string; description: string };
  auth: { sessionDurationDays: number };
  userGroups: ParsedUserGroup[];
  branches: ParsedBranch[];
  features: { images: boolean };
  chat: ParsedChat;
  include: string[];
  exclude: string[];
}

const DEFAULT_SESSION_DAYS = 7;

const DEFAULT_CHAT_SECURITY: ParsedChatSecurity = {
  maxQueryChars: 4000,
  maxHistoryTurns: 10,
  rateLimit: {
    perMinute: 30,
    perHour: 300,
  },
};

function positiveInt(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function normaliseBackendUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\/+$/, "");
  return trimmed.length > 0 ? trimmed : null;
}

export function parseConfig(raw: string): ParsedConfig {
  const parsed = yaml.load(raw) as VaimoConfig;

  if (!parsed?.site?.title) throw new Error("projectpages.config: site.title is required");
  if (!parsed?.include?.length) throw new Error("projectpages.config: include list must not be empty");
  if (!parsed?.userGroups?.length) throw new Error("projectpages.config: userGroups list must not be empty");
  if (!parsed?.branches?.length) throw new Error("projectpages.config: branches list must not be empty");

  return {
    site: {
      title: parsed.site.title,
      description: parsed.site.description ?? "",
    },
    auth: {
      sessionDurationDays: parsed.auth?.sessionDurationDays ?? DEFAULT_SESSION_DAYS,
    },
    userGroups: parsed.userGroups.map((g) => ({
      name: g.name,
      passphrase: g.passphrase,
    })),
    branches: parsed.branches.map((b) => ({
      name: b.name,
      userGroups: b.userGroups ?? [],
      comments: {
        enabled: b.comments?.enabled ?? false,
      },
      chat: {
        backendUrl: normaliseBackendUrl(b.chat?.backendUrl),
      },
    })),
    features: {
      images: parsed.features?.images !== false,
    },
    chat: {
      enabled: parsed.chat?.enabled === true,
      title: parsed.chat?.title ?? "Chat with the documentation",
      welcome:
        parsed.chat?.welcome ??
        "Ask a question about the documentation. The assistant searches the knowledge base and replies with sources.",
      userGroups:
        Array.isArray(parsed.chat?.userGroups) && parsed.chat.userGroups.length > 0
          ? parsed.chat.userGroups
          : null,
      security: {
        maxQueryChars: positiveInt(
          parsed.chat?.security?.maxQueryChars,
          DEFAULT_CHAT_SECURITY.maxQueryChars,
        ),
        maxHistoryTurns: positiveInt(
          parsed.chat?.security?.maxHistoryTurns,
          DEFAULT_CHAT_SECURITY.maxHistoryTurns,
        ),
        rateLimit: {
          perMinute: positiveInt(
            parsed.chat?.security?.rateLimit?.perMinute,
            DEFAULT_CHAT_SECURITY.rateLimit.perMinute,
          ),
          perHour: positiveInt(
            parsed.chat?.security?.rateLimit?.perHour,
            DEFAULT_CHAT_SECURITY.rateLimit.perHour,
          ),
        },
      },
    },
    include: parsed.include,
    exclude: parsed.exclude ?? [],
  };
}

/**
 * Returns the chat backend URL configured for a given branch, or null if the
 * branch doesn't have one set (chat tab should be hidden on that branch).
 */
export function getBranchChatBackendUrl(
  branchName: string,
  config: ParsedConfig,
): string | null {
  const branch = config.branches.find((b) => b.name === branchName);
  return branch?.chat.backendUrl ?? null;
}

/**
 * Whether a given user group + branch combination is allowed to use the chat.
 * True only when chat is enabled globally, the user group is allowed, AND the
 * specific branch has a chat backend URL configured.
 */
export function canUseChat(
  userGroupName: string,
  config: ParsedConfig,
  branchName: string,
): boolean {
  if (!config.chat.enabled) return false;
  if (config.chat.userGroups !== null && !config.chat.userGroups.includes(userGroupName)) {
    return false;
  }
  return getBranchChatBackendUrl(branchName, config) !== null;
}

/** Returns the names of all branches accessible to the given user group, in config order. */
export function getAccessibleBranches(userGroupName: string, config: ParsedConfig): string[] {
  return config.branches
    .filter((b) => b.userGroups.includes(userGroupName))
    .map((b) => b.name);
}

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg"]);
const SUBTITLE_EXTENSIONS = new Set(["vtt", "srt"]);

export { IMAGE_EXTENSIONS, SUBTITLE_EXTENSIONS };

/**
 * Given a list of all file paths in the repo, returns only those
 * that match the include patterns and do not match any exclude pattern.
 * When features.images is enabled, image files are automatically included.
 */
export function filterPaths(allPaths: string[], config: ParsedConfig): string[] {
  const included = new Set(micromatch(allPaths, config.include));

  if (config.features.images) {
    allPaths.forEach((p) => {
      const ext = p.split(".").pop()?.toLowerCase() ?? "";
      if (IMAGE_EXTENSIONS.has(ext)) included.add(p);
    });
  }

  // Always include subtitle files (.vtt, .srt) so they appear in the nav
  allPaths.forEach((p) => {
    const ext = p.split(".").pop()?.toLowerCase() ?? "";
    if (SUBTITLE_EXTENSIONS.has(ext)) included.add(p);
  });

  const includedArr = Array.from(included);
  if (!config.exclude.length) return includedArr;
  return micromatch.not(includedArr, config.exclude);
}
