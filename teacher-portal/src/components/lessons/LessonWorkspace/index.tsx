import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Dialog,
  Box,
  Button,
  Collapse,
  CircularProgress,
  Divider,
  IconButton,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import DocumentScannerRoundedIcon from "@mui/icons-material/DocumentScannerRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import FormatBoldRoundedIcon from "@mui/icons-material/FormatBoldRounded";
import FormatItalicRoundedIcon from "@mui/icons-material/FormatItalicRounded";
import FormatListBulletedRoundedIcon from "@mui/icons-material/FormatListBulletedRounded";
import FormatListNumberedRoundedIcon from "@mui/icons-material/FormatListNumberedRounded";
import FullscreenRoundedIcon from "@mui/icons-material/FullscreenRounded";
import CodeRoundedIcon from "@mui/icons-material/CodeRounded";
import FormatQuoteRoundedIcon from "@mui/icons-material/FormatQuoteRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import MemoryRoundedIcon from "@mui/icons-material/MemoryRounded";
import PictureAsPdfRoundedIcon from "@mui/icons-material/PictureAsPdfRounded";
import PsychologyRoundedIcon from "@mui/icons-material/PsychologyRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import RedoRoundedIcon from "@mui/icons-material/RedoRounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import UndoRoundedIcon from "@mui/icons-material/UndoRounded";
import ZoomInRoundedIcon from "@mui/icons-material/ZoomInRounded";
import ZoomOutRoundedIcon from "@mui/icons-material/ZoomOutRounded";
import type { Lesson } from "../../../state/lessonTypes";
import {
  buildAuthHeaders,
  type GetAccessTokenSilently,
} from "../../../auth/buildAuthHeaders";
import {
  extractLessonPageQuestions,
  publishApprovedQuestionsLesson,
  type LessonPageQuestionItem,
  type LessonPageQuestionUsage,
} from "../../../api/lessons";
import { extractPageColumns } from "../../../lib/extractPageQuestions";

type LessonWorkspaceProps = {
  lesson: Lesson | null;
  hasLessons: boolean;
  isAuthenticated: boolean;
  onCreateLesson: () => void;
  onDuplicateLesson: () => void;
  onDeleteLesson: () => void;
  showDelete: boolean;
  onUpdateTitle: (lessonId: string, title: string) => Promise<Lesson | null>;
  onUpdateContent: (
    lessonId: string,
    content: string,
  ) => Promise<Lesson | null>;
  onUpdateStatus: (lessonId: string, status: string) => Promise<Lesson | null>;
  getAccessTokenSilently?: GetAccessTokenSilently;
  onUpdateMeta: (
    lessonId: string,
    updates: {
      subject?: string | null;
      level?: string | null;
      requiresLogin?: boolean;
      exerciseConfig?: {
        questionsPerExercise?: number | null;
        exercisesCount?: number | null;
      } | null;
    },
  ) => Promise<Lesson | null>;
  onNotify: (message: string, severity: "success" | "error") => void;
  onPulse?: (color: "success" | "error") => void;
};

type WorkflowState =
  | "source"
  | "concepts"
  | "sections"
  | "review"
  | "published";
type StepKey = "source" | "concepts";
type QuestionReviewState = "untouched" | "accepted" | "rejected";

type SourceDocument = {
  id: string;
  name: string;
  pages: number;
  pageTitles: Array<string | null>;
  pageNumbers: Array<number | null>;
  pageTexts: string[];
  pageTextQuestions: string[][];
  pageTextQuestionStates: QuestionReviewState[][];
  pageQuestions: string[];
  pageQuestionDetails: Array<LessonPageQuestionItem[] | null>;
  pageQuestionUsage: Array<PageQuestionUsageRecord | null>;
  extractedText: string;
  titleCandidates: string[];
  headingCandidates: string[];
  questionCandidates: string[];
  uploadedAt: string;
};

type PreviewDocument = {
  id: string;
  name: string;
  url: string;
  file: File;
};

type ConceptDraft = {
  id: string;
  title: string;
  synopsis: string;
  approved: boolean;
};

type SectionDraft = {
  id: string;
  conceptId: string;
  title: string;
  synopsis: string;
  teachingNotes: string;
  questions: string[];
};

type BuilderDraft = {
  workflowState: WorkflowState;
  overview: string;
  sourceDocuments: SourceDocument[];
  concepts: ConceptDraft[];
  sections: SectionDraft[];
  lastSkillRunAt?: string | null;
};

type ApprovedQuestionPage = {
  sourceDocumentId: string;
  pageNumber: number;
  title: string | null;
  detectedPageNumber: number | null;
  questions: string[];
  questionIndexes: number[];
  states: QuestionReviewState[];
};

type SkillRef = {
  id: string;
  label: string;
  kind: "compute" | "ai_driven";
};

type PageQuestionUsageRecord = LessonPageQuestionUsage & {
  pageNumber: number;
  extractedAt: string;
  requestId?: string | null;
};

type JsonNodeProps = {
  data: unknown;
  label?: string;
  depth?: number;
  expandAll: boolean;
  showKeys: boolean;
};

const emptyDraft = (): BuilderDraft => ({
  workflowState: "source",
  overview: "",
  sourceDocuments: [],
  concepts: [],
  sections: [],
  lastSkillRunAt: null,
});

const getStorageKey = (lessonId: string) =>
  `tp_teacher_lesson_builder_v2_${lessonId}`;
const SOURCE_SPLIT_STORAGE_KEY = "tp_teacher_source_split_pct_v1";

const createId = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const loadStoredSourcePaneSplit = () => {
  if (typeof window === "undefined") {
    return 50;
  }
  const raw = window.localStorage.getItem(SOURCE_SPLIT_STORAGE_KEY);
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isFinite(parsed)) {
    return 50;
  }
  return Math.min(70, Math.max(30, parsed));
};

const cleanLine = (value: string) => value.replace(/\s+/g, " ").trim();

