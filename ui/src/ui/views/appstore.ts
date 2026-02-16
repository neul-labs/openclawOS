/**
 * App Store View
 *
 * Renders the App Store UI for discovering, installing, and configuring packages.
 */

import { html, nothing } from "lit";
import type {
  AppStoreMessageMap,
  PackageCategory,
  PackageInfo,
  PackageType,
} from "../controllers/appstore.ts";
import { clampText } from "../format.ts";
import { renderInstallModal } from "./appstore-install-modal.ts";

export type AppStoreProps = {
  loading: boolean;
  packages: PackageInfo[] | null;
  error: string | null;
  filter: string;
  category: PackageCategory;
  selectedId: string | null;
  busyKey: string | null;
  messages: AppStoreMessageMap;
  installPending: PackageInfo | null;
  onFilterChange: (next: string) => void;
  onCategoryChange: (next: PackageCategory) => void;
  onSelect: (packageId: string | null) => void;
  onShowInstallModal: (packageId: string) => void;
  onConfirmInstall: () => void;
  onCancelInstall: () => void;
  onUninstall: (packageId: string) => void;
  onToggleEnabled: (packageId: string, enabled: boolean) => void;
  onStart: (packageId: string) => void;
  onStop: (packageId: string) => void;
  onRestart: (packageId: string) => void;
  onRefresh: () => void;
};

const CATEGORY_LABELS: Record<PackageCategory, string> = {
  all: "All",
  apps: "Apps",
  skills: "Skills",
  agents: "Agents",
  extensions: "Extensions",
};

const TYPE_LABELS: Record<PackageType, string> = {
  app: "Apps",
  skill: "Skills",
  agent: "Agents",
  extension: "Extensions",
};

// Reserved for future use when we add icons to package types
const _TYPE_ICONS: Record<PackageType, string> = {
  app: "box",
  skill: "zap",
  agent: "bot",
  extension: "puzzle",
};

export function renderAppStore(props: AppStoreProps) {
  const packages = props.packages ?? [];
  const filter = props.filter.trim().toLowerCase();
  const category = props.category;

  // Filter packages
  const filtered = packages.filter((pkg) => {
    // Category filter
    if (category !== "all") {
      const typeMap: Record<PackageCategory, PackageType | null> = {
        all: null,
        apps: "app",
        skills: "skill",
        agents: "agent",
        extensions: "extension",
      };
      const targetType = typeMap[category];
      if (targetType && pkg.type !== targetType) {
        return false;
      }
    }

    // Text filter
    if (filter) {
      const searchText = [pkg.name, pkg.description, pkg.id, ...(pkg.tags ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!searchText.includes(filter)) {
        return false;
      }
    }

    return true;
  });

  // Group by type
  const groups = groupPackages(filtered);

  return html`
    ${
      props.installPending
        ? renderInstallModal({
            package: props.installPending,
            onConfirm: props.onConfirmInstall,
            onCancel: props.onCancelInstall,
          })
        : nothing
    }

    <section class="card">
      <div class="row" style="justify-content: space-between;">
        <div>
          <div class="card-title">App Store</div>
          <div class="card-sub">Browse, install, and configure packages.</div>
        </div>
        <button class="btn" ?disabled=${props.loading} @click=${props.onRefresh}>
          ${props.loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      ${renderCategoryTabs(props)}

      <div class="filters" style="margin-top: 14px;">
        <label class="field" style="flex: 1;">
          <span>Search</span>
          <input
            .value=${props.filter}
            @input=${(e: Event) => props.onFilterChange((e.target as HTMLInputElement).value)}
            placeholder="Search packages..."
          />
        </label>
        <div class="muted">${filtered.length} package${filtered.length !== 1 ? "s" : ""}</div>
      </div>

      ${
        props.error
          ? html`<div class="callout danger" style="margin-top: 12px;">${props.error}</div>`
          : nothing
      }

      ${
        filtered.length === 0
          ? html`
            <div class="muted" style="margin-top: 16px;">
              ${props.loading ? "Loading packages..." : "No packages found."}
            </div>
          `
          : html`
            <div class="appstore-groups" style="margin-top: 16px;">
              ${groups.map((group) => renderPackageGroup(group, props))}
            </div>
          `
      }
    </section>
  `;
}

function renderCategoryTabs(props: AppStoreProps) {
  const categories: PackageCategory[] = ["all", "apps", "skills", "agents", "extensions"];

  return html`
    <div class="tabs" style="margin-top: 16px;">
      ${categories.map(
        (cat) => html`
          <button
            class="tab ${props.category === cat ? "active" : ""}"
            @click=${() => props.onCategoryChange(cat)}
          >
            ${CATEGORY_LABELS[cat]}
          </button>
        `,
      )}
    </div>
  `;
}

interface PackageGroup {
  type: PackageType;
  label: string;
  packages: PackageInfo[];
}

function groupPackages(packages: PackageInfo[]): PackageGroup[] {
  const groups: Map<PackageType, PackageInfo[]> = new Map();

  for (const pkg of packages) {
    const existing = groups.get(pkg.type) ?? [];
    existing.push(pkg);
    groups.set(pkg.type, existing);
  }

  const result: PackageGroup[] = [];
  const order: PackageType[] = ["app", "skill", "agent", "extension"];

  for (const type of order) {
    const pkgs = groups.get(type);
    if (pkgs && pkgs.length > 0) {
      result.push({
        type,
        label: TYPE_LABELS[type],
        packages: pkgs,
      });
    }
  }

  return result;
}

function renderPackageGroup(group: PackageGroup, props: AppStoreProps) {
  return html`
    <details class="appstore-group" open>
      <summary class="appstore-group-header">
        <span>${group.label}</span>
        <span class="muted">${group.packages.length}</span>
      </summary>
      <div class="list appstore-grid">
        ${group.packages.map((pkg) => renderPackageCard(pkg, props))}
      </div>
    </details>
  `;
}

function renderPackageCard(pkg: PackageInfo, props: AppStoreProps) {
  const busy = props.busyKey === pkg.id;
  const message = props.messages[pkg.id] ?? null;
  const isSelected = props.selectedId === pkg.id;

  return html`
    <div
      class="list-item appstore-card ${isSelected ? "selected" : ""}"
      @click=${() => props.onSelect(isSelected ? null : pkg.id)}
    >
      <div class="list-main">
        <div class="list-title">
          ${pkg.icon ? html`<span class="appstore-icon">${pkg.icon}</span>` : nothing}
          ${pkg.name}
          ${
            pkg.builtin
              ? html`
                  <span class="chip muted">Built-in</span>
                `
              : nothing
          }
        </div>
        <div class="list-sub">${clampText(pkg.description ?? "", 100)}</div>
        ${renderStatusChips(pkg)}
      </div>
      <div class="list-meta">
        <div class="row" style="justify-content: flex-end; flex-wrap: wrap; gap: 8px;">
          ${renderPackageActions(pkg, busy, props)}
        </div>
        ${
          message
            ? html`
              <div
                class="muted"
                style="margin-top: 8px; color: ${
                  message.kind === "error"
                    ? "var(--danger-color, #d14343)"
                    : "var(--success-color, #0a7f5a)"
                };"
              >
                ${message.message}
              </div>
            `
            : nothing
        }
      </div>
    </div>
  `;
}

