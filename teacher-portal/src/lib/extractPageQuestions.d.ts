export function cleanLine(value: unknown): string;
export function extractPageColumns(
  file: File,
  pageNumber?: number,
): Promise<{
  title: string | null;
  pageNumber: number | null;
  left: string;
  right: string;
  combined: string;
  questionsSection: string;
}>;
