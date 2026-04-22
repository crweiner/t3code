import { describe, expect, it } from "vitest";
import { ProjectId, ThreadId } from "@t3tools/contracts";

import {
  findProjectForRepoRoot,
  resolveLatestNilusChatThread,
  resolveNilusPageFromPath,
  resolveProjectTitleFromRepoRoot,
  resolveTaskNumberFromPath,
} from "./-nilus.logic";
import type { Project, SidebarThreadSummary } from "../types";

describe("resolveNilusPageFromPath", () => {
  it("keeps the workspace-first pages distinct", () => {
    expect(resolveNilusPageFromPath("/nilus")).toBe("overview");
    expect(resolveNilusPageFromPath("/nilus/tasks")).toBe("tasks");
    expect(resolveNilusPageFromPath("/nilus/tasks/6")).toBe("taskDetail");
    expect(resolveNilusPageFromPath("/nilus/memory")).toBe("memory");
    expect(resolveNilusPageFromPath("/nilus/evidence")).toBe("evidence");
    expect(resolveNilusPageFromPath("/nilus/changes")).toBe("changes");
    expect(resolveNilusPageFromPath("/nilus/chat")).toBe("chat");
    expect(resolveNilusPageFromPath("/nilus/settings")).toBe("settings");
  });
});

describe("resolveTaskNumberFromPath", () => {
  it("extracts task numbers from the dedicated task detail route", () => {
    expect(resolveTaskNumberFromPath("/nilus/tasks/6")).toBe(6);
    expect(resolveTaskNumberFromPath("/nilus/tasks/42/")).toBe(42);
    expect(resolveTaskNumberFromPath("/nilus/tasks")).toBeNull();
    expect(resolveTaskNumberFromPath("/nilus/tasks/not-a-number")).toBeNull();
  });
});

describe("findProjectForRepoRoot", () => {
  it("matches projects by their workspace root", () => {
    const projects: Project[] = [
      {
        id: ProjectId.makeUnsafe("project-1"),
        name: "Nilus",
        cwd: "/repo/nilus",
        defaultModelSelection: null,
        scripts: [],
      },
    ];

    expect(findProjectForRepoRoot(projects, "/repo/nilus")?.id).toBe("project-1");
    expect(findProjectForRepoRoot(projects, "/repo/other")).toBeNull();
  });
});

describe("resolveProjectTitleFromRepoRoot", () => {
  it("uses the last path segment as the project title", () => {
    expect(resolveProjectTitleFromRepoRoot("/Users/chandler/Nilus")).toBe("Nilus");
  });
});

describe("resolveLatestNilusChatThread", () => {
  it("prefers the most recently active non-archived thread for the project", () => {
    const projectId = ProjectId.makeUnsafe("project-1");
    const olderThreadId = ThreadId.makeUnsafe("thread-1");
    const newerThreadId = ThreadId.makeUnsafe("thread-2");

    const makeThread = (
      id: SidebarThreadSummary["id"],
      latestUserMessageAt: string | null,
      archivedAt: string | null = null,
    ): SidebarThreadSummary => ({
      id,
      projectId,
      title: "Nilus chat",
      interactionMode: "default",
      session: null,
      createdAt: "2026-04-20T10:00:00.000Z",
      archivedAt,
      updatedAt: latestUserMessageAt ?? "2026-04-20T10:00:00.000Z",
      latestTurn: null,
      branch: null,
      worktreePath: null,
      latestUserMessageAt,
      hasPendingApprovals: false,
      hasPendingUserInput: false,
      hasActionableProposedPlan: false,
    });

    expect(
      resolveLatestNilusChatThread({
        projectId,
        threadIdsByProjectId: {
          [projectId]: [olderThreadId, newerThreadId],
        },
        sidebarThreadsById: {
          [olderThreadId]: makeThread(olderThreadId, "2026-04-20T10:05:00.000Z"),
          [newerThreadId]: makeThread(newerThreadId, "2026-04-20T10:10:00.000Z"),
        },
      })?.id,
    ).toBe(newerThreadId);
  });

  it("ignores archived threads", () => {
    const projectId = ProjectId.makeUnsafe("project-1");
    const archivedThreadId = ThreadId.makeUnsafe("thread-1");

    expect(
      resolveLatestNilusChatThread({
        projectId,
        threadIdsByProjectId: {
          [projectId]: [archivedThreadId],
        },
        sidebarThreadsById: {
          [archivedThreadId]: {
            id: archivedThreadId,
            projectId,
            title: "Archived Nilus chat",
            interactionMode: "default",
            session: null,
            createdAt: "2026-04-20T10:00:00.000Z",
            archivedAt: "2026-04-20T11:00:00.000Z",
            updatedAt: "2026-04-20T10:30:00.000Z",
            latestTurn: null,
            branch: null,
            worktreePath: null,
            latestUserMessageAt: "2026-04-20T10:30:00.000Z",
            hasPendingApprovals: false,
            hasPendingUserInput: false,
            hasActionableProposedPlan: false,
          },
        },
      }),
    ).toBeNull();
  });
});
