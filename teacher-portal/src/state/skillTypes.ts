export type SkillKind = "compute" | "ai_driven";

export type SkillScope = "system" | "teacher";

export type SkillStatus = "active" | "draft";

export type SkillDefinition = {
  id: string;
  displayName: string;
  description: string;
  kind: SkillKind;
  scope: SkillScope;
  status: SkillStatus;
  usedBy: string[];
  prompt: string;
  ioSchema: string;
  updatedAt: string;
};

export const defaultSkills: SkillDefinition[] = [
  {
    id: "upload_source_document",
    displayName: "Upload Source Document",
    description: "Store browser-extracted PDF text and page chunks for a lesson template.",
    kind: "compute",
    scope: "system",
    status: "active",
    usedBy: ["class_lesson_planner"],
    prompt: `# upload_source_document

This skill is compute first.

Purpose:
- accept browser-extracted PDF payloads
- persist source document metadata
- persist extracted text and page chunks

Rules:
- do not infer concepts here
- do not clean or rewrite teacher-provided text
- preserve raw extracted text for later review
`,
    ioSchema: `{
  "skill": "upload_source_document",
  "type": "compute",
  "input": {
    "type": "object",
    "required": ["teacherId", "lessonTemplateId", "documents"]
  },
  "output": {
    "type": "object",
    "required": ["storedDocuments"]
  }
}`,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "extract_document_structure",
    displayName: "Extract Document Structure",
    description: "Recover title candidates, headings, question blocks, and chunks from PDF text.",
    kind: "compute",
    scope: "system",
    status: "active",
    usedBy: ["class_lesson_planner"],
    prompt: `# extract_document_structure

Goal:
- recover usable lesson structure from browser-extracted PDF text

Return:
- title candidates
- likely headings
- question-like blocks
- text chunks grouped by local topic
`,
    ioSchema: `{
  "skill": "extract_document_structure",
  "type": "compute",
  "input": {
    "type": "object",
    "required": ["documents"]
  },
  "output": {
    "type": "object",
    "required": ["titleCandidates", "headings", "questionBlocks", "chunks"]
  }
}`,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "extract_concepts",
    displayName: "Extract Concepts",
    description: "Propose a compact teacher-reviewable concept list from document structure.",
    kind: "ai_driven",
    scope: "system",
    status: "active",
    usedBy: ["class_lesson_planner"],
    prompt: `# extract_concepts

You are helping a teacher build a generic class lesson template from source material.

Task:
- propose the best lesson title
- derive the core teaching concepts
- keep the concept list short, teachable, and reviewable by a human
`,
    ioSchema: `{
  "skill": "extract_concepts",
  "type": "ai_driven",
  "input": {
    "type": "object",
    "required": ["titleCandidates", "headings", "chunks"]
  },
  "output": {
    "type": "object",
    "required": ["suggestedTitle", "concepts"]
  }
}`,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "build_section_drafts",
    displayName: "Build Section Drafts",
    description: "Draft one editable teacher-facing section per approved concept.",
    kind: "ai_driven",
    scope: "system",
    status: "active",
    usedBy: ["class_lesson_planner"],
    prompt: `# build_section_drafts

You are drafting editable lesson sections for a teacher.

For each approved concept:
- write a short synopsis
- write practical teaching notes
- draft review or discussion questions
`,
    ioSchema: `{
  "skill": "build_section_drafts",
  "type": "ai_driven",
  "input": {
    "type": "object",
    "required": ["lessonTitle", "concepts", "sourceChunks"]
  },
  "output": {
    "type": "object",
    "required": ["sections"]
  }
}`,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "publish_lesson",
    displayName: "Publish Lesson",
    description: "Validate the lesson template before public release.",
    kind: "compute",
    scope: "system",
    status: "active",
    usedBy: ["class_lesson_planner"],
    prompt: `# publish_lesson

This skill is compute first.

Goal:
- validate that a generic lesson template is ready for public use
`,
    ioSchema: `{
  "skill": "publish_lesson",
  "type": "compute",
  "input": {
    "type": "object",
    "required": ["lessonTemplate", "sections"]
  },
  "output": {
    "type": "object",
    "required": ["status", "checks"]
  }
}`,
    updatedAt: new Date().toISOString(),
  },
];
