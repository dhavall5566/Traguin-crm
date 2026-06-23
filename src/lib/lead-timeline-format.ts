export type TimelineField = { label: string; value: string };

export type ParsedFormSubmissionNote = {
  formType: string;
  formTypeLabel: string;
  submissionId: string;
  contact: TimelineField[];
  details: TimelineField[];
};

export type ParsedWebsiteIntakeActivity = {
  formType: string;
  formTypeLabel: string;
  submissionId: string;
  footer?: string;
};

const FORM_TYPE_LABELS: Record<string, string> = {
  contact_consultation: "Contact consultation",
  travel_planner: "Travel planner",
  itinerary_inquiry: "Itinerary inquiry",
  hotel_booking: "Hotel booking",
  travel_expert_consultation: "Travel expert consultation",
  plan_my_journey: "Plan my journey",
};

export function humanizeFormType(formType: string): string {
  return (
    FORM_TYPE_LABELS[formType] ??
    formType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export function shortId(id: string): string {
  const trimmed = id.trim();
  if (trimmed.length <= 12) return trimmed;
  return `${trimmed.slice(0, 8)}…`;
}

function parseFieldLine(line: string): TimelineField | null {
  const match = line.match(/^([A-Za-z][A-Za-z0-9 /_-]*):\s*(.+)$/);
  if (!match) return null;
  return { label: match[1].trim(), value: match[2].trim() };
}

function parseBulletLine(line: string): TimelineField | null {
  const match = line.match(/^[•\-*]\s*(.+?):\s*(.+)$/);
  if (!match) return null;
  return { label: match[1].trim(), value: match[2].trim() };
}

export function parseFormSubmissionNote(content: string): ParsedFormSubmissionNote | null {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  if (!lines[0]?.startsWith("Website form submission (")) return null;

  const formTypeMatch = lines[0].match(/^Website form submission \(([^)]+)\)/);
  if (!formTypeMatch) return null;

  const formType = formTypeMatch[1].trim();
  let submissionId = "";
  const contact: TimelineField[] = [];
  const details: TimelineField[] = [];
  let section: "header" | "contact" | "details" = "header";

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith("Form submission ID:")) {
      submissionId = line.replace("Form submission ID:", "").trim();
      continue;
    }

    if (line === "Submission details:") {
      section = "details";
      continue;
    }

    const bullet = parseBulletLine(line);
    if (bullet) {
      details.push(bullet);
      continue;
    }

    const field = parseFieldLine(line);
    if (field) {
      if (section === "details") {
        details.push(field);
      } else {
        contact.push(field);
      }
    }
  }

  return {
    formType,
    formTypeLabel: humanizeFormType(formType),
    submissionId,
    contact,
    details,
  };
}

export function parseWebsiteIntakeActivity(description: string): ParsedWebsiteIntakeActivity | null {
  const match = description.match(
    /^Website intake from (\S+) \(form_submission_id=([^)]+)\)(?: · (.+))?$/,
  );
  if (!match) return null;
  return {
    formType: match[1],
    formTypeLabel: humanizeFormType(match[1]),
    submissionId: match[2],
    footer: match[3]?.trim(),
  };
}

export type TimelineItem =
  | { kind: "note"; id: string; at: string; author: string; content: string }
  | { kind: "activity"; id: string; at: string; author: string; description: string; type: string }
  | { kind: "followup"; id: string; at: string; notes: string; scheduledAt: string; status: string };

export function isRedundantNoteActivity(description: string): boolean {
  return /^Added note:\s"/i.test(description.trim());
}

export function isPendingTimelineItem(id: string): boolean {
  return id.startsWith("pending-note-") || id.startsWith("pending-fup-");
}

/** Hide accidental double-submit rows (same text within a few seconds). */
export function dedupeAccidentalNotes<
  T extends { id: string; content: string; createdAt: string },
>(notes: T[], windowMs = 5000): T[] {
  const sorted = [...notes].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const kept: T[] = [];
  for (const note of sorted) {
    const text = note.content.trim();
    const at = new Date(note.createdAt).getTime();
    const isDuplicate = kept.some((existing) => {
      if (existing.content.trim() !== text) return false;
      return Math.abs(new Date(existing.createdAt).getTime() - at) <= windowMs;
    });
    if (!isDuplicate) kept.push(note);
  }
  return kept;
}

export function sortTimelineItems<T extends { at: string }>(
  items: T[],
  order: "asc" | "desc" = "asc",
): T[] {
  return [...items].sort((a, b) => {
    const diff = new Date(a.at).getTime() - new Date(b.at).getTime();
    return order === "asc" ? diff : -diff;
  });
}
