import * as NFS from "node:fs";
import * as path from "node:path";

import { Effect } from "effect";
import type {
  NilusDocument,
  NilusDomain,
  NilusDomainEntry,
  NilusListDomainEntriesInput,
  NilusListDomainEntriesResult,
  NilusListTasksInput,
  NilusTaskRecord,
  NilusStartupSnapshot,
  NilusStartupSnapshotInput,
} from "@t3tools/contracts";
import { NilusReadError } from "@t3tools/contracts";

const DOMAIN_DIRECTORIES: Record<NilusDomain, readonly string[]> = {
  talk: ["talk-log"],
  partners: ["partners"],
  issues: ["issues"],
  knowledge: ["knowledge", "workflows", "docs", "notes"],
};

const TASK_OPEN_PATTERN = /^\(([A-Z])\)\s(\d{4}-\d{2}-\d{2})\s(.+)$/;
const TASK_DONE_PATTERN = /^x\s(\d{4}-\d{2}-\d{2})\s(\d{4}-\d{2}-\d{2})\s(.+)$/;

export const getNilusStartupSnapshot = (input: NilusStartupSnapshotInput) =>
  Effect.gen(function* () {
    const repoRoot = yield* assertNilusRepo(input.repoRoot);
    const openTasks = yield* readTasks({
      repoRoot,
      status: "open",
    });
    const doneTasks = yield* readTasks({
      repoRoot,
      status: "done",
    });
    const domainCounts = {
      talk: (yield* listDomainEntries({ repoRoot, domain: "talk" })).entries.length,
      partners: (yield* listDomainEntries({ repoRoot, domain: "partners" })).entries.length,
      issues: (yield* listDomainEntries({ repoRoot, domain: "issues" })).entries.length,
      knowledge: (yield* listDomainEntries({ repoRoot, domain: "knowledge" })).entries.length,
    } satisfies NilusStartupSnapshot["domainCounts"];

    return {
      repoRoot,
      repoName: path.basename(repoRoot),
      branch: readGitBranch(repoRoot),
      openTaskCount: openTasks.length,
      doneTaskCount: doneTasks.length,
      domainCounts,
      topTasks: openTasks.slice(0, 8),
    } satisfies NilusStartupSnapshot;
  });

export const listNilusTasks = (input: NilusListTasksInput) =>
  Effect.gen(function* () {
    const repoRoot = yield* assertNilusRepo(input.repoRoot);
    const tasks = yield* readTasks({
      repoRoot,
      status: input.status ?? null,
    });
    return input.limit ? tasks.slice(0, input.limit) : tasks;
  });

export const listNilusDomainEntries = (input: NilusListDomainEntriesInput) =>
  Effect.gen(function* () {
    const repoRoot = yield* assertNilusRepo(input.repoRoot);
    const result = yield* listDomainEntries({
      repoRoot,
      domain: input.domain,
    });
    return {
      domain: input.domain,
      entries: input.limit ? result.entries.slice(0, input.limit) : result.entries,
    } satisfies NilusListDomainEntriesResult;
  });

export const readNilusDocument = (input: { repoRoot: string; path: string }) =>
  Effect.gen(function* () {
    const repoRoot = yield* assertNilusRepo(input.repoRoot);
    const absolutePath = yield* resolveRepoRelativePath(repoRoot, input.path);
    const domain = classifyDomain(input.path);
    if (domain === null) {
      return yield* Effect.fail(
        new NilusReadError({
          message: "Document path must stay within the Nilus read-only prototype domains.",
        }),
      );
    }
    const contents = yield* readTextFile(absolutePath);
    return {
      domain,
      path: input.path,
      title: deriveDocumentTitle(input.path, contents),
      updatedAt: readFileUpdatedAt(absolutePath),
      contents,
    } satisfies NilusDocument;
  });

