import { execFileSync } from "node:child_process";
import * as NFS from "node:fs";
import * as path from "node:path";

import { Effect } from "effect";
import type {
  NilusCommitSafety,
  NilusCreateTalkNoteResult,
  NilusCompleteTaskResult,
  NilusDocument,
  NilusDomain,
  NilusDomainEntry,
  NilusTalkNoteDraftInput,
  NilusTalkNotePreview,
  NilusListDomainEntriesInput,
  NilusListDomainEntriesResult,
  NilusListTasksInput,
  NilusPrepareTaskCompletionInput,
  NilusTaskCompletionPreview,
  NilusTaskContext,
  NilusTaskContextCommit,
  NilusTaskContextDocument,
  NilusTaskContextInput,
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

export const getNilusTaskContext = (input: NilusTaskContextInput) =>
  Effect.gen(function* () {
    const repoRoot = yield* assertNilusRepo(input.repoRoot);
    const selection = yield* selectOpenTask(repoRoot, input.taskNumber);
    const openTasks = yield* readTasks({
      repoRoot,
      status: "open",
    });
    const doneTasks = yield* readTasks({
      repoRoot,
      status: "done",
    });
    const projects = selection.task.project ? [`+${selection.task.project}`] : [];
    const continuityThread = deriveContinuityThread(selection.task);
    const relatedDocuments = yield* findRelatedDocuments(repoRoot, continuityThread, projects);

    return {
      task: selection.task,
      continuityThread,
      projects,
      relatedOpenTasks: openTasks.filter((task) =>
        taskMatchesContext(task, continuityThread, projects),
      ),
      recentDoneTasks: doneTasks
        .filter((task) => taskMatchesContext(task, continuityThread, projects))
        .slice(-5),
      relatedDocuments: relatedDocuments.slice(0, 12),
      recentCommits: readRecentCommits(
        repoRoot,
        relatedDocuments.map((entry) => entry.path),
      ),
    } satisfies NilusTaskContext;
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
      return yield* new NilusReadError({
        message: "Document path must stay within the Nilus read-only prototype domains.",
      });
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

export const prepareNilusTaskCompletion = (input: NilusPrepareTaskCompletionInput) =>
  Effect.gen(function* () {
    const repoRoot = yield* assertNilusRepo(input.repoRoot);
    const selection = yield* selectOpenTask(repoRoot, input.taskNumber);
    return buildTaskCompletionPreview(selection) satisfies NilusTaskCompletionPreview;
  });

export const completeNilusTask = (input: { repoRoot: string; taskNumber: number }) =>
  Effect.gen(function* () {
    const repoRoot = yield* assertNilusRepo(input.repoRoot);
    const selection = yield* selectOpenTask(repoRoot, input.taskNumber);
    const preview = buildTaskCompletionPreview(selection);

    const todoPath = path.join(repoRoot, "todo.txt");
    const donePath = path.join(repoRoot, "done.txt");
    const todoLines = yield* readWritableLines(todoPath);
    const doneLines = yield* readWritableLines(donePath);

    todoLines.splice(selection.lineNumber - 1, 1);
    if (preview.nextTaskLine) {
      todoLines.push(preview.nextTaskLine);
    }
    doneLines.push(preview.completedLine);

    yield* writeLines(todoPath, todoLines);
    yield* writeLines(donePath, doneLines);

    return {
      completedLine: preview.completedLine,
      nextTaskLine: preview.nextTaskLine,
      affectedFiles: preview.affectedFiles,
    } satisfies NilusCompleteTaskResult;
  });

export const prepareNilusTalkNote = (input: NilusTalkNoteDraftInput) =>
  Effect.gen(function* () {
    const repoRoot = yield* assertNilusRepo(input.repoRoot);
    return yield* buildTalkNotePreview(repoRoot, input);
  });

export const createNilusTalkNote = (input: NilusTalkNoteDraftInput) =>
  Effect.gen(function* () {
    const repoRoot = yield* assertNilusRepo(input.repoRoot);
    const preview = yield* buildTalkNotePreview(repoRoot, input);
    const absolutePath = path.join(repoRoot, preview.path);

    if (NFS.existsSync(absolutePath)) {
      return yield* new NilusReadError({
        message: `Talk note path ${preview.path} already exists. Refresh the draft and try again.`,
      });
    }

    yield* writeTextFile(absolutePath, preview.contents);

    return {
      path: preview.path,
      title: preview.title,
      contents: preview.contents,
      affectedFiles: preview.affectedFiles,
      warnings: preview.warnings,
      commitSafety: preview.commitSafety,
    } satisfies NilusCreateTalkNoteResult;
  });

interface OpenTaskSelection {
  readonly lineNumber: number;
  readonly line: string;
  readonly priority: string;
  readonly payload: string;
  readonly task: NilusTaskRecord;
}

const buildTalkNotePreview = (repoRoot: string, input: NilusTalkNoteDraftInput) =>
  Effect.gen(function* () {
    const normalized = normalizeTalkNoteInput(input);
    const talkFilePath = buildTalkNotePath(repoRoot, normalized.draftId);
    const warnings = yield* validateTalkNoteRefs(repoRoot, normalized.refs);
    const contents = renderTalkNoteContents(normalized);

    return {
      path: talkFilePath,
      title: normalized.topic,
      contents,
      affectedFiles: [talkFilePath],
      warnings,
      commitSafety: "safe_direct",
    } satisfies NilusTalkNotePreview;
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
        return yield* new NilusReadError({
          message: `Selected folder is not a Nilus repo. Missing ${requiredPath}.`,
        });
      }
    }
    return resolved;
  });

const resolveRepoRelativePath = (repoRoot: string, relativePath: string) =>
  Effect.gen(function* () {
    const resolved = path.resolve(repoRoot, relativePath);
    const normalizedRoot = `${repoRoot}${path.sep}`;
    if (resolved !== repoRoot && !resolved.startsWith(normalizedRoot)) {
      return yield* new NilusReadError({
        message: "Requested document path must stay within the selected Nilus repo.",
      });
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
    const primary = match[1] ?? "";
    const createdAt = match[2] ?? "";
    const remainder = match[3] ?? "";
    const parsedRemainder = parseTaskRemainder(remainder);
    const baseTask = {
      number: counter,
      status,
      createdAt,
      completedAt: status === "done" ? primary : null,
      description: parsedRemainder.description,
      project: parsedRemainder.project,
      owner: parsedRemainder.owner,
      thread: parsedRemainder.thread,
      recur: parsedRemainder.recur,
      after: parsedRemainder.after,
      waiting: parsedRemainder.waiting,
      raw: line,
    } satisfies Omit<NilusTaskRecord, "priority">;

    parsed.push(
      status === "open"
        ? {
            ...baseTask,
            priority: primary,
          }
        : baseTask,
    );
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

const selectOpenTask = (repoRoot: string, taskNumber: number) =>
  Effect.gen(function* () {
    const todoLines = yield* readLines(path.join(repoRoot, "todo.txt"));
    let counter = 0;

    for (const line of todoLines) {
      const match = TASK_OPEN_PATTERN.exec(line);
      if (!match) {
        continue;
      }

      counter += 1;
      if (counter !== taskNumber) {
        continue;
      }

      const priority = match[1] ?? "";
      const createdAt = match[2] ?? "";
      const remainder = match[3] ?? "";
      const parsedRemainder = parseTaskRemainder(remainder);
      return {
        lineNumber: findRawLineNumber(path.join(repoRoot, "todo.txt"), line),
        line,
        priority,
        payload: line.slice(line.indexOf(") ") + 2),
        task: {
          number: taskNumber,
          status: "open",
          priority,
          createdAt,
          completedAt: null,
          description: parsedRemainder.description,
          project: parsedRemainder.project,
          owner: parsedRemainder.owner,
          thread: parsedRemainder.thread,
          recur: parsedRemainder.recur,
          after: parsedRemainder.after,
          waiting: parsedRemainder.waiting,
          raw: line,
        } satisfies NilusTaskRecord,
        } satisfies OpenTaskSelection;
    }

    return yield* new NilusReadError({
      message: `No open task numbered ${taskNumber}.`,
    });
  });

function buildTaskCompletionPreview(selection: OpenTaskSelection): NilusTaskCompletionPreview {
  return {
    task: selection.task,
    completedLine: `x ${formatLocalDate(new Date())} ${selection.payload}`,
    nextTaskLine: buildRecurringNextTaskLine(selection.priority, selection.payload),
    affectedFiles: ["todo.txt", "done.txt"],
  };
}

function deriveContinuityThread(task: NilusTaskRecord): string | null {
  if (task.thread) {
    return task.thread;
  }
  if (task.project) {
    return projectSlug(task.project);
  }
  return null;
}

function projectSlug(project: string) {
  return project
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase();
}

function taskMatchesContext(
  task: NilusTaskRecord,
  continuityThread: string | null,
  projects: readonly string[],
) {
  if (continuityThread && task.thread === continuityThread) {
    return true;
  }
  if (task.project && projects.includes(`+${task.project}`)) {
    return true;
  }
  return false;
}

const findRelatedDocuments = (
  repoRoot: string,
  continuityThread: string | null,
  projects: readonly string[],
) =>
  Effect.gen(function* () {
    const patterns = buildContextPatterns(continuityThread, projects);
    if (patterns.length === 0) {
      return [] satisfies NilusTaskContextDocument[];
    }

    const allEntries = [
      ...(yield* listDomainEntries({ repoRoot, domain: "talk" })).entries.map((entry) => ({
        domain: "talk" as const,
        ...entry,
      })),
      ...(yield* listDomainEntries({ repoRoot, domain: "partners" })).entries.map((entry) => ({
        domain: "partners" as const,
        ...entry,
      })),
      ...(yield* listDomainEntries({ repoRoot, domain: "issues" })).entries.map((entry) => ({
        domain: "issues" as const,
        ...entry,
      })),
      ...(yield* listDomainEntries({ repoRoot, domain: "knowledge" })).entries.map((entry) => ({
        domain: "knowledge" as const,
        ...entry,
      })),
    ];

    const matches = allEntries.filter((entry) => {
      if (patterns.some((pattern) => entry.path.includes(pattern) || entry.title.includes(pattern))) {
        return true;
      }
      try {
        const contents = NFS.readFileSync(path.join(repoRoot, entry.path), "utf8");
        return patterns.some((pattern) => contents.includes(pattern));
      } catch {
        return false;
      }
    });

    const uniqueByPath = new Map<string, NilusTaskContextDocument>();
    for (const entry of matches) {
      uniqueByPath.set(entry.path, {
        path: entry.path,
        title: entry.title,
        domain: entry.domain,
      });
    }

    return [...uniqueByPath.values()];
  });

function buildContextPatterns(continuityThread: string | null, projects: readonly string[]) {
  const patterns = new Set<string>();
  if (continuityThread) {
    patterns.add(continuityThread);
  }
  for (const project of projects) {
    const raw = project.replace(/^\+/, "");
    patterns.add(project);
    patterns.add(raw);
    patterns.add(projectSlug(raw));
  }
  return [...patterns].filter((pattern) => pattern.length > 0);
}

function readRecentCommits(repoRoot: string, relativePaths: readonly string[]): NilusTaskContextCommit[] {
  if (relativePaths.length === 0) {
    return [];
  }

  try {
    const output = execFileSync(
      "git",
      ["-C", repoRoot, "log", "--oneline", "-n", "4", "--", ...relativePaths, "todo.txt", "done.txt"],
      {
        encoding: "utf8",
      },
    );
    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        const firstSpace = line.indexOf(" ");
        if (firstSpace === -1) {
          return null;
        }
        return {
          hash: line.slice(0, firstSpace),
          subject: line.slice(firstSpace + 1).trim(),
        } satisfies NilusTaskContextCommit;
      })
      .filter((entry): entry is NilusTaskContextCommit => entry !== null);
  } catch {
    return [];
  }
}

interface NormalizedTalkNoteInput {
  readonly draftId: string;
  readonly topic: string;
  readonly body: string;
  readonly project: string | null;
  readonly thread: string | null;
  readonly refs: readonly string[];
}

function normalizeTalkNoteInput(input: NilusTalkNoteDraftInput): NormalizedTalkNoteInput {
  return {
    draftId: input.draftId.trim(),
    topic: input.topic.trim(),
    body: input.body.trim(),
    project: input.project?.trim() || null,
    thread: input.thread?.trim() || null,
    refs:
      input.refs
        ?.map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
        .toSorted() ?? [],
  };
}

const validateTalkNoteRefs = (repoRoot: string, refs: readonly string[]) =>
  Effect.gen(function* () {
    const warnings: string[] = [];

    for (const refPath of refs) {
      const absolutePath = yield* resolveRepoRelativePath(repoRoot, refPath);
      if (!NFS.existsSync(absolutePath)) {
        warnings.push(`Reference not found: ${refPath}`);
        continue;
      }

      const domain = classifyDomain(refPath);
      if (domain === null) {
        warnings.push(`Reference is outside the current Nilus browser domains: ${refPath}`);
      }
    }

    return warnings;
  });

function renderTalkNoteContents(input: NormalizedTalkNoteInput) {
  const lines = [
    "---",
    "type: note",
    "author: nilus",
    `date: ${formatLocalDate(new Date())}`,
    `topic: ${input.topic}`,
  ];

  if (input.project) {
    lines.push(`project: ${input.project}`);
  }
  if (input.thread) {
    lines.push(`thread: ${input.thread}`);
  }
  if (input.refs.length > 0) {
    lines.push("refs:");
    for (const refPath of input.refs) {
      lines.push(`  - ${refPath}`);
    }
  }

  lines.push("---", "", input.body);
  return `${lines.join("\n")}\n`;
}

function buildTalkNotePath(repoRoot: string, draftId: string) {
  const timestamp = formatTalkLogTimestamp(parseDraftDate(draftId));
  const directory = path.join(repoRoot, "talk-log");
  let candidate = `${timestamp}-nilus.md`;
  let index = 1;

  while (NFS.existsSync(path.join(directory, candidate))) {
    candidate = `${timestamp}-nilus-${index}.md`;
    index += 1;
  }

  return path.posix.join("talk-log", candidate);
}

const readWritableLines = (filePath: string) =>
  readTextFile(filePath).pipe(
    Effect.map((contents) => {
      const lines = contents.split(/\r?\n/);
      if (lines.at(-1) === "") {
        lines.pop();
      }
      return lines;
    }),
  );

const writeLines = (filePath: string, lines: readonly string[]) =>
  Effect.try({
    try: () => {
      NFS.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
    },
    catch: (cause) =>
      new NilusReadError({
        message: `Failed to write ${path.basename(filePath)}.`,
        cause,
      }),
  });

const writeTextFile = (filePath: string, contents: string) =>
  Effect.try({
    try: () => {
      NFS.mkdirSync(path.dirname(filePath), {
        recursive: true,
      });
      NFS.writeFileSync(filePath, contents, "utf8");
    },
    catch: (cause) =>
      new NilusReadError({
        message: `Failed to write ${path.basename(filePath)}.`,
        cause,
      }),
  });

function findRawLineNumber(filePath: string, targetLine: string) {
  const rawLines = NFS.readFileSync(filePath, "utf8").split(/\r?\n/);
  let counter = 0;
  for (const [index, line] of rawLines.entries()) {
    if (!TASK_OPEN_PATTERN.test(line)) {
      continue;
    }
    counter += 1;
    if (line === targetLine) {
      return index + 1;
    }
  }
  return counter;
}

function formatLocalDate(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTalkLogTimestamp(value: Date) {
  const year = value.getUTCFullYear();
  const month = `${value.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${value.getUTCDate()}`.padStart(2, "0");
  const hour = `${value.getUTCHours()}`.padStart(2, "0");
  const minute = `${value.getUTCMinutes()}`.padStart(2, "0");
  const second = `${value.getUTCSeconds()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hour}${minute}${second}Z`;
}

function parseDraftDate(draftId: string) {
  const parsed = new Date(draftId);
  return Number.isNaN(parsed.valueOf()) ? new Date() : parsed;
}

function buildRecurringNextTaskLine(priority: string, payload: string): string | null {
  const recurMatch = payload.match(/\brecur:(daily|weekly|monthly)\b/);
  if (!recurMatch) {
    return null;
  }

  const recur = recurMatch[1] ?? null;
  if (recur === null) {
    return null;
  }

  const days = recurDaysFor(recur);
  if (days === null) {
    return null;
  }

  const firstSpace = payload.indexOf(" ");
  if (firstSpace === -1) {
    return null;
  }

  const createdAt = payload.slice(0, firstSpace);
  let nextPayload = payload.slice(firstSpace + 1);
  const newCreatedAt = advanceDateString(createdAt, days);

  nextPayload = nextPayload.replace(
    /\bafter:(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z)\b/,
    (_match, value) => `after:${advanceUtcDateTimeString(value, days)}`,
  );

  return `(${priority}) ${newCreatedAt} ${nextPayload}`;
}

function recurDaysFor(recur: string) {
  switch (recur) {
    case "daily":
      return 1;
    case "weekly":
      return 7;
    case "monthly":
      return 30;
    default:
      return null;
  }
}

function advanceDateString(value: string, days: number) {
  const [yearText = "0", monthText = "1", dayText = "1"] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const next = new Date(Date.UTC(year, month - 1, day));
  next.setUTCDate(next.getUTCDate() + days);
  return `${next.getUTCFullYear()}-${`${next.getUTCMonth() + 1}`.padStart(2, "0")}-${`${next.getUTCDate()}`.padStart(2, "0")}`;
}

function advanceUtcDateTimeString(value: string, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return `${next.getUTCFullYear()}-${`${next.getUTCMonth() + 1}`.padStart(2, "0")}-${`${next.getUTCDate()}`.padStart(2, "0")}T${`${next.getUTCHours()}`.padStart(2, "0")}:${`${next.getUTCMinutes()}`.padStart(2, "0")}Z`;
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
    const line = lines[index] ?? "";
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
