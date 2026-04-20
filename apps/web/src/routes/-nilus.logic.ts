import type { ProjectId } from "@t3tools/contracts";

import type { Project, SidebarThreadSummary } from "../types";

export type NilusPage = "overview" | "tasks" | "memory" | "evidence" | "changes" | "chat";

export function resolveNilusPageFromPath(pathname: string): NilusPage {
  if (pathname.startsWith("/nilus/tasks")) {
    return "tasks";
  }
  if (pathname.startsWith("/nilus/memory")) {
    return "memory";
  }
  if (pathname.startsWith("/nilus/evidence")) {
    return "evidence";
  }
  if (pathname.startsWith("/nilus/changes")) {
    return "changes";
  }
  if (pathname.startsWith("/nilus/chat")) {
    return "chat";
  }
  return "overview";
}

export function findProjectForRepoRoot(
  projects: readonly Project[],
  repoRoot: string | null,
): Project | null {
  const normalizedRepoRoot = repoRoot?.trim() ?? "";
  if (normalizedRepoRoot.length === 0) {
    return null;
  }

  return projects.find((project) => project.cwd === normalizedRepoRoot) ?? null;
}

export function resolveProjectTitleFromRepoRoot(repoRoot: string): string {
  return repoRoot.split(/[/\\]/).findLast((segment) => segment.length > 0) ?? repoRoot;
}

export function resolveLatestNilusChatThread(input: {
  projectId: ProjectId;
  threadIdsByProjectId: Record<string, ReadonlyArray<SidebarThreadSummary["id"]>>;
  sidebarThreadsById: Record<string, SidebarThreadSummary>;
}): SidebarThreadSummary | null {
  const projectThreads = (input.threadIdsByProjectId[input.projectId] ?? [])
    .map((threadId) => input.sidebarThreadsById[threadId])
    .filter((thread): thread is SidebarThreadSummary => thread !== undefined)
    .filter((thread) => thread.archivedAt === null);

  if (projectThreads.length === 0) {
    return null;
  }

  return [...projectThreads].sort((left, right) => {
    const leftTimestamp = left.latestUserMessageAt ?? left.updatedAt ?? left.createdAt;
    const rightTimestamp = right.latestUserMessageAt ?? right.updatedAt ?? right.createdAt;
    return rightTimestamp.localeCompare(leftTimestamp);
  })[0]!;
}