const listDomainEntries = (input: { repoRoot: string; domain: NilusDomain }) =>
  Effect.gen(function* () {
    const repoRoot = yield* assertNilusRepo(input.repoRoot);
    const entries = DOMAIN_DIRECTORIES[input.domain].flatMap((directory) =>
      collectMarkdownEntries(path.join(repoRoot, directory)),
    );
    const mapped = yield* Effect.forEach(entries, (absolutePath) =>
      Effect.gen(function* () {
        const relativePath = path.relative(repoRoot, absolutePath);
        const contents = yield* readTextFile(absolutePath);
        return {
          path: relativePath,
          title: deriveDocumentTitle(relativePath, contents),
          updatedAt: readFileUpdatedAt(absolutePath),
          preview: derivePreview(contents),
        } satisfies NilusDomainEntry;
      }),
    );

    return {
      domain: input.domain,
      entries: mapped.toSorted((left, right) => {
        const leftTime = left.updatedAt ? Date.parse(left.updatedAt) : 0;
        const rightTime = right.updatedAt ? Date.parse(right.updatedAt) : 0;
        return rightTime - leftTime;
      }),
    } satisfies NilusListDomainEntriesResult;
  });

const readTasks = (input: { repoRoot: string; status: NilusTaskRecord["status"] | null }) =>
  Effect.gen(function* () {
    const todoLines = yield* readLines(path.join(input.repoRoot, "todo.txt"));
    const doneLines = yield* readLines(path.join(input.repoRoot, "done.txt"));

    const openTasks = parseTaskLines(todoLines, "open");
    const doneTasks = parseTaskLines(doneLines, "done");
    const combined =
      input.status === "open"
        ? openTasks
        : input.status === "done"
          ? doneTasks
          : [...openTasks, ...doneTasks];
    return combined;
  });

const assertNilusRepo = (repoRoot: string) =>
  Effect.gen(function* () {
    const resolved = path.resolve(repoRoot);
    const requiredPaths = ["todo.txt", "done.txt", "talk-log", "workflows"];
    for (const requiredPath of requiredPaths) {
      const exists = NFS.existsSync(path.join(resolved, requiredPath));
      if (!exists) {
        return yield* Effect.fail(
          new NilusReadError({
            message: `Selected folder is not a Nilus repo. Missing ${requiredPath}.`,
          }),
        );
      }
    }
    return resolved;
  });

const resolveRepoRelativePath = (repoRoot: string, relativePath: string) =>
  Effect.gen(function* () {
    const resolved = path.resolve(repoRoot, relativePath);
    const normalizedRoot = `${repoRoot}${path.sep}`;
    if (resolved !== repoRoot && !resolved.startsWith(normalizedRoot)) {
      return yield* Effect.fail(
        new NilusReadError({
          message: "Requested document path must stay within the selected Nilus repo.",
        }),
      );
    }
    return resolved;
  });

const readTextFile = (filePath: string) =>
  Effect.try({
    try: () => NFS.readFileSync(filePath, "utf8"),
    catch: (cause) =>
      new NilusReadError({
        message: `Failed to read ${path.basename(filePath)}.`,
        cause,
      }),
  });

const readLines = (filePath: string) =>
  readTextFile(filePath).pipe(
    Effect.map((contents) =>
      contents
        .split(/\r?\n/)
        .map((line) => line.trimEnd())
        .filter((line) => line.length > 0 && !line.startsWith("#")),
    ),
  );

function parseTaskLines(
  lines: readonly string[],
  status: NilusTaskRecord["status"],
): NilusTaskRecord[] {
  let counter = 0;
  const parsed: NilusTaskRecord[] = [];

  for (const line of lines) {
    const match = status === "open" ? TASK_OPEN_PATTERN.exec(line) : TASK_DONE_PATTERN.exec(line);
    if (!match) {
      continue;
    }

    counter += 1;
    const parsedRemainder = parseTaskRemainder(match[3]);
    const createdAt = match[2];
    const completedAt = status === "done" ? match[1] : null;

    parsed.push({
      number: counter,
      status,
      priority: status === "open" ? match[1] : undefined,
      createdAt,
      completedAt,
      description: parsedRemainder.description,
      project: parsedRemainder.project,
      owner: parsedRemainder.owner,
      thread: parsedRemainder.thread,
      recur: parsedRemainder.recur,
      after: parsedRemainder.after,
      waiting: parsedRemainder.waiting,
      raw: line,
    });
  }

  return parsed;
}

