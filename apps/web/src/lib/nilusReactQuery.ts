import type {
  NilusCompleteTaskResult,
  NilusDomain,
  NilusListDomainEntriesResult,
  NilusTaskRecord,
  NilusTaskContext,
} from "@t3tools/contracts";
import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";

import { createEnvironmentApi } from "~/environmentApi";
import { getPrimaryEnvironmentConnection } from "~/environments/runtime";

const EMPTY_TASKS: readonly NilusTaskRecord[] = [];
const EMPTY_DOMAIN_ENTRIES: NilusListDomainEntriesResult = {
  domain: "talk",
  entries: [],
};
const EMPTY_TASK_CONTEXT = {
  task: {
    number: 1,
    status: "open",
    priority: "C",
    createdAt: "2026-04-08",
    completedAt: null,
    description: "Loading task context",
    project: null,
    owner: null,
    thread: null,
    recur: null,
    after: null,
    waiting: null,
    raw: "(C) 2026-04-08 Loading task context",
  },
  continuityThread: null,
  projects: [],
  relatedOpenTasks: [],
  recentDoneTasks: [],
  relatedDocuments: [],
  recentCommits: [],
} satisfies NilusTaskContext;
const STARTUP_STALE_TIME = 15_000;

function readNilusApi() {
  return createEnvironmentApi(getPrimaryEnvironmentConnection().client).nilus;
}

export const nilusQueryKeys = {
  all: ["nilus"] as const,
  startup: (repoRoot: string | null) => ["nilus", "startup", repoRoot] as const,
  tasks: (repoRoot: string | null, status: "open" | "done" | null) =>
    ["nilus", "tasks", repoRoot, status] as const,
  taskContext: (repoRoot: string | null, taskNumber: number | null) =>
    ["nilus", "taskContext", repoRoot, taskNumber] as const,
  domainEntries: (repoRoot: string | null, domain: NilusDomain | null) =>
    ["nilus", "domainEntries", repoRoot, domain] as const,
  document: (repoRoot: string | null, documentPath: string | null) =>
    ["nilus", "document", repoRoot, documentPath] as const,
  completionPreview: (repoRoot: string | null, taskNumber: number | null) =>
    ["nilus", "completionPreview", repoRoot, taskNumber] as const,
};

export const nilusMutationKeys = {
  completeTask: (repoRoot: string | null) =>
    ["nilus", "mutation", "completeTask", repoRoot] as const,
};

export function invalidateNilusQueries(queryClient: QueryClient, repoRoot: string | null) {
  if (repoRoot === null) {
    return queryClient.invalidateQueries({ queryKey: nilusQueryKeys.all });
  }

  return Promise.all([
    queryClient.invalidateQueries({ queryKey: nilusQueryKeys.startup(repoRoot) }),
    queryClient.invalidateQueries({ queryKey: nilusQueryKeys.tasks(repoRoot, "open") }),
    queryClient.invalidateQueries({ queryKey: nilusQueryKeys.tasks(repoRoot, "done") }),
    queryClient.invalidateQueries({ queryKey: ["nilus", "taskContext", repoRoot] }),
    queryClient.invalidateQueries({ queryKey: ["nilus", "completionPreview", repoRoot] }),
  ]);
}

export function nilusStartupSnapshotQueryOptions(input: {
  repoRoot: string | null;
  enabled?: boolean;
}) {
  return queryOptions({
    queryKey: nilusQueryKeys.startup(input.repoRoot),
    queryFn: async () => {
      const api = readNilusApi();
      if (!input.repoRoot) {
        throw new Error("Nilus repo is not selected.");
      }
      return api.getStartupSnapshot({
        repoRoot: input.repoRoot,
      });
    },
    enabled: (input.enabled ?? true) && input.repoRoot !== null,
    staleTime: STARTUP_STALE_TIME,
  });
}

export function nilusTasksQueryOptions(input: {
  repoRoot: string | null;
  status: "open" | "done" | null;
  enabled?: boolean;
  limit?: number;
}) {
  return queryOptions({
    queryKey: nilusQueryKeys.tasks(input.repoRoot, input.status),
    queryFn: async () => {
      const api = readNilusApi();
      if (!input.repoRoot) {
        throw new Error("Nilus repo is not selected.");
      }
      return api.listTasks({
        repoRoot: input.repoRoot,
        ...(input.status ? { status: input.status } : {}),
        ...(input.limit ? { limit: input.limit } : {}),
      });
    },
    enabled: (input.enabled ?? true) && input.repoRoot !== null,
    staleTime: STARTUP_STALE_TIME,
    placeholderData: (previous) => previous ?? EMPTY_TASKS,
  });
}

