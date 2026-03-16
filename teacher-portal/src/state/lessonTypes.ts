export type LessonWorkflowState =
  | "source"
  | "concepts_review"
  | "section_drafting"
  | "review"
  | "published";

export type ApprovedQuestionPage = {
  title?: string | null;
  detectedPageNumber?: number | null;
  pageNumber?: number | null;
  questions?: string[] | null;
};

export type LessonTemplate = {
  id: string;
  title: string;
  status: string;
  workflowState?: LessonWorkflowState | string | null;
  subject?: string | null;
  level?: string | null;
  updated_at?: string;
  iconUrl?: string | null;
  summary?: string | null;
  requiresLogin?: boolean | null;
  sections?: Record<string, string>;
  sectionsMeta?: Record<
    string,
    {
      key?: string;
      updatedAt?: string;
      contentLength?: number;
    }
  >;
  exerciseGenerator?: ExerciseGeneratorMeta | null;
  exerciseMode?: string | null;
  exerciseConfig?: ExerciseConfig | null;
  approvedQuestions?: ApprovedQuestionPage[] | null;
};

export type Lesson = LessonTemplate;

export type ExerciseGeneratorMeta = {
  updatedAt?: string;
  filename?: string;
  contentLength?: number;
};

export type ExerciseConfig = {
  questionsPerExercise?: number | null;
  exercisesCount?: number | null;
};

export const normalizeLesson = (
  item: Record<string, unknown>,
  fallbackId: string
): LessonTemplate => {
  const id =
    (item.id as string) ||
    (item._id as string) ||
    (item.lessonId as string) ||
    fallbackId;
  const title =
    (item.title as string) ||
    (item.name as string) ||
    (item.lessonName as string) ||
    "Untitled template";
  const status = (item.status as string) || (item.state as string) || "Draft";
  const workflowState =
    (item.workflowState as string | undefined) ??
    (item.workflow_state as string | undefined) ??
    null;
  const subject = (item.subject as string) || null;
  const level = (item.level as string) || null;
  const updated_at =
    (item.updated_at as string) || (item.updatedAt as string) || undefined;
  const iconUrl = (item.iconUrl as string) || (item.icon as string) || null;
  const summary =
    (item.summary as string) ||
    (item.content as string) ||
    (item.description as string) ||
    null;
  const requiresLogin =
    (item.requiresLogin as boolean | undefined) ??
    (item.requires_login as boolean | undefined) ??
    null;
  const sections = item.sections as Record<string, string> | undefined;
  const sectionsMeta = (item.sectionsMeta ||
    item.sections_meta) as
    | Record<
        string,
        {
          key?: string;
          updatedAt?: string;
          contentLength?: number;
        }
      >
    | undefined;
  const exerciseGenerator = (item.exerciseGenerator ||
    item.exercise_generator) as ExerciseGeneratorMeta | undefined;
  const exerciseMode =
    (item.exerciseMode as string | undefined) ??
    (item.exercise_mode as string | undefined) ??
    null;
  const exerciseConfig = (item.exerciseConfig ||
    item.exercise_config) as ExerciseConfig | undefined;
  const approvedQuestions = item.approvedQuestions as
    | ApprovedQuestionPage[]
    | undefined;
  return {
    id: String(id),
    title,
    status,
    workflowState,
    subject,
    level,
    updated_at,
    iconUrl,
    summary,
    requiresLogin,
    sections,
    sectionsMeta,
    exerciseGenerator,
    exerciseMode,
    exerciseConfig: exerciseConfig ?? null,
    approvedQuestions: approvedQuestions ?? null,
  };
};
