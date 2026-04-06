import type {
  EnvironmentId,
  ProjectId,
  ScopedProjectRef,
  ScopedThreadRef,
  ThreadId,
} from "@t3tools/contracts";

export function scopeProjectRef(
  environmentId: EnvironmentId,
  projectId: ProjectId,
): ScopedProjectRef {
  return { environmentId, projectId };
}

export function scopeThreadRef(environmentId: EnvironmentId, threadId: ThreadId): ScopedThreadRef {
  return { environmentId, threadId };
}

export function scopedRefKey(ref: ScopedProjectRef | ScopedThreadRef): string {
  const localId = "projectId" in ref ? ref.projectId : ref.threadId;
  return `${ref.environmentId}:${localId}`;
}
