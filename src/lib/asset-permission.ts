// Asset-level permission checks — Wave 3 Phase 4 (2026-05-23).
// All asset reads/writes go through canRead/canWrite/canDelete.
//
// Owner check rule (Henry's spec §"Server checks: does this user own it?"):
//   - asset.ownerId === session.userId  → allow
//   - asset.visibility === 'public'     → allow read (anyone)
//   - else                              → 403
//
// During migration:
//   - Existing assets have ownerId=NULL (no back-fill yet). Treat as "owned by no one
//     specific" — for now, ALLOW READ to all authed users until back-fill completes.
//     This is a transitional rule; tighten to 403 once back-fill done (Phase 7 pre-launch).

export type AssetLike = {
  id?: string;
  ownerId?: string | null;
  visibility?: string | null; // "private" | "public" | "unlisted"
};

export type SessionLike = {
  userId?: string | null;
  isAdmin?: boolean;
};

export function isOwner(asset: AssetLike, session: SessionLike): boolean {
  if (!session.userId) return false;
  return asset.ownerId === session.userId;
}

export function isAdmin(session: SessionLike): boolean {
  return session.isAdmin === true;
}

export function canRead(asset: AssetLike, session: SessionLike): boolean {
  if (isAdmin(session)) return true;
  if (asset.visibility === "public") return true;
  if (isOwner(asset, session)) return true;
  // Transitional: assets with NO owner (pre-migration) — allow authed users.
  // TIGHTEN before public launch (TODO Phase 7 pre-launch checklist).
  if (!asset.ownerId && session.userId) return true;
  return false;
}

export function canWrite(asset: AssetLike, session: SessionLike): boolean {
  if (isAdmin(session)) return true;
  return isOwner(asset, session);
}

export function canDelete(asset: AssetLike, session: SessionLike): boolean {
  if (isAdmin(session)) return true;
  return isOwner(asset, session);
}

export class PermissionDeniedError extends Error {
  readonly status = 403;
  constructor(public readonly assetId: string | undefined, public readonly action: "read" | "write" | "delete") {
    super(`Permission denied: ${action} on asset ${assetId ?? "?"}`);
    this.name = "PermissionDeniedError";
  }
}

/** Throws PermissionDeniedError if check fails. */
export function assertCanRead(asset: AssetLike, session: SessionLike): void {
  if (!canRead(asset, session)) throw new PermissionDeniedError(asset.id, "read");
}
export function assertCanWrite(asset: AssetLike, session: SessionLike): void {
  if (!canWrite(asset, session)) throw new PermissionDeniedError(asset.id, "write");
}
export function assertCanDelete(asset: AssetLike, session: SessionLike): void {
  if (!canDelete(asset, session)) throw new PermissionDeniedError(asset.id, "delete");
}