function parseTaskRemainder(input: string) {
  const descriptionParts: string[] = [];
  let project: string | null = null;
  let owner: string | null = null;
  let thread: string | null = null;
  let recur: string | null = null;
  let after: string | null = null;
  let waiting: string | null = null;

  for (const token of input.split(/\s+/)) {
    if (token.startsWith("+")) {
      project = token.slice(1) || null;
      continue;
    }
    if (token.startsWith("@")) {
      owner = token.slice(1) || null;
      continue;
    }
    if (token.startsWith("thread:")) {
      thread = token.slice("thread:".length) || null;
      continue;
    }
    if (token.startsWith("recur:")) {
      recur = token.slice("recur:".length) || null;
      continue;
    }
    if (token.startsWith("after:")) {
      after = token.slice("after:".length) || null;
      continue;
    }
    if (token.startsWith("waiting:")) {
      waiting = token.slice("waiting:".length) || null;
      continue;
    }
    descriptionParts.push(token);
  }

  return {
    description: descriptionParts.join(" ").trim(),
    project,
    owner,
    thread,
    recur,
    after,
    waiting,
  };
}

function collectMarkdownEntries(directoryPath: string): string[] {
  if (!NFS.existsSync(directoryPath)) {
    return [];
  }

  const entries = NFS.readdirSync(directoryPath, {
    withFileTypes: true,
  });

  return entries.flatMap((entry) => {
    const absolutePath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      return collectMarkdownEntries(absolutePath);
    }
    if (!entry.isFile() || !entry.name.endsWith(".md") || entry.name === "README.md") {
      return [];
    }
    return [absolutePath];
  });
}

function deriveDocumentTitle(relativePath: string, contents: string): string {
  const frontmatterTopic = readFrontmatterValue(contents, "topic");
  if (frontmatterTopic) {
    return frontmatterTopic;
  }

  const firstHeading = contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith("# "));
  if (firstHeading) {
    return firstHeading.replace(/^#\s+/, "").trim();
  }

  const firstContentLine = contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0 && line !== "---");

  return firstContentLine ?? path.basename(relativePath, ".md");
}

function derivePreview(contents: string): string | null {
  const previewLine = contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0 && line !== "---" && !line.startsWith("#"));
  return previewLine ?? null;
}

function readFrontmatterValue(contents: string, key: string): string | null {
  if (!contents.startsWith("---")) {
    return null;
  }

  const lines = contents.split(/\r?\n/);
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === "---") {
      return null;
    }
    const prefix = `${key}:`;
    if (line.startsWith(prefix)) {
      const value = line.slice(prefix.length).trim();
      return value.length > 0 ? value : null;
    }
  }

  return null;
}

function readFileUpdatedAt(filePath: string): string | null {
  try {
    return NFS.statSync(filePath).mtime.toISOString();
  } catch {
    return null;
  }
}

function readGitBranch(repoRoot: string): string | null {
  try {
    const headPath = path.join(repoRoot, ".git", "HEAD");
    const head = NFS.readFileSync(headPath, "utf8").trim();
    const prefix = "ref: refs/heads/";
    if (head.startsWith(prefix)) {
      return head.slice(prefix.length);
    }
    return head.length > 0 ? head : null;
  } catch {
    return null;
  }
}

function classifyDomain(relativePath: string): NilusDomain | null {
  const normalized = relativePath.replaceAll("\\", "/");
  if (normalized.startsWith("talk-log/")) return "talk";
  if (normalized.startsWith("partners/")) return "partners";
  if (normalized.startsWith("issues/")) return "issues";
  if (
    normalized.startsWith("knowledge/") ||
    normalized.startsWith("workflows/") ||
    normalized.startsWith("docs/") ||
    normalized.startsWith("notes/")
  ) {
    return "knowledge";
  }
  return null;
}