const uniqueValues = (values: string[]) => {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase();
    if (!value || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const deriveTitleCandidates = (lines: string[]) =>
  uniqueValues(
    lines
      .filter((line) => line.length > 6 && line.length < 90)
      .filter((line) => /^[A-Z0-9][A-Za-z0-9 ,:()'-]+$/.test(line))
      .slice(0, 5),
  );

const deriveHeadingCandidates = (lines: string[]) =>
  uniqueValues(
    lines
      .filter((line) => line.length > 4 && line.length < 80)
      .filter(
        (line) =>
          /^[A-Z][A-Za-z0-9 ,:()'-]+$/.test(line) &&
          line.split(" ").length <= 8 &&
          !line.endsWith("."),
      )
      .slice(0, 12),
  );

const deriveQuestionCandidates = (lines: string[]) =>
  uniqueValues(lines.filter((line) => line.includes("?")).slice(0, 12));

const deriveQuestionCandidatesFromPages = (pageQuestions: string[]) =>
  uniqueValues(
    pageQuestions
      .flatMap((pageQuestion) => pageQuestion.split(/\n+/))
      .map(cleanLine)
      .filter(Boolean)
      .slice(0, 24),
  );

const deriveDocumentFields = (pageTexts: string[]) => {
  const extractedText = pageTexts
    .map((pageText) => cleanLine(pageText))
    .filter(Boolean)
    .join("\n\n");
  const lines = extractedText.split(/\n+/).map(cleanLine).filter(Boolean);

  return {
    extractedText,
    titleCandidates: deriveTitleCandidates(lines),
    headingCandidates: deriveHeadingCandidates(lines),
    questionCandidates: deriveQuestionCandidates(lines),
  };
};

const sentenceSplit = (text: string) =>
  text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => cleanLine(sentence))
    .filter(Boolean);

const formatCostCents = (value: number) =>
  `${value.toFixed(value < 0.1 ? 3 : 2)}c`;

const questionsToEditorText = (
  pageQuestionDetails: Array<LessonPageQuestionItem[] | null>,
) =>
  pageQuestionDetails
    .map((pageItems, index) => {
      if (!pageItems?.length) {
        return "";
      }
      const formatted = pageItems
        .map((item) =>
          [
            item.label ? `${item.label} ${item.question}` : item.question,
            ...item.answerOptions,
          ]
            .map(cleanLine)
            .filter(Boolean)
            .join("\n"),
        )
        .filter(Boolean)
        .join("\n\n");
      return formatted ? `Page ${index + 1}\n${formatted}` : "";
    })
    .filter(Boolean)
    .join("\n\n");

const normalizeQuestionNumber = (rawNumber: string) => {
  if (/^[Il]$/i.test(rawNumber)) {
    return 1;
  }
  const parsed = Number(rawNumber);
  return Number.isFinite(parsed) ? parsed : null;
};

const getQuestionNumber = (question: string) => {
  const match = question.match(/^\s*((?:\d+|[Il]))\.\s+/);
  if (!match) {
    return null;
  }
  return normalizeQuestionNumber(match[1]);
};

const stripQuestionPrefix = (question: string) =>
  question.replace(/^\s*(?:\d+|[Il])\.\s+/, "").trim();

const splitPageTextIntoQuestions = (pageText: string) => {
  const normalized = String(pageText || "")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!normalized) {
    return [];
  }

  return normalized
    .split(/(?=^\s*(?:\d+|[Il])\.\s+)/m)
    .map((chunk) => chunk.trim())
    .filter((chunk) => Boolean(chunk) && /^\s*(?:\d+|[Il])\.\s+/.test(chunk));
};

const summarizeQuestion = (question: string, maxChars = 80) => {
  const singleLine = cleanLine(stripQuestionPrefix(question));
  if (singleLine.length <= maxChars) {
    return singleLine;
  }
  return `${singleLine.slice(0, Math.max(1, maxChars - 3)).trim()}...`;
};

const buildApprovedQuestionPages = (
  documents: SourceDocument[],
): ApprovedQuestionPage[] =>
  documents.flatMap((document) =>
    document.pageTextQuestions.flatMap((questions, pageIndex) => {
      const states = document.pageTextQuestionStates[pageIndex] || [];
      const approvedPairs = questions
        .map((question, questionIndex) => ({ question, questionIndex }))
        .filter(({ questionIndex }) => states[questionIndex] === "accepted");
      const approvedQuestions = approvedPairs.map(({ question }) => question);
      if (approvedQuestions.length === 0) {
        return [];
      }
      return [
        {
          sourceDocumentId: document.id,
          pageNumber: pageIndex + 1,
          title: document.pageTitles[pageIndex] ?? null,
          detectedPageNumber: document.pageNumbers[pageIndex] ?? null,
          questions: approvedQuestions,
          questionIndexes: approvedPairs.map(
            ({ questionIndex }) => questionIndex,
          ),
          states: approvedQuestions.map(() => "accepted" as const),
        },
      ];
    }),
  );

const QuestionsAccordionList = ({
  page,
  fullscreen = false,
  onUpdateQuestion,
  onUpdateQuestionState,
  onUpdatePageTitle,
  onUpdatePageNumber,
  summaryMaxChars = 80,
}: {
  page: {
    pageNumber: number;
    title?: string | null;
    detectedPageNumber?: number | null;
    questions: string[];
    questionIndexes?: number[];
    states: QuestionReviewState[];
  } | null;
  fullscreen?: boolean;
  onUpdateQuestion?: (
    pageNumber: number,
    questionIndex: number,
    nextValue: string,
  ) => void;
  onUpdateQuestionState?: (
    pageNumber: number,
    questionIndex: number,
    nextState: QuestionReviewState,
  ) => void;
  onUpdatePageTitle?: (pageNumber: number, nextTitle: string) => void;
  onUpdatePageNumber?: (pageNumber: number, nextValue: string) => void;
  summaryMaxChars?: number;
}) => {
  const hasQuestions = Boolean(page?.questions.length);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingPageNumber, setIsEditingPageNumber] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [pageNumberDraft, setPageNumberDraft] = useState("");
  const editorRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  useEffect(() => {
    setTitleDraft(page?.title || "");
    setPageNumberDraft(
      page?.detectedPageNumber != null ? String(page.detectedPageNumber) : "",
    );
    setIsEditingTitle(false);
    setIsEditingPageNumber(false);
  }, [page?.pageNumber, page?.title, page?.detectedPageNumber]);

  const runEditorCommand = (key: string, command: "undo" | "redo") => {
    const editor = editorRefs.current[key];
    if (!editor) {
      return;
    }
    editor.focus();
    document.execCommand(command);
  };

  const wrapSelection = (
    key: string,
    prefix: string,
    suffix = prefix,
    placeholder = "text",
  ) => {
    const editor = editorRefs.current[key];
    if (!editor || !page) {
      return;
    }
    const selectionStart = editor.selectionStart ?? 0;
    const selectionEnd = editor.selectionEnd ?? 0;
    const currentValue = editor.value;
    const selectedText =
      currentValue.slice(selectionStart, selectionEnd) || placeholder;
    const nextValue =
      currentValue.slice(0, selectionStart) +
      prefix +
      selectedText +
      suffix +
      currentValue.slice(selectionEnd);
    const [pageNumberText, questionIndexText] = key.split("_");
    onUpdateQuestion?.(
      Number(pageNumberText),
      Number(questionIndexText),
      nextValue,
    );
    queueMicrotask(() => {
      const nextEditor = editorRefs.current[key];
      if (!nextEditor) {
        return;
      }
      nextEditor.focus();
      const cursorStart = selectionStart + prefix.length;
      const cursorEnd = cursorStart + selectedText.length;
      nextEditor.setSelectionRange(cursorStart, cursorEnd);
    });
  };

  const prefixSelectionLines = (key: string, prefix: string) => {
    const editor = editorRefs.current[key];
    if (!editor || !page) {
      return;
    }
    const selectionStart = editor.selectionStart ?? 0;
    const selectionEnd = editor.selectionEnd ?? 0;
    const currentValue = editor.value;
    const start = currentValue.lastIndexOf("\n", selectionStart - 1) + 1;
    const endBreak = currentValue.indexOf("\n", selectionEnd);
    const end = endBreak === -1 ? currentValue.length : endBreak;
    const block = currentValue.slice(start, end);
    const nextBlock = block
      .split("\n")
      .map((line) => `${prefix}${line}`)
      .join("\n");
    const nextValue =
      currentValue.slice(0, start) + nextBlock + currentValue.slice(end);
    const [pageNumberText, questionIndexText] = key.split("_");
    onUpdateQuestion?.(
      Number(pageNumberText),
      Number(questionIndexText),
      nextValue,
    );
    queueMicrotask(() => {
      const nextEditor = editorRefs.current[key];
      nextEditor?.focus();
    });
  };

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        overflowY: "auto",
        overflowX: "hidden",
        p: 1.5,
        pt: fullscreen ? 4 : 2.5,
      }}
    >
      <Stack
        spacing={1.25}
        sx={{
          minWidth: 0,
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box",
        }}
      >
        {page ? (
          <Stack
            spacing={1}
            sx={{
              minWidth: 0,
              width: "100%",
              maxWidth: "100%",
              boxSizing: "border-box",
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1,
                px: 0.5,
              }}
            >
              {isEditingTitle ? (
                <TextField
                  fullWidth
                  autoFocus
                  variant="standard"
                  value={titleDraft}
                  onChange={(event) => setTitleDraft(event.target.value)}
                  onBlur={() => {
                    onUpdatePageTitle?.(page.pageNumber, titleDraft);
                    setIsEditingTitle(false);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      onUpdatePageTitle?.(page.pageNumber, titleDraft);
                      setIsEditingTitle(false);
                    }
                    if (event.key === "Escape") {
                      setTitleDraft(page.title || "");
                      setIsEditingTitle(false);
                    }
                  }}
                  placeholder="Page title"
                  InputProps={{
                    disableUnderline: true,
                    sx: {
                      px: 1.25,
                      py: 0.75,
                      fontSize: fullscreen ? "1.05rem" : "0.92rem",
                      fontWeight: 800,
                      color: "text.primary",
                      backgroundColor: "rgba(0,0,0,0.03)",
                      borderRadius: "999px",
                    },
                  }}
                  inputProps={{ sx: { p: 0 } }}
                />
              ) : (
                <Box
                  sx={{
                    minWidth: 0,
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    px: 1.25,
                    py: 0.75,
                    backgroundColor: "rgba(0,0,0,0.03)",
                    borderRadius: "999px",
                  }}
                >
                  <Typography
                    sx={{
                      minWidth: 0,
                      flex: 1,
                      fontSize: fullscreen ? "1.05rem" : "0.92rem",
                      fontWeight: 800,
                      color: "text.primary",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {page.title || "-"}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => setIsEditingTitle(true)}
                    sx={{ p: 0.35 }}
                  >
                    <EditRoundedIcon fontSize="small" />
                  </IconButton>
                </Box>
              )}
            </Box>
            {hasQuestions
              ? page.questions.map((question, index) => {
                  const questionNumber =
                    getQuestionNumber(question) ?? index + 1;
                  const sourceQuestionIndex =
                    page.questionIndexes?.[index] ?? index;
                  const questionKey = `${page.pageNumber}_${sourceQuestionIndex}`;
                  const isEditing = editingKey === questionKey;
                  const reviewState = page.states[index] || "untouched";
                  const badgeColor =
                    reviewState === "accepted" ? "#2e7d32" : "#9e9e9e";
                  const titleColor =
                    reviewState === "accepted" ? "inherit" : "rgba(0,0,0,0.42)";
                  return (
                    <Accordion
                      key={questionKey}
                      disableGutters
                      elevation={0}
                      sx={{
                        borderRadius: 0,
                        overflow: "hidden",
                        width: "100%",
                        maxWidth: "100%",
                        minWidth: 0,
                        boxSizing: "border-box",
                        boxShadow: "none",
                        backgroundColor: "transparent",
                        "&:before": { display: "none" },
                        "&:not(:last-of-type)": {
                          borderBottom: "1px solid rgba(0,0,0,0.08)",
                        },
                      }}
                    >
                      <AccordionSummary
                        expandIcon={<ExpandMoreRoundedIcon />}
                        sx={{
                          width: "100%",
                          minWidth: 0,
                          overflow: "hidden",
                          pr: 6,
                          position: "relative",
                          borderRadius: 0,
                          backgroundColor: "transparent",
                          "& .MuiAccordionSummary-content": {
                            minWidth: 0,
                            my: 1.25,
                            overflow: "hidden",
                          },
                          "& .MuiAccordionSummary-expandIconWrapper": {
                            position: "absolute",
                            right: 8,
                            top: "50%",
                            transform: "translateY(-50%)",
                          },
                        }}
                      >
                        <Stack
                          direction="row"
                          spacing={0.75}
                          alignItems="center"
                          sx={{
                            minWidth: 0,
                            width: "100%",
                            overflow: "hidden",
                          }}
                        >
                          <Box
                            sx={{
                              width: 26,
                              height: 26,
                              borderRadius: "999px",
                              bgcolor: badgeColor,
                              color: "#fff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "0.82rem",
                              fontWeight: 800,
                              flexShrink: 0,
                            }}
                          >
                            {questionNumber}
                          </Box>
                          <Typography
                            component="div"
                            sx={{
                              fontWeight: 700,
                              minWidth: 0,
                              flex: 1,
                              display: "block",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              color: titleColor,
                            }}
                          >
                            {summarizeQuestion(question, summaryMaxChars)}
                          </Typography>
                          <Stack
                            direction="row"
                            spacing={0}
                            alignItems="center"
                            sx={{
                              position: "absolute",
                              right: 36,
                              top: "50%",
                              transform: "translateY(-50%)",
                              zIndex: 1,
                            }}
                          >
                            <IconButton
                              size="small"
                              onClick={(event) => {
                                event.stopPropagation();
                                onUpdateQuestionState?.(
                                  page.pageNumber,
                                  sourceQuestionIndex,
                                  reviewState === "accepted"
                                    ? "untouched"
                                    : "accepted",
                                );
                              }}
                              sx={{
                                color:
                                  reviewState === "accepted"
                                    ? "#2e7d32"
                                    : "#bdbdbd",
                                p: 0.35,
                              }}
                            >
                              <CheckRoundedIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={(event) => {
                                event.stopPropagation();
                                setEditingKey((current) =>
                                  current === questionKey ? null : questionKey,
                                );
                              }}
                              disabled={isEditing}
                              sx={{
                                color: isEditing
                                  ? "action.disabled"
                                  : "text.secondary",
                                p: 0.35,
                              }}
                            >
                              <EditRoundedIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                        </Stack>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Stack spacing={1.25}>
                          {isEditing ? (
                            <Box
                              sx={{
                                border: "1px solid rgba(0,0,0,0.12)",
                                borderRadius: "10px",
                                overflow: "hidden",
                              }}
                            >
                              <Stack
                                direction="row"
                                spacing={0.25}
                                alignItems="center"
                                justifyContent="space-between"
                                sx={{
                                  px: 1,
                                  py: 0.75,
                                  borderBottom: "1px solid rgba(0,0,0,0.1)",
                                  backgroundColor: "#f8fafc",
                                }}
                              >
                                <Stack
                                  direction="row"
                                  spacing={0.25}
                                  alignItems="center"
                                >
                                  <IconButton
                                    size="small"
                                    onClick={() =>
                                      wrapSelection(questionKey, "**")
                                    }
                                  >
                                    <FormatBoldRoundedIcon fontSize="small" />
                                  </IconButton>
                                  <IconButton
                                    size="small"
                                    onClick={() =>
                                      wrapSelection(questionKey, "_")
                                    }
                                  >
                                    <FormatItalicRoundedIcon fontSize="small" />
                                  </IconButton>
                                  <IconButton
                                    size="small"
                                    onClick={() =>
                                      prefixSelectionLines(questionKey, "> ")
                                    }
                                  >
                                    <FormatQuoteRoundedIcon fontSize="small" />
                                  </IconButton>
                                  <IconButton
                                    size="small"
                                    onClick={() =>
                                      wrapSelection(questionKey, "`")
                                    }
                                  >
                                    <CodeRoundedIcon fontSize="small" />
                                  </IconButton>
                                  <IconButton
                                    size="small"
                                    onClick={() =>
                                      wrapSelection(
                                        questionKey,
                                        "[",
                                        "](https://example.com)",
                                        "link text",
                                      )
                                    }
                                  >
                                    <LinkRoundedIcon fontSize="small" />
                                  </IconButton>
                                  <IconButton
                                    size="small"
                                    onClick={() =>
                                      prefixSelectionLines(questionKey, "- ")
                                    }
                                  >
                                    <FormatListBulletedRoundedIcon fontSize="small" />
                                  </IconButton>
                                  <IconButton
                                    size="small"
                                    onClick={() =>
                                      prefixSelectionLines(questionKey, "1. ")
                                    }
                                  >
                                    <FormatListNumberedRoundedIcon fontSize="small" />
                                  </IconButton>
                                  <IconButton
                                    size="small"
                                    onClick={() =>
                                      runEditorCommand(questionKey, "undo")
                                    }
                                  >
                                    <UndoRoundedIcon fontSize="small" />
                                  </IconButton>
                                  <IconButton
                                    size="small"
                                    onClick={() =>
                                      runEditorCommand(questionKey, "redo")
                                    }
                                  >
                                    <RedoRoundedIcon fontSize="small" />
                                  </IconButton>
                                </Stack>
                                <IconButton
                                  size="small"
                                  onClick={() => setEditingKey(null)}
                                >
                                  <CloseRoundedIcon fontSize="small" />
                                </IconButton>
                              </Stack>
                              <TextField
                                multiline
                                fullWidth
                                minRows={8}
                                value={question}
                                onChange={(event) =>
                                  onUpdateQuestion?.(
                                    page.pageNumber,
                                    sourceQuestionIndex,
                                    event.target.value,
                                  )
                                }
                                inputRef={(element) => {
                                  editorRefs.current[questionKey] = element;
                                }}
                                spellCheck={false}
                                variant="standard"
                                InputProps={{
                                  disableUnderline: true,
                                  sx: {
                                    px: 1.5,
                                    py: 1.25,
                                    fontFamily:
                                      '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
                                    fontSize: "0.95rem",
                                    alignItems: "flex-start",
                                  },
                                }}
                              />
                            </Box>
                          ) : (
                            <Typography
                              sx={{
                                whiteSpace: "pre-wrap",
                                lineHeight: 1.6,
                                overflowWrap: "anywhere",
                                wordBreak: "break-word",
                              }}
                            >
                              {stripQuestionPrefix(question)}
                            </Typography>
                          )}
                        </Stack>
                      </AccordionDetails>
                    </Accordion>
                  );
                })
              : null}
          </Stack>
        ) : null}
        {!hasQuestions ? (
          <Box
            sx={{
              minHeight: 220,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Typography color="text.secondary">
              No questions for this page.
            </Typography>
          </Box>
        ) : null}
        {page ? (
          <Box sx={{ display: "flex", justifyContent: "flex-end", pt: 0.5 }}>
            {isEditingPageNumber ? (
              <TextField
                autoFocus
                variant="standard"
                value={pageNumberDraft}
                onChange={(event) =>
                  setPageNumberDraft(
                    event.target.value.replace(/[^\d]/g, "").slice(0, 3),
                  )
                }
                onBlur={() => {
                  onUpdatePageNumber?.(page.pageNumber, pageNumberDraft);
                  setIsEditingPageNumber(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onUpdatePageNumber?.(page.pageNumber, pageNumberDraft);
                    setIsEditingPageNumber(false);
                  }
                  if (event.key === "Escape") {
                    setPageNumberDraft(
                      page.detectedPageNumber != null
                        ? String(page.detectedPageNumber)
                        : "",
                    );
                    setIsEditingPageNumber(false);
                  }
                }}
                InputProps={{
                  disableUnderline: true,
                  sx: {
                    minWidth: 62,
                    height: 42,
                    px: 1,
                    bgcolor: "#4fa3e3",
                    color: "#fff",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: "1rem",
                    lineHeight: 1,
                    "& input": {
                      p: 0,
                      textAlign: "center",
                      color: "#fff",
                      fontWeight: 800,
                    },
                  },
                }}
              />
            ) : (
              <Box
                sx={{
                  minWidth: 62,
                  height: 42,
                  px: 1,
                  bgcolor: "#4fa3e3",
                  color: "#fff",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 0.35,
                }}
              >
                <Typography
                  sx={{ fontWeight: 800, fontSize: "1rem", lineHeight: 1 }}
                >
                  {page.detectedPageNumber != null
                    ? page.detectedPageNumber
                    : "-"}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => setIsEditingPageNumber(true)}
                  sx={{ color: "#fff", p: 0.2 }}
                >
                  <EditRoundedIcon sx={{ fontSize: "0.95rem" }} />
                </IconButton>
              </Box>
            )}
          </Box>
        ) : null}
      </Stack>
    </Box>
  );
};

