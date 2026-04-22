import type { NilusTaskRecord, ProjectId } from "@t3tools/contracts";

import type { Project, SidebarThreadSummary } from "../types";

export type NilusPage =
  | "overview"
  | "tasks"
  | "memory"
  | "evidence"
  | "changes"
  | "chat"
  | "settings";

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
  if (pathname.startsWith("/nilus/settings")) {
    return "settings";
  }
  return "overview";
}

export function buildNilusTaskChatStorageKey(repoRoot: string, taskNumber: number): string {
  return `${repoRoot}::${taskNumber}`;
}

export function buildNilusTaskThreadTitle(
  task: Pick<NilusTaskRecord, "number" | "description">,
): string {
  const trimmedDescription = task.description.trim();
  const compactDescription =
    trimmedDescription.length > 68
      ? `${trimmedDescription.slice(0, 65).trimEnd()}...`
      : trimmedDescription;

  return `Task #${task.number}: ${compactDescription}`;
}

export function buildNilusTaskStartPrompt(
  task: Pick<
    NilusTaskRecord,
    "number" | "description" | "priority" | "project" | "owner" | "thread" | "after" | "waiting"
  >,
): string {
  const metadataLines = [
    task.priority ? `- priority: ${task.priority}` : null,
    task.project ? `- project: ${task.project}` : null,
    task.owner ? `- owner: ${task.owner}` : null,
    task.thread ? `- thread: ${task.thread}` : null,
    task.after ? `- after: ${task.after}` : null,
    task.waiting ? `- waiting: ${task.waiting}` : null,
  ].filter((line): line is string => line !== null);

  return [
    `Start working on Nilus task #${task.number}.`,
    "",
    "Task:",
    task.description,
    ...(metadataLines.length > 0 ? ["", "Metadata:", ...metadataLines] : []),
    "",
    "Inspect the current workspace state first, then implement the task in this repo.",
  ].join("\n");
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
