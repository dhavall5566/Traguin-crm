"use client";

import {
  parseFormSubmissionNote,
  parseWebsiteIntakeActivity,
  shortId,
  type TimelineField,
} from "@/lib/lead-timeline-format";

function FieldGrid({ fields }: { fields: TimelineField[] }) {
  if (fields.length === 0) return null;
  return (
    <dl className="crm-timeline-fields">
      {fields.map((field) => {
        const isMessage = field.label.toLowerCase() === "message";
        return (
          <div
            key={`${field.label}-${field.value}`}
            className={`crm-timeline-fields__row ${isMessage ? "crm-timeline-fields__row--message" : ""}`}
          >
            <dt>{field.label}</dt>
            <dd>{isMessage ? <span className="crm-timeline-message">{field.value}</span> : field.value}</dd>
          </div>
        );
      })}
    </dl>
  );
}

export function LeadTimelineNoteBody({ content }: { content: string }) {
  const parsed = parseFormSubmissionNote(content);
  if (!parsed) {
    return <p className="crm-lead-drawer__card-body crm-timeline-plain">{content}</p>;
  }

  const detailFields = parsed.details.filter(
    (field) =>
      !parsed.contact.some(
        (c) => c.label.toLowerCase() === field.label.toLowerCase() && c.value === field.value,
      ),
  );

  return (
    <div className="crm-timeline-structured">
      <div className="crm-timeline-structured__head">
        <span className="crm-timeline-badge">{parsed.formTypeLabel}</span>
        {parsed.submissionId ? (
          <span className="crm-timeline-id" title={parsed.submissionId}>
            ID {shortId(parsed.submissionId)}
          </span>
        ) : null}
      </div>

      {parsed.contact.length > 0 && (
        <div className="crm-timeline-block">
          <p className="crm-timeline-block__title">Contact</p>
          <FieldGrid fields={parsed.contact} />
        </div>
      )}

      {detailFields.length > 0 && (
        <div className="crm-timeline-block">
          <p className="crm-timeline-block__title">Submission details</p>
          <FieldGrid fields={detailFields} />
        </div>
      )}
    </div>
  );
}

export function LeadTimelineActivityBody({
  description,
  author,
}: {
  description: string;
  author: string;
}) {
  const parsed = parseWebsiteIntakeActivity(description);
  if (!parsed) {
    return (
      <>
        <span className="font-semibold text-[var(--foreground)]">{author}</span>
        {' — '}
        {description}
      </>
    );
  }

  return (
    <div className="crm-timeline-structured crm-timeline-structured--inline">
      <p className="crm-timeline-activity-title">
        <span className="font-semibold text-[var(--foreground)]">{author}</span>
        <span className="text-[var(--muted-foreground)]"> recorded website intake</span>
      </p>
      <div className="crm-timeline-structured__head">
        <span className="crm-timeline-badge crm-timeline-badge--muted">{parsed.formTypeLabel}</span>
        {parsed.submissionId ? (
          <span className="crm-timeline-id" title={parsed.submissionId}>
            ID {shortId(parsed.submissionId)}
          </span>
        ) : null}
      </div>
      {parsed.footer ? <p className="crm-timeline-activity-foot">{parsed.footer}</p> : null}
    </div>
  );
}