function renderStatusChips(pkg: PackageInfo) {
  const chips: ReturnType<typeof html>[] = [];

  // Version
  chips.push(html`<span class="chip">${pkg.version}</span>`);

  // Type
  chips.push(html`<span class="chip muted">${pkg.type}</span>`);

  // Status
  if (pkg.installed) {
    if (pkg.enabled !== false) {
      chips.push(
        html`
          <span class="chip success">Enabled</span>
        `,
      );
    } else {
      chips.push(
        html`
          <span class="chip muted">Disabled</span>
        `,
      );
    }
  }

  // Runtime status for apps
  if (pkg.status && pkg.status !== "not_applicable") {
    const statusClass =
      pkg.status === "running"
        ? "success"
        : pkg.status === "error"
          ? "danger"
          : pkg.status === "starting" || pkg.status === "stopping"
            ? "warning"
            : "muted";
    chips.push(html`<span class="chip ${statusClass}">${pkg.status}</span>`);
  }

  return html`<div class="chips" style="margin-top: 6px;">${chips}</div>`;
}

function renderPackageActions(pkg: PackageInfo, busy: boolean, props: AppStoreProps) {
  const actions: ReturnType<typeof html>[] = [];

  if (pkg.installed) {
    // Lifecycle controls for apps only
    if (pkg.type === "app" && pkg.enabled !== false) {
      const status = pkg.status;

      // Start button: show when stopped or error
      if (status === "stopped" || status === "error") {
        actions.push(html`
          <button
            class="btn success"
            ?disabled=${busy}
            @click=${(e: Event) => {
              e.stopPropagation();
              props.onStart(pkg.id);
            }}
          >
            ${busy ? "..." : "Start"}
          </button>
        `);
      }

      // Stop button: show when running
      if (status === "running") {
        actions.push(html`
          <button
            class="btn"
            ?disabled=${busy}
            @click=${(e: Event) => {
              e.stopPropagation();
              props.onStop(pkg.id);
            }}
          >
            ${busy ? "..." : "Stop"}
          </button>
        `);
      }

      // Restart button: show when running
      if (status === "running") {
        actions.push(html`
          <button
            class="btn warning"
            ?disabled=${busy}
            @click=${(e: Event) => {
              e.stopPropagation();
              props.onRestart(pkg.id);
            }}
          >
            ${busy ? "..." : "Restart"}
          </button>
        `);
      }
    }

    // Toggle enabled/disabled
    if (pkg.enabled !== false) {
      actions.push(html`
        <button
          class="btn"
          ?disabled=${busy}
          @click=${(e: Event) => {
            e.stopPropagation();
            props.onToggleEnabled(pkg.id, false);
          }}
        >
          ${busy ? "..." : "Disable"}
        </button>
      `);
    } else {
      actions.push(html`
        <button
          class="btn"
          ?disabled=${busy}
          @click=${(e: Event) => {
            e.stopPropagation();
            props.onToggleEnabled(pkg.id, true);
          }}
        >
          ${busy ? "..." : "Enable"}
        </button>
      `);
    }

    // Uninstall (only for non-builtin)
    if (!pkg.builtin) {
      actions.push(html`
        <button
          class="btn danger"
          ?disabled=${busy}
          @click=${(e: Event) => {
            e.stopPropagation();
            props.onUninstall(pkg.id);
          }}
        >
          ${busy ? "..." : "Uninstall"}
        </button>
      `);
    }
  } else {
    // Install (shows confirmation modal first)
    actions.push(html`
      <button
        class="btn primary"
        ?disabled=${busy}
        @click=${(e: Event) => {
          e.stopPropagation();
          props.onShowInstallModal(pkg.id);
        }}
      >
        ${busy ? "Installing..." : "Install"}
      </button>
    `);
  }

  return actions;
}