const ApprovedQuestionsReview = ({
  pages,
  onUpdateQuestion,
  onUpdateQuestionState,
  onUpdatePageTitle,
  onUpdatePageNumber,
}: {
  pages: ApprovedQuestionPage[];
  onUpdateQuestion: (
    documentId: string,
    pageNumber: number,
    questionIndex: number,
    nextValue: string,
  ) => void;
  onUpdateQuestionState: (
    documentId: string,
    pageNumber: number,
    questionIndex: number,
    nextState: QuestionReviewState,
  ) => void;
  onUpdatePageTitle: (
    documentId: string,
    pageNumber: number,
    nextTitle: string,
  ) => void;
  onUpdatePageNumber: (
    documentId: string,
    pageNumber: number,
    nextValue: string,
  ) => void;
}) => {
  if (pages.length === 0) {
    return (
      <Alert severity="info">
        Approve questions in the source step to review them here.
      </Alert>
    );
  }

  return (
    <Stack spacing={2.5}>
      {pages.map((page) => (
        <Box key={`${page.sourceDocumentId}_${page.pageNumber}`}>
          <QuestionsAccordionList
            page={page}
            summaryMaxChars={150}
            onUpdateQuestion={(pageNumber, questionIndex, nextValue) =>
              onUpdateQuestion(
                page.sourceDocumentId,
                pageNumber,
                questionIndex,
                nextValue,
              )
            }
            onUpdateQuestionState={(pageNumber, questionIndex, nextState) =>
              onUpdateQuestionState(
                page.sourceDocumentId,
                pageNumber,
                questionIndex,
                nextState,
              )
            }
            onUpdatePageTitle={(pageNumber, nextTitle) =>
              onUpdatePageTitle(page.sourceDocumentId, pageNumber, nextTitle)
            }
            onUpdatePageNumber={(pageNumber, nextValue) =>
              onUpdatePageNumber(page.sourceDocumentId, pageNumber, nextValue)
            }
          />
        </Box>
      ))}
    </Stack>
  );
};

const formatJsonScalar = (value: unknown) => {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value === null) {
    return "null";
  }
  return "";
};

const JsonValueNode = ({
  data,
  label,
  depth = 0,
  expandAll,
  showKeys,
}: JsonNodeProps) => {
  const isArray = Array.isArray(data);
  const isObject = Boolean(data) && typeof data === "object" && !isArray;
  const expandable = isArray || isObject;
  const [open, setOpen] = useState(expandAll);

  useEffect(() => {
    setOpen(expandAll);
  }, [expandAll]);

  if (!expandable) {
    return (
      <Box sx={{ pl: depth ? 2 : 0, py: 0.35 }}>
        <Typography
          component="div"
          sx={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: "0.95rem",
            whiteSpace: "pre-wrap",
            color: "#1f1f1f",
          }}
        >
          {showKeys && label ? `${label}: ` : ""}
          {formatJsonScalar(data)}
        </Typography>
      </Box>
    );
  }

  const entries = isArray
    ? (data as unknown[]).map((value, index) => [String(index), value] as const)
    : Object.entries(data as Record<string, unknown>);

  return (
    <Box sx={{ pl: depth ? 2 : 0, py: 0.25 }}>
      <Button
        variant="text"
        size="small"
        onClick={() => setOpen((current) => !current)}
        sx={{
          minWidth: 0,
          px: 0,
          py: 0.25,
          textTransform: "none",
          justifyContent: "flex-start",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          color: "#1f1f1f",
          fontWeight: 700,
        }}
      >
        {open ? "[-]" : "[+]"}{" "}
        {showKeys && label ? label : isArray ? `[${entries.length}]` : "{...}"}
      </Button>
      {open ? (
        <Box sx={{ mt: 0.25 }}>
          {entries.map(([key, value]) => (
            <JsonValueNode
              key={`${label || "root"}_${key}`}
              data={value}
              label={isArray ? undefined : key}
              depth={depth + 1}
              expandAll={expandAll}
              showKeys={showKeys}
            />
          ))}
        </Box>
      ) : null}
    </Box>
  );
};

const QuestionsJsonViewer = ({
  data,
}: {
  data: Array<{ pageNumber: number; questions: string[] }>;
}) => {
  const [expandAll, setExpandAll] = useState(true);
  const [showKeys, setShowKeys] = useState(false);

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 1,
          px: 1.5,
          py: 1,
          borderBottom: "1px solid rgba(0,0,0,0.08)",
        }}
      >
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => setExpandAll(true)}
          >
            Expand all
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => setExpandAll(false)}
          >
            Collapse all
          </Button>
        </Stack>
        <Button
          size="small"
          variant="outlined"
          onClick={() => setShowKeys((current) => !current)}
        >
          {showKeys ? "Hide keys" : "View keys"}
        </Button>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", px: 1.5, py: 1 }}>
        {data.length ? (
          <JsonValueNode
            data={data}
            expandAll={expandAll}
            showKeys={showKeys}
          />
        ) : (
          <Typography
            color="text.secondary"
            sx={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            }}
          >
            No extracted questions yet.
          </Typography>
        )}
      </Box>
    </Box>
  );
};

const buildConceptsFromDocs = (documents: SourceDocument[]): ConceptDraft[] => {
  const headings = uniqueValues(
    documents.flatMap((document) => document.headingCandidates),
  );
  const concepts = (
    headings.length
      ? headings
      : documents.flatMap((document) => document.titleCandidates)
  )
    .slice(0, 6)
    .map((title) => ({
      id: createId("concept"),
      title,
      synopsis: `Focus on ${title.toLowerCase()} and confirm the scope before drafting sections.`,
      approved: true,
    }));
  if (concepts.length) {
    return concepts;
  }
  return [
    {
      id: createId("concept"),
      title: "Core Idea 1",
      synopsis: "Replace this with the first agreed teaching concept.",
      approved: true,
    },
  ];
};

const buildSectionsFromConcepts = (
  concepts: ConceptDraft[],
  documents: SourceDocument[],
): SectionDraft[] => {
  const sourceText = documents
    .map((document) => document.extractedText)
    .join("\n\n");
  const sentences = sentenceSplit(sourceText);
  const fallbackQuestions = uniqueValues(
    documents.flatMap((document) => document.questionCandidates),
  );

  return concepts
    .filter((concept) => concept.approved)
    .map((concept, index) => {
      const conceptWord = concept.title.toLowerCase().split(" ")[0] || "";
      const synopsisSentence =
        sentences.find((sentence) =>
          sentence.toLowerCase().includes(conceptWord),
        ) ||
        sentences[index] ||
        concept.synopsis;
      const relatedQuestions = fallbackQuestions
        .filter((question) => question.toLowerCase().includes(conceptWord))
        .slice(0, 3);

      return {
        id: createId("section"),
        conceptId: concept.id,
        title: concept.title,
        synopsis: synopsisSentence,
        teachingNotes:
          relatedQuestions.length > 0
            ? `Start with the source material, then use these prompts to guide discussion about ${concept.title.toLowerCase()}.`
            : `Use the source text to introduce ${concept.title.toLowerCase()}, then add examples and checks for understanding.`,
        questions:
          relatedQuestions.length > 0
            ? relatedQuestions
            : [
                `What is the main idea behind ${concept.title}?`,
                `How would you explain ${concept.title} in your own words?`,
              ],
      };
    });
};

