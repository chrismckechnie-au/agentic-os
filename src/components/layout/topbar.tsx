import { Icon } from "@/components/icon";

export function TopBar() {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-line bg-canvas/70 px-6 backdrop-blur">
      {/* Search */}
      <label className="flex h-9 w-full max-w-md items-center gap-2.5 rounded-lg border border-line bg-surface-2 px-3 text-sm text-faint">
        <Icon name="Search" size={16} />
        <input
          placeholder="Search anything..."
          className="w-full bg-transparent text-ink placeholder:text-faint focus:outline-none"
        />
        <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 text-[10px] text-faint">
          ⌘K
        </kbd>
      </label>

      <div className="ml-auto flex items-center gap-3">
        {/* Org switcher */}
        <button className="hidden h-9 items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 text-sm text-ink transition-colors hover:bg-surface-3 sm:flex">
          <Icon name="Boxes" size={15} className="text-muted" />
          Acme Corp
          <Icon name="ChevronDown" size={14} className="text-faint" />
        </button>

        {/* System status */}
        <span className="hidden h-9 items-center gap-2 rounded-lg border border-ok/25 bg-ok/10 px-3 text-sm font-medium text-ok md:flex">
          <span className="size-2 rounded-full bg-ok animate-pulse" />
          System Healthy
        </span>

        {/* Notifications */}
        <button className="relative grid size-9 place-items-center rounded-lg border border-line bg-surface-2 text-muted transition-colors hover:text-ink">
          <Icon name="Bell" size={17} />
          <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-[var(--accent)] text-[9px] font-bold text-white">
            3
          </span>
        </button>

        {/* Avatar */}
        <button className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 py-1 pl-1 pr-2 transition-colors hover:bg-surface-3">
          <span className="grid size-7 place-items-center rounded-md bg-gradient-to-br from-[#7c6cff] to-[#9d7cff] text-xs font-bold text-white">
            CM
          </span>
          <Icon name="ChevronDown" size={14} className="text-faint" />
        </button>
      </div>
    </header>
  );
}
