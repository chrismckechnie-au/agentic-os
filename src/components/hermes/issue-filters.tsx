import { cn } from "@/lib/utils";
import type { HermesCrewIssueSeverity, HermesCrewIssueType } from "@/lib/types";

const SEVERITIES: HermesCrewIssueSeverity[] = ["critical", "high", "medium", "low"];
const ISSUE_TYPES: HermesCrewIssueType[] = ["task", "cron", "channel", "profile", "session", "config", "event"];

function ToggleChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
        active
          ? "border-[var(--accent)] bg-[var(--accent-soft)]/35 text-ink"
          : "border-line bg-surface text-faint hover:border-[var(--accent)]/35 hover:text-muted",
      )}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}

export function HermesIssueFilters({
  search,
  onSearchChange,
  selectedSeverities,
  onToggleSeverity,
  selectedProfileIds,
  profileOptions,
  onToggleProfile,
  selectedTypes,
  onToggleType,
  onReset,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  selectedSeverities: HermesCrewIssueSeverity[];
  onToggleSeverity: (severity: HermesCrewIssueSeverity) => void;
  selectedProfileIds: string[];
  profileOptions: { id: string; name: string }[];
  onToggleProfile: (profileId: string) => void;
  selectedTypes: HermesCrewIssueType[];
  onToggleType: (type: HermesCrewIssueType) => void;
  onReset: () => void;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface-2 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-faint">Filters</div>
          <p className="mt-1 text-xs text-faint">Search normalized issue titles, summaries, and affected-object labels.</p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="text-xs font-medium text-[var(--accent)] hover:underline"
        >
          Reset filters
        </button>
      </div>

      <label className="mt-3 block">
        <span className="mb-1 block text-[11px] font-medium text-faint">Search</span>
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search titles, issue summaries, or related objects"
          className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-faint focus:border-[var(--accent)]"
        />
      </label>

      <div className="mt-3 space-y-3">
        <div>
          <div className="mb-1 text-[11px] font-medium text-faint">Severity</div>
          <div className="flex flex-wrap gap-1.5">
            {SEVERITIES.map((severity) => (
              <ToggleChip
                key={severity}
                active={selectedSeverities.includes(severity)}
                label={severity}
                onClick={() => onToggleSeverity(severity)}
              />
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1 text-[11px] font-medium text-faint">Worker lane</div>
          <div className="flex flex-wrap gap-1.5">
            {profileOptions.map((profile) => (
              <ToggleChip
                key={profile.id}
                active={selectedProfileIds.includes(profile.id)}
                label={profile.name}
                onClick={() => onToggleProfile(profile.id)}
              />
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1 text-[11px] font-medium text-faint">Issue type</div>
          <div className="flex flex-wrap gap-1.5">
            {ISSUE_TYPES.map((type) => (
              <ToggleChip
                key={type}
                active={selectedTypes.includes(type)}
                label={type}
                onClick={() => onToggleType(type)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
