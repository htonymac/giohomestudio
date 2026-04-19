// GHS Audit Logger — Trust & Accountability
//
// From Support Canvas:
// Log critical trust events throughout the production pipeline.
// Every audit log is timestamped and linked to a project.
//
// Event types:
// - upload_approved: user approved an uploaded file
// - export_approved: user approved final export
// - rights_confirmed: user confirmed rights at risk point
// - sound_used: a sound asset was used in production
// - sound_blocked: a sound was blocked (CC BY-NC / unknown)
// - render_started: FFmpeg render job started
// - render_completed: render job finished
// - assembly_completed: full assembly pipeline finished
// - change_applied: collaborative edit applied
// - change_rejected: collaborative edit rejected
// - tier_selected: user selected GHS intelligence tier
// - voice_cloned: voice cloning was performed

import { Prisma } from "@prisma/client";

export type AuditEventType =
  | "upload_approved"
  | "export_approved"
  | "rights_confirmed"
  | "sound_used"
  | "sound_blocked"
  | "render_started"
  | "render_completed"
  | "assembly_completed"
  | "change_applied"
  | "change_rejected"
  | "tier_selected"
  | "voice_cloned"
  | "project_created"
  | "project_exported"
  | "preview_generated";

interface AuditLogEntry {
  eventType: AuditEventType;
  projectId?: string;
  details?: Record<string, unknown>;
  soundAssetId?: string;
  licenseType?: string;
  plannerTier?: string;
}

export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.auditLog.create({
      data: {
        eventType: entry.eventType,
        projectId: entry.projectId || null,
        details: (entry.details as Prisma.InputJsonValue) || undefined,
        soundAssetId: entry.soundAssetId || null,
        licenseType: entry.licenseType || null,
        plannerTier: entry.plannerTier || null,
      },
    });
  } catch {
    // Audit log failure should never break the main flow
    console.error(`[AUDIT] Failed to log: ${entry.eventType}`);
  }
}

// Convenience wrappers for common events
export const audit = {
  uploadApproved: (projectId: string, details?: Record<string, unknown>) =>
    logAuditEvent({ eventType: "upload_approved", projectId, details }),

  exportApproved: (projectId: string, details?: Record<string, unknown>) =>
    logAuditEvent({ eventType: "export_approved", projectId, details }),

  rightsConfirmed: (projectId: string, confirmationType: string) =>
    logAuditEvent({ eventType: "rights_confirmed", projectId, details: { confirmationType } }),

  soundUsed: (projectId: string, soundAssetId: string, licenseType: string) =>
    logAuditEvent({ eventType: "sound_used", projectId, soundAssetId, licenseType }),

  soundBlocked: (projectId: string, soundAssetId: string, licenseType: string, reason: string) =>
    logAuditEvent({ eventType: "sound_blocked", projectId, soundAssetId, licenseType, details: { reason } }),

  renderStarted: (projectId: string, tier: string) =>
    logAuditEvent({ eventType: "render_started", projectId, plannerTier: tier }),

  renderCompleted: (projectId: string, outputPath: string) =>
    logAuditEvent({ eventType: "render_completed", projectId, details: { outputPath } }),

  assemblyCompleted: (projectId: string, assemblyVersion: number) =>
    logAuditEvent({ eventType: "assembly_completed", projectId, details: { assemblyVersion } }),

  changeApplied: (projectId: string, changeType: string, scope: string) =>
    logAuditEvent({ eventType: "change_applied", projectId, details: { changeType, scope } }),

  changeRejected: (projectId: string, changeType: string, reason: string) =>
    logAuditEvent({ eventType: "change_rejected", projectId, details: { changeType, reason } }),

  tierSelected: (projectId: string, tier: string) =>
    logAuditEvent({ eventType: "tier_selected", projectId, plannerTier: tier }),

  voiceCloned: (projectId: string, voiceId: string) =>
    logAuditEvent({ eventType: "voice_cloned", projectId, details: { voiceId } }),

  projectCreated: (projectId: string, projectType: string) =>
    logAuditEvent({ eventType: "project_created", projectId, details: { projectType } }),

  projectExported: (projectId: string, format: string) =>
    logAuditEvent({ eventType: "project_exported", projectId, details: { format } }),

  previewGenerated: (projectId: string) =>
    logAuditEvent({ eventType: "preview_generated", projectId }),
};
