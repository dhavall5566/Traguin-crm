"use client";

type ChartTooltipEntry = {
  name?: string;
  dataKey?: string | number;
  value?: number | string;
  color?: string;
};

type CrmChartTooltipProps = {
  active?: boolean;
  payload?: ChartTooltipEntry[];
  label?: string | number;
  format?: "currency" | "number";
};

function formatTooltipValue(value: number, format: "currency" | "number"): string {
  const n = Number(value) || 0;
  if (format === "currency") {
    return `₹${n.toLocaleString("en-IN")}`;
  }
  return n.toLocaleString("en-IN");
}

export function CrmChartTooltip({
  active,
  payload,
  label,
  format = "number",
}: CrmChartTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="crm-chart-tooltip" role="tooltip">
      {label != null && String(label).trim() !== "" && (
        <p className="crm-chart-tooltip__label">{label}</p>
      )}
      <div className="crm-chart-tooltip__rows">
        {payload.map((entry) => {
          const name = String(entry.name ?? entry.dataKey ?? "Value");
          const value = Number(entry.value ?? 0);
          return (
            <div key={`${name}-${entry.dataKey}`} className="crm-chart-tooltip__row">
              <span className="crm-chart-tooltip__row-name">
                <span
                  className="crm-chart-tooltip__dot"
                  style={{ backgroundColor: entry.color ?? "var(--gold, #c9a227)" }}
                  aria-hidden
                />
                {name}
              </span>
              <span className="crm-chart-tooltip__value">
                {formatTooltipValue(value, format)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
