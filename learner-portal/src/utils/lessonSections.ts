const SECTION_LABELS: Record<string, string> = {
  lesson: "Lesson",
  references: "References",
  exercises: "Exercises",
  exercise: "Exercise",
};

export const parseSectionKey = (sectionKey: string) => {
  const match = sectionKey.match(/^(.*?)-(\d+)$/);
  if (match) {
    return { baseKey: match[1], index: Number(match[2]) };
  }
  return { baseKey: sectionKey, index: 1 };
};

export const getSectionBaseKey = (sectionKey: string) => parseSectionKey(sectionKey).baseKey;

export const isExercisesSection = (sectionKey: string) => {
  const baseKey = getSectionBaseKey(sectionKey);
  return baseKey === "exercises" || baseKey === "exercise";
};

export const normalizeSectionOrder = (sections: unknown) => {
  if (Array.isArray(sections)) {
    return sections.map((item) => String(item).trim()).filter(Boolean);
  }
  if (sections && typeof sections === "object") {
    return Object.keys(sections as Record<string, unknown>);
  }
  return [];
};

export const getSectionsAfterBackground = (sectionKeys: string[]) => {
  const backgroundIndex = sectionKeys.findIndex(
    (key) => getSectionBaseKey(key) === "background"
  );
  if (backgroundIndex === -1) {
    return sectionKeys;
  }
  return sectionKeys.slice(backgroundIndex + 1);
};

const toTitleCase = (value: string) =>
  value
    .split(/[\s-_]+/)
    .filter(Boolean)
    .map((chunk) => chunk[0]?.toUpperCase() + chunk.slice(1))
    .join(" ");

export const getSectionLabel = (sectionKey: string) => {
  const { baseKey, index } = parseSectionKey(sectionKey);
  const baseLabel = SECTION_LABELS[baseKey] || toTitleCase(baseKey);
  if (index > 1) {
    return `${baseLabel} ${index}`;
  }
  return baseLabel;
};
