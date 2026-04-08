import type {
  NilusDomain,
  NilusListDomainEntriesResult,
  NilusTaskRecord,
} from "@t3tools/contracts";
import { queryOptions } from "@tanstack/react-query";

import { createEnvironmentApi } from "~/environmentApi";
import { getPrimaryEnvironmentConnection } from "~/environments/runtime";

const EMPTY_TASKS: readonly NilusTaskRecord[] = [];
const EMPTY_DOMAIN_ENTRIES: NilusListDomainEntriesResult = {
  domain: "talk",
  entries: [],
};
const STARTUP_STALE_TIME = 15_000;

function readNilusApi() {
  return createEnvironmentApi(getPrimaryEnvironmentConnection().client).nilus;
}

export const nilusQueryKeys = {
  all: ["nilus"] as const,
  startup: (repoRoot: string | null) => ["nilus", "startup", repoRoot] as const,
  tasks: (repoRoot: string | null, status: "open" | "done" | null) =>
    ["nilus", "tasks", repoRoot, status] as const,
  domainEntries: (repoRoot: string | null, domain: NilusDomain | null) =>
    ["nilus", "domainEntries", repoRoot, domain] as const,
  document: (repoRoot: string | null, documentPath: string | null) =>
    ["nilus", "document", repoRoot, documentPath] as const,
};

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
      return api.nilus.getStartupSnapshot({
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
      return api.nilus.listTasks({
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
      return api.nilus.listDomainEntries({
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
      return api.nilus.readDocument({
        repoRoot: input.repoRoot,
        path: input.path,
      });
    },
    enabled: (input.enabled ?? true) && input.repoRoot !== null && input.path !== null,
    staleTime: STARTUP_STALE_TIME,
  });
}