const loadDraft = (lessonId: string): BuilderDraft => {
  try {
    const raw = window.localStorage.getItem(getStorageKey(lessonId));
    if (!raw) {
      return emptyDraft();
    }
    const parsed = JSON.parse(raw) as BuilderDraft;
    return {
      ...emptyDraft(),
      ...parsed,
      sourceDocuments: Array.isArray(parsed.sourceDocuments)
        ? parsed.sourceDocuments.map((document) => {
            const typed = document as SourceDocument;
            const pageTexts = Array.isArray(typed.pageTexts)
              ? typed.pageTexts
              : typeof typed.extractedText === "string"
                ? typed.extractedText.split(/\n\n+/).filter(Boolean)
                : [];
            const pageCount = pageTexts.length || typed.pages || 0;
            const pageTextQuestions = Array.isArray(
              (typed as SourceDocument).pageTextQuestions,
            )
              ? (typed as SourceDocument).pageTextQuestions.map((entry) =>
                  Array.isArray(entry)
                    ? entry.map((value) => String(value).trim()).filter(Boolean)
                    : [],
                )
              : Array.from({ length: pageCount }, () => []);
            const pageTextQuestionStates = Array.isArray(
              (typed as SourceDocument).pageTextQuestionStates,
            )
              ? (typed as SourceDocument).pageTextQuestionStates.map((entry) =>
                  Array.isArray(entry)
                    ? entry.map((value) =>
                        value === "accepted" || value === "rejected"
                          ? value
                          : "untouched",
                      )
                    : [],
                )
              : Array.from({ length: pageCount }, () => []);
            const pageTitles = Array.isArray(
              (typed as SourceDocument).pageTitles,
            )
              ? (typed as SourceDocument).pageTitles.map((entry) =>
                  typeof entry === "string" && entry.trim() ? entry : null,
                )
              : Array.from({ length: pageCount }, () => null);
            const pageNumbers = Array.isArray(
              (typed as SourceDocument).pageNumbers,
            )
              ? (typed as SourceDocument).pageNumbers.map((entry) =>
                  typeof entry === "number" && Number.isFinite(entry)
                    ? entry
                    : null,
                )
              : Array.from({ length: pageCount }, () => null);
            const pageQuestions = Array.isArray(typed.pageQuestions)
              ? typed.pageQuestions
              : Array.from({ length: pageCount }, () => "");
            const pageQuestionDetails = Array.isArray(typed.pageQuestionDetails)
              ? typed.pageQuestionDetails.map((entry) =>
                  Array.isArray(entry)
                    ? entry
                        .filter((item) => item && typeof item === "object")
                        .map((item) => {
                          const typedItem = item as LessonPageQuestionItem;
                          return {
                            label: String(typedItem.label ?? "").trim(),
                            question: String(typedItem.question ?? "").trim(),
                            answerOptions: Array.isArray(
                              typedItem.answerOptions,
                            )
                              ? typedItem.answerOptions
                                  .map((value) => String(value).trim())
                                  .filter(Boolean)
                              : [],
                          };
                        })
                    : null,
                )
              : Array.from({ length: pageCount }, () => null);
            const pageQuestionUsage = Array.isArray(typed.pageQuestionUsage)
              ? typed.pageQuestionUsage.map((entry) =>
                  entry && typeof entry === "object"
                    ? (entry as PageQuestionUsageRecord)
                    : null,
                )
              : Array.from({ length: pageCount }, () => null);
            return {
              ...typed,
              pageTitles: Array.from(
                { length: pageCount },
                (_, index) => pageTitles[index] ?? null,
              ),
              pageNumbers: Array.from(
                { length: pageCount },
                (_, index) => pageNumbers[index] ?? null,
              ),
              pageTexts,
              pageTextQuestions: Array.from(
                { length: pageCount },
                (_, index) => pageTextQuestions[index] || [],
              ),
              pageTextQuestionStates: Array.from(
                { length: pageCount },
                (_, index) => pageTextQuestionStates[index] || [],
              ),
              pageQuestions: Array.from(
                { length: pageCount },
                (_, index) => pageQuestions[index] || "",
              ),
              pageQuestionDetails: Array.from(
                { length: pageCount },
                (_, index) => pageQuestionDetails[index] || null,
              ),
              pageQuestionUsage: Array.from(
                { length: pageCount },
                (_, index) => pageQuestionUsage[index] || null,
              ),
            };
          })
        : [],
      concepts: Array.isArray(parsed.concepts) ? parsed.concepts : [],
      sections: Array.isArray(parsed.sections) ? parsed.sections : [],
    };
  } catch {
    return emptyDraft();
  }
};

const stepSkills: Record<StepKey, SkillRef[]> = {
  source: [
    {
      id: "upload_source_document",
      label: "Upload Source Document",
      kind: "compute",
    },
    {
      id: "extract_document_structure",
      label: "Extract Document Structure",
      kind: "compute",
    },
    {
      id: "extract_page_questions_ai",
      label: "Extract Page Questions AI",
      kind: "ai_driven",
    },
  ],
  concepts: [
    { id: "confirm_questions", label: "Confirm Questions", kind: "compute" },
  ],
};

const EmptyState = ({ hasLessons }: { hasLessons: boolean }) => (
  <Box
    sx={{
      minHeight: "65vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 1,
      color: "text.secondary",
    }}
  >
    <Typography variant="h4" fontWeight={700}>
      {hasLessons
        ? "Select a lesson template"
        : "Create your first lesson template"}
    </Typography>
    <Typography>
      The new teacher workflow starts from source material, concepts, and
      section drafts.
    </Typography>
  </Box>
);

const SkillLinks = ({ skills }: { skills: SkillRef[] }) => (
  <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
    {skills.map((skill) => (
      <Box
        key={skill.id}
        component="a"
        href={`/skill?skill=${skill.id}`}
        onClick={(event: MouseEvent<HTMLAnchorElement>) =>
          event.stopPropagation()
        }
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.5,
          borderRadius: "999px",
          border: "1px solid rgba(0,0,0,0.12)",
          px: 1,
          py: 0.35,
          fontSize: "0.75rem",
          fontWeight: 700,
          color: "text.secondary",
          textDecoration: "none",
          backgroundColor: "transparent",
        }}
      >
        {skill.kind === "ai_driven" ? (
          <PsychologyRoundedIcon sx={{ fontSize: 14 }} />
        ) : (
          <MemoryRoundedIcon sx={{ fontSize: 14 }} />
        )}
        <span>{skill.label}</span>
      </Box>
    ))}
  </Stack>
);

const StepShell = ({
  stepNumber,
  label,
  expanded,
  complete,
  inProgress = false,
  enabled,
  showConnector,
  onToggle,
  onRerun,
  skills,
  children,
}: {
  stepNumber: number;
  label: string;
  expanded: boolean;
  complete: boolean;
  inProgress?: boolean;
  enabled: boolean;
  showConnector: boolean;
  onToggle: () => void;
  onRerun: () => void;
  skills: SkillRef[];
  children: ReactNode;
}) => {
  const circleColor = complete ? "#2e7d32" : inProgress ? "#ef6c00" : "#bdbdbd";

  return (
    <Box sx={{ display: "flex", alignItems: "stretch" }}>
      <Box
        sx={{
          width: 42,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <Box
          sx={{
            width: 34,
            height: 34,
            borderRadius: "999px",
            bgcolor: circleColor,
            color: "common.white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: "1.15rem",
            mt: 0.5,
          }}
        >
          {stepNumber}
        </Box>
        {showConnector ? (
          <Box
            sx={{
              width: 3,
              flex: 1,
              minHeight: 40,
              bgcolor: circleColor,
              mt: 0,
              mb: "-1.8rem",
            }}
          />
        ) : null}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0, pb: 1, pl: "1rem" }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            minHeight: 34,
          }}
        >
          <Box
            role="button"
            onClick={() => {
              if (enabled) {
                onToggle();
              }
            }}
            sx={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              cursor: enabled ? "pointer" : "default",
              color: enabled ? "text.primary" : "text.disabled",
              userSelect: "none",
            }}
          >
            <Typography
              fontWeight={800}
              sx={{ fontSize: "1.35rem", lineHeight: 1.1 }}
            >
              {label}
            </Typography>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <SkillLinks skills={skills} />
            </Box>
            <ExpandMoreRoundedIcon
              sx={{
                transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.18s ease",
                color: enabled ? "text.primary" : "text.disabled",
              }}
            />
          </Box>
          <IconButton
            onClick={onRerun}
            disabled={!enabled}
            sx={{ color: enabled ? "text.secondary" : "text.disabled" }}
          >
            <RefreshRoundedIcon />
          </IconButton>
        </Box>
        <Collapse in={expanded} timeout={320} unmountOnExit>
          <Box sx={{ pt: 2.5 }}>
            <Box sx={{ pt: 0.5 }}>{children}</Box>
          </Box>
        </Collapse>
        <Divider sx={{ mt: 2.5, mb: 2.5 }} />
      </Box>
    </Box>
  );
};