export function nilusDomainEntriesQueryOptions(input: {
  repoRoot: string | null;
  domain: NilusDomain | null;
  enabled?: boolean;
  limit?: number;
}) {
  return queryOptions({
    queryKey: nilusQueryKeys.domainEntries(input.repoRoot, input.domain),
    queryFn: async () => {
      const api = readNilusApi();
      if (!input.repoRoot || !input.domain) {
        throw new Error("Nilus domain browsing is unavailable.");
      }
      return api.listDomainEntries({
        repoRoot: input.repoRoot,
        domain: input.domain,
        ...(input.limit ? { limit: input.limit } : {}),
      });
    },
    enabled: (input.enabled ?? true) && input.repoRoot !== null && input.domain !== null,
    staleTime: STARTUP_STALE_TIME,
    placeholderData: (previous) =>
      previous ?? { ...EMPTY_DOMAIN_ENTRIES, domain: input.domain ?? "talk" },
  });
}

export function nilusTaskContextQueryOptions(input: {
  repoRoot: string | null;
  taskNumber: number | null;
  enabled?: boolean;
}) {
  return queryOptions({
    queryKey: nilusQueryKeys.taskContext(input.repoRoot, input.taskNumber),
    queryFn: async () => {
      const api = readNilusApi();
      if (!input.repoRoot || input.taskNumber === null) {
        throw new Error("Nilus task context is unavailable.");
      }
      return api.getTaskContext({
        repoRoot: input.repoRoot,
        taskNumber: input.taskNumber,
      });
    },
    enabled: (input.enabled ?? true) && input.repoRoot !== null && input.taskNumber !== null,
    staleTime: STARTUP_STALE_TIME,
    placeholderData: (previous) => previous ?? EMPTY_TASK_CONTEXT,
  });
}

export function nilusDocumentQueryOptions(input: {
  repoRoot: string | null;
  path: string | null;
  enabled?: boolean;
}) {
  return queryOptions({
    queryKey: nilusQueryKeys.document(input.repoRoot, input.path),
    queryFn: async () => {
      const api = readNilusApi();
      if (!input.repoRoot || !input.path) {
        throw new Error("Nilus document is not selected.");
      }
      return api.readDocument({
        repoRoot: input.repoRoot,
        path: input.path,
      });
    },
    enabled: (input.enabled ?? true) && input.repoRoot !== null && input.path !== null,
    staleTime: STARTUP_STALE_TIME,
  });
}

export function nilusTaskCompletionPreviewQueryOptions(input: {
  repoRoot: string | null;
  taskNumber: number | null;
  enabled?: boolean;
}) {
  return queryOptions({
    queryKey: nilusQueryKeys.completionPreview(input.repoRoot, input.taskNumber),
    queryFn: async () => {
      const api = readNilusApi();
      if (!input.repoRoot || input.taskNumber === null) {
        throw new Error("Nilus task completion preview is unavailable.");
      }
      return api.prepareTaskCompletion({
        repoRoot: input.repoRoot,
        taskNumber: input.taskNumber,
      });
    },
    enabled: (input.enabled ?? true) && input.repoRoot !== null && input.taskNumber !== null,
    staleTime: STARTUP_STALE_TIME,
  });
}

export function nilusCompleteTaskMutationOptions(input: {
  repoRoot: string | null;
  queryClient: QueryClient;
}) {
  return mutationOptions({
    mutationKey: nilusMutationKeys.completeTask(input.repoRoot),
    mutationFn: async ({ taskNumber }: { taskNumber: number }) => {
      const api = readNilusApi();
      if (!input.repoRoot) {
        throw new Error("Nilus task completion is unavailable.");
      }
      return api.completeTask({
        repoRoot: input.repoRoot,
        taskNumber,
      });
    },
    onSuccess: async (_result: NilusCompleteTaskResult) => {
      await invalidateNilusQueries(input.queryClient, input.repoRoot);
    },
  });
}
