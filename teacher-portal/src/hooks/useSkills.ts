import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildAuthHeaders, type GetAccessTokenSilently } from "../auth/buildAuthHeaders";
import {
  createSkill as createSkillRequest,
  deleteSkill as deleteSkillRequest,
  duplicateSkill as duplicateSkillRequest,
  listSkills,
  resetSkills as resetSkillsRequest,
  updateSkill as updateSkillRequest,
} from "../api/skills";
import type { SkillDefinition } from "../state/skillTypes";

type UseSkillsOptions = {
  apiBaseUrl: string;
  auth0Audience: string;
  isAuthenticated: boolean;
  getAccessTokenSilently: GetAccessTokenSilently;
};

export const useSkills = ({
  apiBaseUrl,
  auth0Audience,
  isAuthenticated,
  getAccessTokenSilently,
}: UseSkillsOptions) => {
  const normalizeKind = (value: unknown): SkillDefinition["kind"] => {
    return value === "ai_driven" || value === "llm" || value === "llm_or_hybrid"
      ? "ai_driven"
      : "compute";
  };

  const normalizeSkill = (value: unknown): SkillDefinition | null => {
    if (!value || typeof value !== "object") {
      return null;
    }
    const skill = value as Record<string, unknown>;
    return {
      id: String(skill.id ?? ""),
      displayName: String(skill.displayName ?? ""),
      description: String(skill.description ?? ""),
      kind: normalizeKind(skill.kind),
      scope: skill.scope === "teacher" ? "teacher" : "system",
      status: skill.status === "draft" ? "draft" : "active",
      usedBy: Array.isArray(skill.usedBy)
        ? skill.usedBy.map((item) => String(item)).filter(Boolean)
        : [],
      prompt: String(skill.prompt ?? ""),
      ioSchema: String(skill.ioSchema ?? ""),
      updatedAt: String(skill.updatedAt ?? new Date().toISOString()),
    };
  };

  const saveTimersRef = useRef<Record<string, number>>({});
  const [skills, setSkills] = useState<SkillDefinition[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const skillsEndpoint = useMemo(() => (apiBaseUrl ? `${apiBaseUrl}/skills` : ""), [apiBaseUrl]);

  useEffect(() => {
    if (!isAuthenticated || !skillsEndpoint) {
      return;
    }
    const load = async () => {
      try {
        const headers = await buildAuthHeaders(getAccessTokenSilently, auth0Audience);
        const data = await listSkills(skillsEndpoint, headers);
        const next = Array.isArray(data.skills)
          ? data.skills.map(normalizeSkill).filter((skill): skill is SkillDefinition => !!skill)
          : [];
        setSkills(next);
        setSelectedSkillId((prev) => prev || next[0]?.id || null);
      } catch (err) {
        const detail = err instanceof Error ? err.message : "Failed to load skills";
        setError(detail);
      }
    };
    load();
  }, [auth0Audience, getAccessTokenSilently, isAuthenticated, skillsEndpoint]);

  useEffect(() => {
    if (!skills.length) {
      setSelectedSkillId(null);
      return;
    }
    if (!selectedSkillId || !skills.some((skill) => skill.id === selectedSkillId)) {
      setSelectedSkillId(skills[0].id);
    }
  }, [selectedSkillId, skills]);

  const selectedSkill = useMemo(
    () => skills.find((skill) => skill.id === selectedSkillId) || null,
    [selectedSkillId, skills]
  );

  const createSkill = useCallback(async () => {
    if (!isAuthenticated || !skillsEndpoint) {
      return null;
    }
    try {
      const headers = await buildAuthHeaders(getAccessTokenSilently, auth0Audience);
      const created = normalizeSkill(await createSkillRequest(skillsEndpoint, headers));
      if (!created) {
        throw new Error("Invalid skill payload");
      }
      setSkills((prev) => [created, ...prev]);
      setSelectedSkillId(created.id);
      return created;
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Failed to create skill";
      setError(detail);
      return null;
    }
  }, [auth0Audience, getAccessTokenSilently, isAuthenticated, skillsEndpoint]);

  const updateSkill = useCallback((skillId: string, updates: Partial<SkillDefinition>) => {
    setSkills((prev) =>
      prev.map((skill) =>
        skill.id === skillId
          ? { ...skill, ...updates, updatedAt: new Date().toISOString() }
          : skill
      )
    );
    window.clearTimeout(saveTimersRef.current[skillId]);
    saveTimersRef.current[skillId] = window.setTimeout(async () => {
      try {
        const headers = await buildAuthHeaders(getAccessTokenSilently, auth0Audience);
        const updated = normalizeSkill(
          await updateSkillRequest(`${skillsEndpoint}/id/${skillId}`, headers, updates)
        );
        if (updated) {
          setSkills((prev) => prev.map((skill) => (skill.id === skillId ? updated : skill)));
        }
      } catch (err) {
        const detail = err instanceof Error ? err.message : "Failed to update skill";
        setError(detail);
      }
    }, 400);
  }, [auth0Audience, getAccessTokenSilently, skillsEndpoint]);

  const duplicateSkill = useCallback(async (skillId: string) => {
    if (!isAuthenticated || !skillsEndpoint) {
      return null;
    }
    try {
      const headers = await buildAuthHeaders(getAccessTokenSilently, auth0Audience);
      const duplicated = normalizeSkill(
        await duplicateSkillRequest(`${skillsEndpoint}/id/${skillId}/duplicate`, headers)
      );
      if (!duplicated) {
        throw new Error("Invalid skill payload");
      }
      setSkills((prev) => [duplicated, ...prev]);
      setSelectedSkillId(duplicated.id);
      return duplicated;
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Failed to duplicate skill";
      setError(detail);
      return null;
    }
  }, [auth0Audience, getAccessTokenSilently, isAuthenticated, skillsEndpoint]);

  const deleteSkill = useCallback(async (skillId: string) => {
    if (!isAuthenticated || !skillsEndpoint) {
      return false;
    }
    try {
      const headers = await buildAuthHeaders(getAccessTokenSilently, auth0Audience);
      await deleteSkillRequest(`${skillsEndpoint}/id/${skillId}`, headers);
      setSkills((prev) => prev.filter((skill) => skill.id !== skillId));
      return true;
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Failed to delete skill";
      setError(detail);
      return false;
    }
  }, [auth0Audience, getAccessTokenSilently, isAuthenticated, skillsEndpoint]);

  const resetSkills = useCallback(async () => {
    if (!isAuthenticated || !skillsEndpoint) {
      return;
    }
    try {
      const headers = await buildAuthHeaders(getAccessTokenSilently, auth0Audience);
      const data = await resetSkillsRequest(`${skillsEndpoint}/reset`, headers);
      const next = Array.isArray(data.skills)
        ? data.skills.map(normalizeSkill).filter((skill): skill is SkillDefinition => !!skill)
        : [];
      setSkills(next);
      setSelectedSkillId(next[0]?.id || null);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Failed to reset skills";
      setError(detail);
    }
  }, [auth0Audience, getAccessTokenSilently, isAuthenticated, skillsEndpoint]);

  return {
    skills,
    selectedSkill,
    selectedSkillId,
    setSelectedSkillId,
    createSkill,
    updateSkill,
    duplicateSkill,
    deleteSkill,
    resetSkills,
    error,
    setError,
  };
};