const PdfPreviewCanvas = ({
  url,
  title,
  pageNumber,
  fullscreen = false,
  toolbarControls,
  fillHeight = false,
}: {
  url: string;
  title: string;
  pageNumber: number;
  fullscreen?: boolean;
  toolbarControls?: ReactNode;
  fillHeight?: boolean;
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const renderTaskRef = useRef<{
    cancel: () => void;
    promise: Promise<unknown>;
  } | null>(null);
  const pdfPageRef = useRef<any>(null);
  const lastContainerSizeRef = useRef<{ width: number; height: number } | null>(
    null,
  );
  const lastFitZoomRef = useRef(1);
  const dragStateRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(1);
  const [fitZoom, setFitZoom] = useState(1);
  const [manualZoom, setManualZoom] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [pageSize, setPageSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    setManualZoom(false);
    lastContainerSizeRef.current = null;
    lastFitZoomRef.current = 1;
    pdfPageRef.current = null;
    setPageSize(null);
  }, [url]);

  useEffect(() => {
    let cancelled = false;
    const loadPdfPage = async () => {
      setLoading(true);
      setError("");
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const pdfWorker =
          await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker.default;
        const pdf = await pdfjs.getDocument({ url }).promise;
        const page = await pdf.getPage(pageNumber);
        const baseViewport = page.getViewport({ scale: 1 });
        if (cancelled) {
          return;
        }
        pdfPageRef.current = page;
        setPageSize({
          width: baseViewport.width,
          height: baseViewport.height,
        });
      } catch (loadError) {
        console.error("PDF preview load failed", loadError);
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load PDF preview",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadPdfPage();

    return () => {
      cancelled = true;
    };
  }, [url, pageNumber]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !pageSize) {
      return;
    }

    const computeFitZoom = () => {
      const nextWidth = container.clientWidth;
      const nextHeight = container.clientHeight;
      const lastSize = lastContainerSizeRef.current;
      if (
        lastSize &&
        Math.abs(lastSize.width - nextWidth) < 2 &&
        Math.abs(lastSize.height - nextHeight) < 2
      ) {
        return;
      }
      lastContainerSizeRef.current = { width: nextWidth, height: nextHeight };
      const horizontalPadding = 32;
      const verticalPadding = 32;
      const widthScale = Math.max(
        0.2,
        (nextWidth - horizontalPadding) / pageSize.width,
      );
      const heightScale = Math.max(
        0.2,
        (nextHeight - verticalPadding) / pageSize.height,
      );
      const nextFitZoom = Number(
        (fullscreen || fillHeight
          ? heightScale
          : Math.min(widthScale, heightScale)
        ).toFixed(2),
      );
      if (Math.abs(lastFitZoomRef.current - nextFitZoom) < 0.02) {
        return;
      }
      lastFitZoomRef.current = nextFitZoom;
      setFitZoom(nextFitZoom);
      setZoom((current) =>
        manualZoom || Math.abs(current - nextFitZoom) < 0.02
          ? current
          : nextFitZoom,
      );
    };

    computeFitZoom();
    const resizeObserver = new ResizeObserver(computeFitZoom);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [pageSize, manualZoom]);

  useEffect(() => {
    let cancelled = false;

    const renderPreview = async () => {
      const page = pdfPageRef.current;
      if (!page) {
        return;
      }
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        try {
          await renderTaskRef.current.promise;
        } catch {
          // Ignore cancellation while preparing the next render.
        }
        renderTaskRef.current = null;
      }
      setError("");
      try {
        const viewport = page.getViewport({ scale: zoom });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) {
          return;
        }
        const context = canvas.getContext("2d");
        if (!context) {
          return;
        }
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const renderTask = page.render({
          canvas,
          canvasContext: context,
          viewport,
        });
        renderTaskRef.current = renderTask;
        await renderTask.promise;
        if (renderTaskRef.current === renderTask) {
          renderTaskRef.current = null;
        }
      } catch (renderError) {
        const errorName =
          renderError &&
          typeof renderError === "object" &&
          "name" in renderError
            ? String(renderError.name)
            : "";
        if (errorName === "RenderingCancelledException") {
          return;
        }
        console.error("PDF preview render failed", renderError);
        if (!cancelled) {
          setError(
            renderError instanceof Error
              ? renderError.message
              : "Could not render PDF preview",
          );
        }
      }
    };

    void renderPreview();

    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
    };
  }, [url, zoom, pageSize]);

  const adjustZoom = (delta: number) => {
    setManualZoom(true);
    setZoom((current) =>
      Math.min(3, Math.max(0.2, Number((current + delta).toFixed(2)))),
    );
  };

  const resetZoom = () => {
    setManualZoom(false);
    setZoom(fitZoom);
    const container = containerRef.current;
    if (container) {
      container.scrollTo({ left: 0, top: 0 });
    }
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (loading || error || !containerRef.current) {
      return;
    }
    event.preventDefault();
    containerRef.current.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: containerRef.current.scrollLeft,
      scrollTop: containerRef.current.scrollTop,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    const container = containerRef.current;
    if (!dragState?.active || !container) {
      return;
    }
    event.preventDefault();
    container.scrollLeft =
      dragState.scrollLeft - (event.clientX - dragState.startX);
    container.scrollTop =
      dragState.scrollTop - (event.clientY - dragState.startY);
  };

  const handlePointerUp = (event?: React.PointerEvent<HTMLDivElement>) => {
    if (event && containerRef.current?.hasPointerCapture(event.pointerId)) {
      containerRef.current.releasePointerCapture(event.pointerId);
    }
    dragStateRef.current = null;
    setIsDragging(false);
  };

  return (
    <Box
      sx={{
        width: "100%",
        height: fullscreen || fillHeight ? "100%" : 640,
        minHeight: fullscreen || fillHeight ? "100%" : 640,
        maxHeight: fullscreen || fillHeight ? "100%" : 640,
        position: "relative",
      }}
    >
      <Stack
        direction="row"
        spacing={0.5}
        onPointerDown={(event) => event.stopPropagation()}
        sx={{
          position: "absolute",
          bottom: "0.5rem",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 2,
          width: "fit-content",
          m: 0,
          p: 0.5,
          borderRadius: "999px",
          backgroundColor: fullscreen
            ? "rgba(46,46,46,0.98)"
            : "rgba(17,17,17,0.96)",
          border: fullscreen
            ? "1px solid rgba(255,255,255,0.14)"
            : "1px solid rgba(255,255,255,0.14)",
          opacity: 0.1,
          transition: "opacity 0.18s ease",
          "&:hover": {
            opacity: 1,
          },
        }}
      >
        <IconButton
          size="small"
          onClick={() => adjustZoom(-0.15)}
          disabled={loading || Boolean(error)}
        >
          <ZoomOutRoundedIcon sx={{ color: "#fff", fontSize: 18 }} />
        </IconButton>
        <Button
          size="small"
          variant="text"
          onClick={resetZoom}
          disabled={loading || Boolean(error)}
          sx={{ minWidth: 70, color: "#fff", fontWeight: 700 }}
        >
          {Math.round(zoom * 100)}%
        </Button>
        <IconButton
          size="small"
          onClick={() => adjustZoom(0.15)}
          disabled={loading || Boolean(error)}
        >
          <ZoomInRoundedIcon sx={{ color: "#fff", fontSize: 18 }} />
        </IconButton>
        {toolbarControls ? (
          <>
            <Box
              sx={{
                width: 1,
                backgroundColor: "rgba(255,255,255,0.18)",
                mx: 0.25,
              }}
            />
            {toolbarControls}
          </>
        ) : null}
      </Stack>
      <Box
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        sx={{
          width: "100%",
          height: "100%",
          minHeight: "100%",
          maxHeight: "100%",
          borderRadius: 0,
          backgroundColor: "#fff",
          border: "none",
          overflow: "auto",
          position: "relative",
          cursor:
            loading || error ? "default" : isDragging ? "grabbing" : "grab",
          touchAction: "none",
        }}
      >
        {loading ? (
          <Stack
            spacing={1}
            alignItems="center"
            sx={{
              color: "rgba(0,0,0,0.68)",
              minHeight: fullscreen ? "calc(100vh - 140px)" : 640,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "absolute",
              inset: 0,
              zIndex: 1,
              backgroundColor: "rgba(255,255,255,0.82)",
            }}
          >
            <CircularProgress size={22} color="inherit" />
            <Typography sx={{ fontSize: "0.95rem", fontWeight: 700 }}>
              Rendering PDF…
            </Typography>
          </Stack>
        ) : null}
        {!loading && error ? (
          <Stack
            spacing={1}
            alignItems="center"
            sx={{
              color: "rgba(0,0,0,0.68)",
              px: 3,
              minHeight: fullscreen ? "calc(100vh - 140px)" : 640,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Typography
              sx={{ fontSize: "0.98rem", fontWeight: 800, color: "#111" }}
            >
              Preview unavailable
            </Typography>
            <Typography sx={{ fontSize: "0.9rem", textAlign: "center" }}>
              {error}
            </Typography>
          </Stack>
        ) : null}
        <Box
          component="canvas"
          ref={canvasRef}
          title={title}
          sx={{
            display: error ? "none" : "block",
            m: fullscreen ? 0 : "0 auto 1rem",
            borderRadius: fullscreen ? 0 : "0.75rem",
            backgroundColor: "#fff",
          }}
        />
      </Box>
    </Box>
  );
};

const LessonWorkspace = ({
  lesson,
  hasLessons,
  onCreateLesson,
  onDuplicateLesson,
  onDeleteLesson,
  showDelete,
  onUpdateTitle,
  onUpdateContent,
  onUpdateStatus,
  getAccessTokenSilently,
  onNotify,
}: LessonWorkspaceProps) => {
  const apiBaseUrl = import.meta.env.VITE_TEACHNLEARN_API || "";
  const auth0Audience = import.meta.env.VITE_AUTH0_AUDIENCE || "";
  const previewUrlsRef = useRef<string[]>([]);
  const sourcePaneRef = useRef<HTMLDivElement | null>(null);
  const sourceFullscreenRef = useRef<HTMLDivElement | null>(null);
  const [draft, setDraft] = useState<BuilderDraft>(emptyDraft);
  const [titleDraft, setTitleDraft] = useState("");
  const [summaryDraft, setSummaryDraft] = useState("");
  const [previewDocuments, setPreviewDocuments] = useState<PreviewDocument[]>(
    [],
  );
  const [activePreviewId, setActivePreviewId] = useState<string | null>(null);
  const [activePreviewPage, setActivePreviewPage] = useState(1);
  const [analyzingDocument, setAnalyzingDocument] = useState(false);
  const [localOcringDocument, setLocalOcringDocument] = useState(false);
  const [localOcrProgress, setLocalOcrProgress] = useState({
    current: 0,
    total: 0,
  });
  const [sourcePaneSplit, setSourcePaneSplit] = useState(
    loadStoredSourcePaneSplit,
  );
  const [resizingSourcePane, setResizingSourcePane] = useState(false);
  const [sourceFullscreenOpen, setSourceFullscreenOpen] = useState(false);
  const [usageDialogOpen, setUsageDialogOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [savingTitle, setSavingTitle] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [expandedStep, setExpandedStep] = useState<StepKey | null>(null);
  const [rerunNotice, setRerunNotice] = useState("");

  useEffect(() => {
    if (!lesson) {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrlsRef.current = [];
      setDraft(emptyDraft());
      setTitleDraft("");
      setSummaryDraft("");
      setPreviewDocuments([]);
      setActivePreviewId(null);
      setUsageDialogOpen(false);
      setExpandedStep(null);
      setRerunNotice("");
      return;
    }
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrlsRef.current = [];
    setDraft(loadDraft(lesson.id));
    setTitleDraft(lesson.title || "");
    setSummaryDraft(lesson.summary || "");
    setPreviewDocuments([]);
    setActivePreviewId(null);
    setActivePreviewPage(1);
    setUsageDialogOpen(false);
    setExpandedStep(null);
    setRerunNotice("");
  }, [lesson]);

  useEffect(() => {
    setActivePreviewPage(1);
  }, [activePreviewId]);

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrlsRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!resizingSourcePane) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const container = sourcePaneRef.current;
      if (!container) {
        return;
      }
      const rect = container.getBoundingClientRect();
      if (!rect.width) {
        return;
      }
      const nextSplit = ((event.clientX - rect.left) / rect.width) * 100;
      setSourcePaneSplit(Math.min(70, Math.max(30, nextSplit)));
    };

    const stopResizing = () => {
      setResizingSourcePane(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResizing);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResizing);
    };
  }, [resizingSourcePane]);

  useEffect(() => {
    if (!lesson) {
      return;
    }
    window.localStorage.setItem(
      getStorageKey(lesson.id),
      JSON.stringify(draft),
    );
  }, [draft, lesson]);

  useEffect(() => {
    window.localStorage.setItem(
      SOURCE_SPLIT_STORAGE_KEY,
      String(sourcePaneSplit),
    );
  }, [sourcePaneSplit]);

  useEffect(() => {
    if (!sourceFullscreenOpen) {
      return;
    }
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setSourceFullscreenOpen(false);
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [sourceFullscreenOpen]);

  const toggleBrowserFullscreen = async () => {
    const element = sourceFullscreenRef.current;
    if (!element) {
      return;
    }
    try {
      if (document.fullscreenElement) {
        if (typeof document.exitFullscreen === "function") {
          await document.exitFullscreen();
        }
        return;
      }
      if (typeof element.requestFullscreen === "function") {
        await element.requestFullscreen();
      }
    } catch {
      // Ignore fullscreen API failures; the dialog remains open.
    }
  };

  const approvedQuestionPages = useMemo(
    () => buildApprovedQuestionPages(draft.sourceDocuments),
    [draft.sourceDocuments],
  );
  const approvedQuestionsCount = useMemo(
    () =>
      approvedQuestionPages.reduce(
        (total, page) => total + page.questions.length,
        0,
      ),
    [approvedQuestionPages],
  );
  const questionsConfirmComplete =
    draft.workflowState === "sections" ||
    draft.workflowState === "review" ||
    draft.workflowState === "published" ||
    draft.sections.length > 0 ||
    String(lesson?.status || "").toLowerCase().includes("publish");

  const activePreview =
    previewDocuments.find((document) => document.id === activePreviewId) ||
    previewDocuments[0] ||
    null;
  const activeSourceDocument =
    draft.sourceDocuments.find(
      (document) => document.id === activePreview?.id,
    ) || null;
  const activeQuestionUsage =
    activeSourceDocument?.pageQuestionUsage.find((entry) => Boolean(entry)) ||
    null;
  const activeExtractedTextPreview = activeSourceDocument
    ? activeSourceDocument.pageTextQuestions
        .map((questions, index) => ({
          pageNumber: index + 1,
          title: activeSourceDocument.pageTitles[index] ?? null,
          detectedPageNumber: activeSourceDocument.pageNumbers[index] ?? null,
          questions,
          states: activeSourceDocument.pageTextQuestionStates[index] || [],
        }))
        .find((page) => page.pageNumber === activePreviewPage) || null
    : null;
  const activeExtractedQuestionsText = activeSourceDocument
    ? questionsToEditorText(activeSourceDocument.pageQuestionDetails)
    : "";
  const canAnalyzeSource = Boolean(activePreview?.file && activeSourceDocument);

  if (!lesson) {
    return <EmptyState hasLessons={hasLessons} />;
  }

  const sourceComplete = approvedQuestionsCount > 0;
  const conceptsComplete = questionsConfirmComplete;
  const sectionsComplete = draft.sections.length > 0;

  const updateDraft = (updater: (current: BuilderDraft) => BuilderDraft) => {
    setDraft((current) => updater(current));
  };

  const stepEnabled: Record<StepKey, boolean> = {
    source: true,
    concepts: sourceComplete,
  };

  const saveTitle = async () => {
    const nextTitle = titleDraft.trim();
    if (!nextTitle || nextTitle === lesson.title) {
      return;
    }
    setSavingTitle(true);
    const updated = await onUpdateTitle(lesson.id, nextTitle);
    setSavingTitle(false);
    if (updated) {
      onNotify("Lesson title updated", "success");
    }
  };

  const saveSummary = async () => {
    if (summaryDraft === (lesson.summary || "")) {
      return;
    }
    await onUpdateContent(lesson.id, summaryDraft);
  };

  const inspectPdfDocument = async (file: File): Promise<SourceDocument> => {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const pdfWorker =
      await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker.default;

    const bytes = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjs.getDocument({ data: bytes }).promise;

    return {
      id: createId("source"),
      name: file.name,
      pages: pdf.numPages,
      pageTitles: Array.from({ length: pdf.numPages }, () => null),
      pageNumbers: Array.from({ length: pdf.numPages }, () => null),
      pageTexts: Array.from({ length: pdf.numPages }, () => ""),
      pageTextQuestions: Array.from({ length: pdf.numPages }, () => []),
      pageTextQuestionStates: Array.from({ length: pdf.numPages }, () => []),
      pageQuestions: Array.from({ length: pdf.numPages }, () => ""),
      pageQuestionDetails: Array.from({ length: pdf.numPages }, () => null),
      pageQuestionUsage: Array.from({ length: pdf.numPages }, () => null),
      extractedText: "",
      titleCandidates: [],
      headingCandidates: [],
      questionCandidates: [],
      uploadedAt: new Date().toISOString(),
    };
  };

  const buildConceptStep = () => {
    const concepts = buildConceptsFromDocs(draft.sourceDocuments);
    updateDraft((current) => ({
      ...current,
      workflowState: "concepts",
      concepts,
      lastSkillRunAt: new Date().toISOString(),
    }));
    if (!titleDraft.trim()) {
      const suggestedTitle =
        draft.sourceDocuments.flatMap(
          (document) => document.titleCandidates,
        )[0] || "";
      if (suggestedTitle) {
        setTitleDraft(suggestedTitle);
      }
    }
  };

  const buildSectionsStep = () => {
    const sections = buildSectionsFromConcepts(
      draft.concepts,
      draft.sourceDocuments,
    );
    updateDraft((current) => ({
      ...current,
      workflowState: "sections",
      sections,
      lastSkillRunAt: new Date().toISOString(),
    }));
  };

  const rerunStep = (step: StepKey) => {
    if (!stepEnabled[step]) {
      return;
    }
    if (step === "source") {
      updateDraft((current) => ({
        ...current,
        concepts: [],
        sections: [],
        overview: "",
        workflowState: current.sourceDocuments.length ? "source" : "source",
        lastSkillRunAt: new Date().toISOString(),
      }));
      setExpandedStep("source");
      setRerunNotice(
        "Source was reopened. Concepts, sections, and review after it were cleared.",
      );
      return;
    }
    if (step === "concepts") {
      updateDraft((current) => ({
        ...current,
        sections: [],
        overview: "",
        workflowState: "concepts",
        lastSkillRunAt: new Date().toISOString(),
      }));
      setExpandedStep("concepts");
      setRerunNotice(
        "Question confirmation was reopened. Later workflow steps after it were cleared.",
      );
      return;
    }
  };

  const handleFilesUploaded = async (files: FileList | null) => {
    if (!files?.length) {
      return;
    }
    setExtracting(true);
    try {
      const uploaded: SourceDocument[] = [];
      const previews: PreviewDocument[] = [];
      for (const file of Array.from(files)) {
        const extracted = await inspectPdfDocument(file);
        uploaded.push(extracted);
        previews.push({
          id: extracted.id,
          name: file.name,
          url: URL.createObjectURL(file),
          file,
        });
      }
      updateDraft((current) => ({
        ...current,
        workflowState: "source",
        sourceDocuments: [...current.sourceDocuments, ...uploaded],
        lastSkillRunAt: new Date().toISOString(),
      }));
      previewUrlsRef.current.push(...previews.map((preview) => preview.url));
      setPreviewDocuments((current) => [...current, ...previews]);
      setActivePreviewId((current) => current || previews[0]?.id || null);
      setRerunNotice("");
      onNotify("Source material uploaded", "success");
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "Failed to read PDF";
      onNotify(detail, "error");
    } finally {
      setExtracting(false);
    }
  };

  const removeCurrentSourceDocument = () => {
    if (!activePreview) {
      return;
    }

    URL.revokeObjectURL(activePreview.url);
    previewUrlsRef.current = previewUrlsRef.current.filter(
      (url) => url !== activePreview.url,
    );

    const remainingPreviewDocuments = previewDocuments.filter(
      (document) => document.id !== activePreview.id,
    );
    const nextActivePreviewId = remainingPreviewDocuments[0]?.id || null;

    setPreviewDocuments(remainingPreviewDocuments);
    setActivePreviewId(nextActivePreviewId);
    updateDraft((current) => ({
      ...current,
      sourceDocuments: current.sourceDocuments.filter(
        (document) => document.id !== activePreview.id,
      ),
      workflowState: remainingPreviewDocuments.length
        ? current.workflowState
        : "source",
    }));
    onNotify("Source document removed", "success");
  };

  const updateDocumentPageTexts = (
    documentId: string,
    nextPageTexts: string[],
    nextPageNumbers?: Array<number | null>,
    nextPageTitles?: Array<string | null>,
  ) => {
    updateDraft((current) => ({
      ...current,
      sourceDocuments: current.sourceDocuments.map((document) => {
        if (document.id !== documentId) {
          return document;
        }
        const normalizedPageTexts = Array.from(
          { length: document.pages },
          (_, index) => nextPageTexts[index] || "",
        );
        const normalizedPageNumbers = Array.from(
          { length: document.pages },
          (_, index) =>
            nextPageNumbers?.[index] ?? document.pageNumbers[index] ?? null,
        );
        const normalizedPageTitles = Array.from(
          { length: document.pages },
          (_, index) =>
            nextPageTitles?.[index] ?? document.pageTitles[index] ?? null,
        );
        const normalizedPageTextQuestions = normalizedPageTexts.map(
          (pageText) => splitPageTextIntoQuestions(pageText),
        );
        const normalizedPageTextQuestionStates =
          normalizedPageTextQuestions.map((questions, pageIndex) =>
            questions.map(
              (_, questionIndex) =>
                document.pageTextQuestionStates[pageIndex]?.[questionIndex] ||
                "untouched",
            ),
          );
        console.debug("[LessonWorkspace] OCR parse update", {
          documentId,
          documentName: document.name,
          pages: normalizedPageTexts.map((pageText, index) => ({
            pageNumber: index + 1,
            textPreview: String(pageText || "").slice(0, 800),
            parsedQuestionCount: normalizedPageTextQuestions[index].length,
            parsedQuestions: normalizedPageTextQuestions[index],
          })),
        });
        const derivedFields = deriveDocumentFields(normalizedPageTexts);
        return {
          ...document,
          pageTitles: normalizedPageTitles,
          pageNumbers: normalizedPageNumbers,
          pageTexts: normalizedPageTexts,
          pageTextQuestions: normalizedPageTextQuestions,
          pageTextQuestionStates: normalizedPageTextQuestionStates,
          ...derivedFields,
        };
      }),
    }));
  };

  const updateDocumentPageQuestion = (
    documentId: string,
    pageNumber: number,
    questionIndex: number,
    nextQuestion: string,
  ) => {
    updateDraft((current) => ({
      ...current,
      sourceDocuments: current.sourceDocuments.map((document) => {
        if (document.id !== documentId) {
          return document;
        }
        const nextPageTextQuestions = document.pageTextQuestions.map(
          (questions, index) =>
            index === pageNumber - 1
              ? questions.map((question, innerIndex) =>
                  innerIndex === questionIndex ? nextQuestion : question,
                )
              : questions,
        );
        const nextPageTexts = document.pageTexts.map((pageText, index) =>
          index === pageNumber - 1
            ? nextPageTextQuestions[index].join("\n")
            : pageText,
        );
        const derivedFields = deriveDocumentFields(nextPageTexts);
        return {
          ...document,
          pageTexts: nextPageTexts,
          pageTextQuestions: nextPageTextQuestions,
          ...derivedFields,
        };
      }),
    }));
  };

  const updateDocumentQuestionState = (
    documentId: string,
    pageNumber: number,
    questionIndex: number,
    nextState: QuestionReviewState,
  ) => {
    updateDraft((current) => ({
      ...current,
      sourceDocuments: current.sourceDocuments.map((document) => {
        if (document.id !== documentId) {
          return document;
        }
        return {
          ...document,
          pageTextQuestionStates: document.pageTextQuestionStates.map(
            (states, index) =>
              index === pageNumber - 1
                ? states.map((state, innerIndex) =>
                    innerIndex === questionIndex ? nextState : state,
                  )
                : states,
          ),
        };
      }),
    }));
  };

  const updateDocumentPageTitle = (
    documentId: string,
    pageNumber: number,
    nextTitle: string,
  ) => {
    updateDraft((current) => ({
      ...current,
      sourceDocuments: current.sourceDocuments.map((document) => {
        if (document.id !== documentId) {
          return document;
        }
        return {
          ...document,
          pageTitles: document.pageTitles.map((title, index) =>
            index === pageNumber - 1
              ? nextTitle.trim()
                ? nextTitle
                : null
              : title,
          ),
        };
      }),
    }));
  };

  const updateDocumentPageNumber = (
    documentId: string,
    pageNumber: number,
    nextValue: string,
  ) => {
    const trimmed = nextValue.trim();
    const normalized =
      trimmed === ""
        ? null
        : /^[0-9]{1,3}$/.test(trimmed)
          ? Number(trimmed)
          : null;
    updateDraft((current) => ({
      ...current,
      sourceDocuments: current.sourceDocuments.map((document) => {
        if (document.id !== documentId) {
          return document;
        }
        return {
          ...document,
          pageNumbers: document.pageNumbers.map((value, index) =>
            index === pageNumber - 1 ? normalized : value,
          ),
        };
      }),
    }));
  };

  const runLocalOcrOnCurrentDocument = async () => {
    if (!activeSourceDocument || !activePreview?.file) {
      return;
    }
    setLocalOcringDocument(true);
    setLocalOcrProgress({ current: 0, total: activeSourceDocument.pages });
    try {
      const pageTexts: string[] = [];
      const pageTitles: Array<string | null> = [];
      const pageNumbers: Array<number | null> = [];
      for (
        let pageNumber = 1;
        pageNumber <= activeSourceDocument.pages;
        pageNumber += 1
      ) {
        const extracted = await extractPageColumns(
          activePreview.file,
          pageNumber,
        );
        pageTitles.push(extracted.title ?? null);
        pageNumbers.push(extracted.pageNumber ?? null);
        pageTexts.push(
          (extracted.questionsSection || extracted.combined || "").trim(),
        );
        updateDocumentPageTexts(
          activeSourceDocument.id,
          pageTexts,
          pageNumbers,
          pageTitles,
        );
        setLocalOcrProgress({
          current: pageNumber,
          total: activeSourceDocument.pages,
        });
      }
      onNotify("Local OCR prepared with questions only.", "success");
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message
          : "Could not run local OCR in the browser";
      console.error("Local document OCR failed", error);
      onNotify(detail, "error");
    } finally {
      setLocalOcringDocument(false);
      setLocalOcrProgress({ current: 0, total: 0 });
    }
  };

  const runLlmOnCurrentDocument = async () => {
    if (!lesson || !activeSourceDocument || !activePreview?.file) {
      return;
    }
    if (!getAccessTokenSilently || !apiBaseUrl || !auth0Audience) {
      onNotify(
        "OCR extraction is not configured in the teacher portal",
        "error",
      );
      return;
    }
    setAnalyzingDocument(true);
    try {
      const headers = await buildAuthHeaders(
        getAccessTokenSilently,
        auth0Audience,
      );
      const extraction = await extractLessonPageQuestions(
        `${apiBaseUrl}/lesson/id/${lesson.id}/question-extraction`,
        headers,
        {
          file: activePreview.file,
          pageCount: activeSourceDocument.pages,
        },
      );
      const usage: PageQuestionUsageRecord = {
        ...extraction.usage,
        pageNumber: 1,
        extractedAt: extraction.extractedAt,
        requestId: extraction.requestId ?? null,
      };

      updateDraft((current) => ({
        ...current,
        sourceDocuments: current.sourceDocuments.map((document) => {
          if (document.id !== activeSourceDocument.id) {
            return document;
          }
          const nextPageQuestions = Array.from(
            { length: document.pages },
            (_, index) => extraction.pageQuestions[index] || "",
          );
          const nextPageQuestionDetails = Array.from(
            { length: document.pages },
            (_, index) => extraction.pageQuestionDetails[index] || null,
          );
          const nextPageQuestionUsage = Array.from(
            { length: document.pages },
            (_, index) => (index === 0 ? usage : null),
          );
          return {
            ...document,
            pageQuestions: nextPageQuestions,
            pageQuestionDetails: nextPageQuestionDetails,
            pageQuestionUsage: nextPageQuestionUsage,
            questionCandidates:
              deriveQuestionCandidatesFromPages(nextPageQuestions),
          };
        }),
      }));
      const extractedPageCount = extraction.pageQuestions.filter((page) =>
        page.trim(),
      ).length;
      if (!extractedPageCount) {
        onNotify(
          `OCR completed. No questions detected. Cost ${formatCostCents(usage.costCents)}.`,
          "error",
        );
        return;
      }
      onNotify(
        `OCR completed for ${extractedPageCount} page${extractedPageCount === 1 ? "" : "s"}. Cost ${formatCostCents(
          usage.costCents,
        )}.`,
        "success",
      );
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message
          : "Could not extract questions from PDF";
      console.error("Document question extraction failed", error);
      onNotify(detail, "error");
    } finally {
      setAnalyzingDocument(false);
    }
  };

  const handleConceptGeneration = () => {
    updateDraft((current) => ({
      ...current,
      workflowState: "concepts",
      lastSkillRunAt: new Date().toISOString(),
    }));
    setExpandedStep("concepts");
    setRerunNotice("");
    onNotify("Approved questions prepared for confirmation", "success");
  };

  const handleSectionDraftGeneration = () => {
    buildSectionsStep();
    setRerunNotice("");
    onNotify("Concept sections drafted", "success");
  };

  const handlePublishApprovedQuestions = async () => {
    if (!lesson || !getAccessTokenSilently || !apiBaseUrl || !auth0Audience) {
      onNotify("Publish is not configured in the teacher portal", "error");
      return;
    }
    if (approvedQuestionPages.length === 0) {
      onNotify("Approve at least one question before publishing", "error");
      return;
    }
    setPublishing(true);
    try {
      const headers = await buildAuthHeaders(getAccessTokenSilently, auth0Audience);
      await publishApprovedQuestionsLesson(
        `${apiBaseUrl}/lesson/id/${lesson.id}/publish-approved-questions`,
        headers,
        {
          title: titleDraft.trim() || lesson.title,
          pages: approvedQuestionPages.map((page) => ({
            pageNumber: page.pageNumber,
            title: page.title,
            detectedPageNumber: page.detectedPageNumber,
            questions: page.questions,
          })),
        }
      );
      const updated = await onUpdateStatus(lesson.id, "published");
      if (!updated) {
        onNotify("Lesson was published but local status could not be refreshed", "error");
        return;
      }
      updateDraft((current) => ({
        ...current,
        workflowState: "published",
      }));
      setExpandedStep("concepts");
      setRerunNotice("");
      onNotify("Approved questions published", "success");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Failed to publish approved questions";
      onNotify(detail, "error");
    } finally {
      setPublishing(false);
    }
  };

  const buildPreviewToolbarControls = (fullscreen = false) => {
    if (!activePreview) {
      return null;
    }

    return (
      <Stack direction="row" spacing={0.5} alignItems="center">
        <IconButton
          size="small"
          disabled={!activeSourceDocument || activePreviewPage <= 1}
          onClick={() =>
            setActivePreviewPage((current) => Math.max(1, current - 1))
          }
          sx={{ color: "#fff" }}
        >
          <ChevronLeftRoundedIcon />
        </IconButton>
        <Typography
          sx={{
            color: "#fff",
            fontWeight: 800,
            minWidth: 44,
            textAlign: "center",
          }}
        >
          {activeSourceDocument
            ? `${activePreviewPage}/${activeSourceDocument.pages}`
            : ""}
        </Typography>
        <IconButton
          size="small"
          disabled={
            !activeSourceDocument ||
            activePreviewPage >= activeSourceDocument.pages
          }
          onClick={() =>
            setActivePreviewPage((current) =>
              activeSourceDocument
                ? Math.min(activeSourceDocument.pages, current + 1)
                : current,
            )
          }
          sx={{ color: "#fff" }}
        >
          <ChevronRightRoundedIcon />
        </IconButton>
        <Box sx={{ mx: 0.5, color: "rgba(255,255,255,0.35)", fontWeight: 700 }}>
          |
        </Box>
        <IconButton
          size="small"
          onClick={() => void runLocalOcrOnCurrentDocument()}
          disabled={!canAnalyzeSource || localOcringDocument}
          sx={{ color: "#fff", px: 0.75, borderRadius: "10px" }}
        >
          {localOcringDocument ? (
            <Typography
              sx={{
                color: "#fff",
                fontWeight: 800,
                fontSize: "0.95rem",
                lineHeight: 1,
              }}
            >
              ...
            </Typography>
          ) : (
            <DocumentScannerRoundedIcon sx={{ color: "#fff", fontSize: 19 }} />
          )}
        </IconButton>
        <Box sx={{ mx: 0.5, color: "rgba(255,255,255,0.35)", fontWeight: 700 }}>
          |
        </Box>
        {!fullscreen ? (
          <>
            <IconButton
              size="small"
              onClick={() => setSourceFullscreenOpen(true)}
              sx={{ color: "#fff" }}
            >
              <FullscreenRoundedIcon />
            </IconButton>
            <IconButton
              size="small"
              onClick={removeCurrentSourceDocument}
              sx={{ color: "#fff" }}
            >
              <DeleteRoundedIcon />
            </IconButton>
          </>
        ) : (
          <IconButton
            size="small"
            onClick={() => void toggleBrowserFullscreen()}
            sx={{ color: "#fff", mx: 0.25 }}
          >
            <FullscreenRoundedIcon />
          </IconButton>
        )}
      </Stack>
    );
  };

  const renderSourceWorkspace = (fullscreen = false) => (
    <Stack spacing={2}>
      <Box
        ref={sourcePaneRef}
        sx={{
          display: "flex",
          flexDirection: { xs: "column", lg: "row" },
          gap: { xs: 2, lg: 0 },
          alignItems: "stretch",
          minHeight: { lg: fullscreen ? "100vh" : 760 },
          height: { lg: fullscreen ? "100vh" : "auto" },
        }}
      >
        <Box
          component={activePreview ? "div" : "label"}
          onDragOver={(event: DragEvent<HTMLLabelElement | HTMLDivElement>) => {
            if (activePreview) {
              return;
            }
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(event: DragEvent<HTMLLabelElement | HTMLDivElement>) => {
            if (activePreview) {
              return;
            }
            event.preventDefault();
            setDragActive(false);
            void handleFilesUploaded(event.dataTransfer.files);
          }}
          sx={{
            display: "flex",
            width: { xs: "100%", lg: `calc(${sourcePaneSplit}% - 6px)` },
            flexShrink: 0,
            height: { lg: fullscreen ? "100vh" : 760 },
            maxHeight: { lg: fullscreen ? "100vh" : 760 },
            minHeight: { lg: fullscreen ? "100vh" : 760 },
            borderRadius: 0,
            border: "2px solid rgba(0,0,0,0.12)",
            backgroundColor: "#fff",
            color: "text.primary",
            overflow: "hidden",
            cursor: activePreview ? "default" : "pointer",
            boxShadow: "none",
            outline: dragActive ? "3px solid rgba(76,175,80,0.55)" : "none",
            position: "relative",
            flexDirection: "column",
          }}
        >
          <input
            hidden
            multiple
            accept="application/pdf"
            type="file"
            onChange={(event) => void handleFilesUploaded(event.target.files)}
          />
          <Box sx={{ px: fullscreen ? 0 : 3, pb: 0, flex: 1, minHeight: 0 }}>
            {activePreview ? (
              <Stack spacing={0.5} sx={{ height: "100%" }}>
                <PdfPreviewCanvas
                  url={activePreview.url}
                  title={activePreview.name}
                  pageNumber={activePreviewPage}
                  fullscreen={fullscreen}
                  toolbarControls={buildPreviewToolbarControls(fullscreen)}
                  fillHeight
                />
              </Stack>
            ) : (
              <Box
                sx={{
                  width: "100%",
                  minHeight: 390,
                  borderRadius: "1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 1.5,
                  color: "text.secondary",
                  backgroundColor: dragActive
                    ? "rgba(0,0,0,0.04)"
                    : "transparent",
                  textAlign: "center",
                }}
              >
                <Typography
                  fontWeight={800}
                  sx={{ fontSize: "1.15rem", color: "text.primary" }}
                >
                  {titleDraft || "Upload Source Material"}
                </Typography>
                <Typography sx={{ fontSize: "0.95rem", fontWeight: 700 }}>
                  Drag and drop PDF or click to upload
                </Typography>
                <Typography sx={{ fontSize: "0.95rem", fontWeight: 700 }}>
                  No stored PDF found. Upload one to continue.
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
        <Box
          role="separator"
          aria-orientation="vertical"
          onPointerDown={() => setResizingSourcePane(true)}
          sx={{
            display: { xs: "none", lg: "flex" },
            width: 12,
            cursor: "col-resize",
            alignItems: "center",
            justifyContent: "center",
            userSelect: "none",
            touchAction: "none",
          }}
        >
          <Box
            sx={{
              width: 4,
              height: "100%",
              borderRadius: "999px",
              backgroundColor: resizingSourcePane
                ? "rgba(239,108,0,0.72)"
                : "rgba(0,0,0,0.12)",
              transition: "background-color 0.18s ease",
            }}
          />
        </Box>
        <Box
          sx={{
            width: { xs: "100%", lg: `calc(${100 - sourcePaneSplit}% - 6px)` },
            flexShrink: 0,
            height: { lg: fullscreen ? "100vh" : 760 },
            maxHeight: { lg: fullscreen ? "100vh" : 760 },
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            borderRadius: 0,
            border: "none",
            backgroundColor: "#fff",
            overflow: "hidden",
          }}
        >
          <QuestionsAccordionList
            page={activeExtractedTextPreview}
            fullscreen={fullscreen}
            onUpdatePageTitle={(pageNumber, nextTitle) => {
              if (!activeSourceDocument) {
                return;
              }
              updateDocumentPageTitle(
                activeSourceDocument.id,
                pageNumber,
                nextTitle,
              );
            }}
            onUpdatePageNumber={(pageNumber, nextValue) => {
              if (!activeSourceDocument) {
                return;
              }
              updateDocumentPageNumber(
                activeSourceDocument.id,
                pageNumber,
                nextValue,
              );
            }}
            onUpdateQuestion={(pageNumber, questionIndex, nextValue) => {
              if (!activeSourceDocument) {
                return;
              }
              updateDocumentPageQuestion(
                activeSourceDocument.id,
                pageNumber,
                questionIndex,
                nextValue,
              );
            }}
            onUpdateQuestionState={(pageNumber, questionIndex, nextState) => {
              if (!activeSourceDocument) {
                return;
              }
              updateDocumentQuestionState(
                activeSourceDocument.id,
                pageNumber,
                questionIndex,
                nextState,
              );
            }}
          />
          {localOcringDocument && localOcrProgress.total > 0 ? (
            <Box
              sx={{
                px: 2,
                py: 1.5,
                borderTop: "1px solid rgba(0,0,0,0.08)",
                backgroundColor: "#fff",
              }}
            >
              <Typography sx={{ fontWeight: 800, textAlign: "center", mb: 1 }}>
                {localOcrProgress.current}/{localOcrProgress.total} pages parsed
              </Typography>
              <LinearProgress
                variant="determinate"
                value={
                  (localOcrProgress.current / localOcrProgress.total) * 100
                }
                sx={{ height: 10, borderRadius: 999, width: "100%" }}
              />
            </Box>
          ) : null}
        </Box>
      </Box>
      {!fullscreen ? (
        <Stack direction="row" justifyContent="center" alignItems="center">
          <Button
            variant="outlined"
            onClick={handleConceptGeneration}
            disabled={!sourceComplete}
          >
            Continue
          </Button>
        </Stack>
      ) : null}
      {!fullscreen && extracting ? (
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          justifyContent="center"
        >
          <CircularProgress size={18} />
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            Loading PDF…
          </Typography>
        </Stack>
      ) : null}
    </Stack>
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <Box sx={{ minWidth: 280, flex: 1 }}>
          <TextField
            value={titleDraft}
            onChange={(event) => setTitleDraft(event.target.value)}
            onBlur={saveTitle}
            fullWidth
            variant="standard"
            placeholder="New lesson template"
            InputProps={{
              disableUnderline: true,
              sx: {
                fontSize: "2.25rem",
                fontWeight: 800,
                lineHeight: 1.1,
                px: 0,
                py: 0,
              },
            }}
          />
          <TextField
            value={summaryDraft}
            onChange={(event) => setSummaryDraft(event.target.value)}
            onBlur={saveSummary}
            fullWidth
            variant="standard"
            multiline
            minRows={2}
            placeholder="Add a short report summary."
            InputProps={{
              disableUnderline: true,
              sx: {
                mt: 1,
                fontSize: "1rem",
                fontWeight: 700,
                color: "text.secondary",
                px: 0,
                py: 0,
              },
            }}
          />
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Stack direction="row" spacing={0.25} alignItems="center">
            <IconButton
              onClick={onDuplicateLesson}
              sx={{ color: "primary.main" }}
            >
              <ContentCopyRoundedIcon />
            </IconButton>
            {showDelete ? (
              <IconButton onClick={onDeleteLesson} sx={{ color: "error.main" }}>
                <DeleteRoundedIcon />
              </IconButton>
            ) : null}
          </Stack>
          <Box
            sx={{
              minWidth: 78,
              height: 38,
              px: 1.5,
              borderRadius: "999px",
              backgroundColor:
                draft.workflowState === "published" ||
                String(lesson.status || "").toLowerCase().includes("publish")
                  ? "#2e7d32"
                  : "#ef6c00",
              color: "common.white",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.9rem",
              fontWeight: 700,
              textTransform: "lowercase",
            }}
          >
            {draft.workflowState === "published" ||
            String(lesson.status || "")
              .toLowerCase()
              .includes("publish")
              ? "public"
              : "draft"}
          </Box>
        </Stack>
      </Box>

      {rerunNotice ? <Alert severity="warning">{rerunNotice}</Alert> : null}

      <Divider />

      <Box sx={{ mt: "2.5rem" }}>
        <StepShell
          stepNumber={1}
          label="Upload Source"
          expanded={expandedStep === "source"}
          complete={sourceComplete}
          inProgress={draft.sourceDocuments.length > 0 && !sourceComplete}
          enabled
          showConnector
          onToggle={() =>
            setExpandedStep((current) =>
              current === "source" ? null : "source",
            )
          }
          onRerun={() => rerunStep("source")}
          skills={stepSkills.source}
        >
          {renderSourceWorkspace()}
          {activeSourceDocument ? (
            <Typography variant="body2" color="text.secondary">
              {activeSourceDocument.pageQuestions.filter((page) => page.trim())
                .length
                ? `${activeSourceDocument.pageQuestions.filter((page) => page.trim()).length} page${
                    activeSourceDocument.pageQuestions.filter((page) =>
                      page.trim(),
                    ).length === 1
                      ? ""
                      : "s"
                  } with extracted questions.`
                : "No extracted questions stored yet."}
            </Typography>
          ) : null}
        </StepShell>
      </Box>
      <Dialog
        open={usageDialogOpen}
        onClose={() => setUsageDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <Box sx={{ p: 3, display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography fontWeight={800} sx={{ fontSize: "1.1rem" }}>
              AI Extraction Cost
            </Typography>
            <IconButton onClick={() => setUsageDialogOpen(false)}>
              <CloseRoundedIcon />
            </IconButton>
          </Stack>
          {activeQuestionUsage ? (
            <>
              <Typography>
                {formatCostCents(activeQuestionUsage.costCents)} for this
                document
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Model: {activeQuestionUsage.model}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Input tokens: {activeQuestionUsage.inputTokens}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Output tokens: {activeQuestionUsage.outputTokens}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total tokens: {activeQuestionUsage.totalTokens}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Cached input tokens: {activeQuestionUsage.cachedInputTokens}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Extracted at:{" "}
                {new Date(activeQuestionUsage.extractedAt).toLocaleString()}
              </Typography>
              {activeQuestionUsage.requestId ? (
                <Typography variant="body2" color="text.secondary">
                  Request ID: {activeQuestionUsage.requestId}
                </Typography>
              ) : null}
            </>
          ) : (
            <Typography color="text.secondary">
              No AI extraction usage is available for this document yet.
            </Typography>
          )}
          <Box sx={{ display: "flex", justifyContent: "flex-end", pt: 1 }}>
            <Button
              variant="contained"
              onClick={() => setUsageDialogOpen(false)}
            >
              Close
            </Button>
          </Box>
        </Box>
      </Dialog>
      <Dialog
        open={sourceFullscreenOpen}
        onClose={() => {
          if (
            document.fullscreenElement &&
            typeof document.exitFullscreen === "function"
          ) {
            void document.exitFullscreen().catch(() => {});
          }
          setSourceFullscreenOpen(false);
        }}
        fullScreen
        PaperProps={{ sx: { borderRadius: 0 } }}
      >
        <Box
          ref={sourceFullscreenRef}
          sx={{
            p: 0,
            display: "flex",
            flexDirection: "column",
            gap: 0,
            minHeight: "100vh",
            position: "relative",
            bgcolor: "#fff",
          }}
        >
          <IconButton
            onClick={() => {
              if (
                document.fullscreenElement &&
                typeof document.exitFullscreen === "function"
              ) {
                void document.exitFullscreen().catch(() => {});
              }
              setSourceFullscreenOpen(false);
            }}
            sx={{
              position: "absolute",
              top: 10,
              right: 10,
              zIndex: 5,
              color: "#fff",
              backgroundColor: "#c62828",
              "&:hover": {
                backgroundColor: "#b71c1c",
              },
            }}
          >
            <CloseRoundedIcon />
          </IconButton>
          {renderSourceWorkspace(true)}
        </Box>
      </Dialog>

      <StepShell
        stepNumber={2}
        label="Confirm Questions"
        expanded={expandedStep === "concepts"}
        complete={conceptsComplete}
        inProgress={approvedQuestionsCount > 0 && !conceptsComplete}
        enabled={stepEnabled.concepts}
        showConnector={false}
        onToggle={() =>
          setExpandedStep((current) =>
            current === "concepts" ? null : "concepts",
          )
        }
        onRerun={() => rerunStep("concepts")}
        skills={stepSkills.concepts}
      >
        <Stack spacing={2}>
          <ApprovedQuestionsReview
            pages={approvedQuestionPages}
            onUpdateQuestion={(
              documentId,
              pageNumber,
              questionIndex,
              nextValue,
            ) => {
              updateDocumentPageQuestion(
                documentId,
                pageNumber,
                questionIndex,
                nextValue,
              );
            }}
            onUpdateQuestionState={(
              documentId,
              pageNumber,
              questionIndex,
              nextState,
            ) => {
              updateDocumentQuestionState(
                documentId,
                pageNumber,
                questionIndex,
                nextState,
              );
            }}
            onUpdatePageTitle={(documentId, pageNumber, nextTitle) => {
              updateDocumentPageTitle(documentId, pageNumber, nextTitle);
            }}
            onUpdatePageNumber={(documentId, pageNumber, nextValue) => {
              updateDocumentPageNumber(documentId, pageNumber, nextValue);
            }}
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button
              variant="contained"
              onClick={handlePublishApprovedQuestions}
              disabled={publishing || approvedQuestionsCount === 0}
            >
              Publish
            </Button>
          </Stack>
        </Stack>
      </StepShell>

    </Box>
  );
};

export default LessonWorkspace;
