// GHS Phase A — useProjectSettings hook
// Fetches project settings on mount / projectId change.
// Returns { settings, patch, isLoading, error }.
// When projectId is null, returns defaults synchronously without fetching.
// No external deps — plain React hooks only.

"use client";

import { useState, useEffect, useCallback } from "react";

// Defaults mirror the Prisma ProjectSettings schema defaults exactly.
export interface ProjectSettingsData {
  id: string | null;
  projectId: string;
  tenantId: string | null;
  // Visual / generation
  visualStyle: string;
  aspectRatio: string;
  imageModelFamily: string;
  imageModelVersion: string;
  videoModelFamily: string;
  videoModelVersion: string;
  // Audio
  soundTier: string;
  narrationProvider: string;
  // Localization
  language: string;
  // Subtitles
  subtitleEnabled: boolean;
  subtitleMode: string;
  subtitleHighlight: string;
  // LLM
  llmProvider: string;
  // Identity
  faceLockEnabled: boolean;
  // Brand
  brandLogoUrl: string | null;
  brandPrimaryColor: string | null;
  // Timestamps
  createdAt: string | Date | null;
  updatedAt: string | Date | null;
}

export const PROJECT_SETTINGS_DEFAULTS: Omit<
  ProjectSettingsData,
  "projectId"
> = {
  id: null,
  tenantId: null,
  visualStyle: "storybook",
  aspectRatio: "16:9",
  imageModelFamily: "flux",
  imageModelVersion: "auto",
  videoModelFamily: "wan",
  videoModelVersion: "auto",
  soundTier: "ghs-sound",
  narrationProvider: "auto",
  language: "en",
  subtitleEnabled: true,
  subtitleMode: "classic",
  subtitleHighlight: "#34d399",
  llmProvider: "auto",
  faceLockEnabled: true,
  brandLogoUrl: null,
  brandPrimaryColor: "#a855f7",
  createdAt: null,
  updatedAt: null,
};

export interface UseProjectSettingsReturn {
  settings: ProjectSettingsData;
  patch: (partial: Partial<Omit<ProjectSettingsData, "id" | "projectId" | "createdAt" | "updatedAt">>) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const NULL_PROJECT_ID = "__null__";

function buildDefaults(projectId: string): ProjectSettingsData {
  return { ...PROJECT_SETTINGS_DEFAULTS, projectId };
}

export function useProjectSettings(
  projectId: string | null
): UseProjectSettingsReturn {
  const [settings, setSettings] = useState<ProjectSettingsData>(
    buildDefaults(projectId ?? NULL_PROJECT_ID)
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // When projectId is null, return defaults synchronously — no fetch
    if (!projectId) {
      setSettings(buildDefaults(NULL_PROJECT_ID));
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetch(`/api/project/settings?projectId=${encodeURIComponent(projectId)}`)
      .then((res) => res.json())
      .then((data: { ok: boolean; settings?: ProjectSettingsData; error?: string }) => {
        if (cancelled) return;
        if (data.ok && data.settings) {
          setSettings(data.settings);
        } else {
          // API returned ok:false — use defaults and surface the error
          setSettings(buildDefaults(projectId));
          setError(data.error ?? "Failed to load settings");
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setSettings(buildDefaults(projectId));
        setError(err instanceof Error ? err.message : "Network error");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const patch = useCallback(
    async (
      partial: Partial<
        Omit<ProjectSettingsData, "id" | "projectId" | "createdAt" | "updatedAt">
      >
    ) => {
      const effectiveProjectId = projectId ?? NULL_PROJECT_ID;

      // Optimistic update
      setSettings((prev) => ({ ...prev, ...partial }));

      if (!projectId) {
        // No projectId — stay in local-only mode, don't persist
        return;
      }

      try {
        const res = await fetch("/api/project/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: effectiveProjectId, ...partial }),
        });
        const data: { ok: boolean; settings?: ProjectSettingsData; error?: string } =
          await res.json();
        if (data.ok && data.settings) {
          setSettings(data.settings);
        } else {
          setError(data.error ?? "Failed to save settings");
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Network error on patch");
      }
    },
    [projectId]
  );

  return { settings, patch, isLoading, error };
}
