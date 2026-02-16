/**
 * App Store Install Modal
 *
 * Displays package capabilities before installation for user approval.
 */

import { html, nothing } from "lit";
import type { PackageInfo } from "../controllers/appstore.ts";

export type InstallModalProps = {
  package: PackageInfo;
  onConfirm: () => void;
  onCancel: () => void;
};

type CapabilityRisk = "low" | "medium" | "high";

interface CapabilityItem {
  icon: string;
  label: string;
  items: string[];
  risk: CapabilityRisk;
}

/**
 * Extract and categorize capabilities by risk level.
 */
function extractCapabilities(pkg: PackageInfo): CapabilityItem[] {
  const capabilities: CapabilityItem[] = [];
  const caps = pkg.capabilities;

  if (!caps) {
    return capabilities;
  }

  // Low risk: Channels provided
  if (caps.channels?.provides && caps.channels.provides.length > 0) {
    capabilities.push({
      icon: "hash",
      label: "Channels",
      items: caps.channels.provides.map((c) => `Provides: ${c}`),
      risk: "low",
    });
  }

  // Low risk: Tools provided
  if (caps.tools?.provides && caps.tools.provides.length > 0) {
    capabilities.push({
      icon: "wrench",
      label: "Tools",
      items: caps.tools.provides.map((t) => `Provides: ${t}`),
      risk: "low",
    });
  }

  // Medium risk: Hooks
  const hookItems: string[] = [];
  if (caps.hooks?.subscribes && caps.hooks.subscribes.length > 0) {
    hookItems.push(...caps.hooks.subscribes.map((h) => `Subscribes: ${h}`));
  }
  if (caps.hooks?.intercepts && caps.hooks.intercepts.length > 0) {
    hookItems.push(...caps.hooks.intercepts.map((h) => `Intercepts: ${h}`));
  }
  if (hookItems.length > 0) {
    capabilities.push({
      icon: "bell",
      label: "Hooks",
      items: hookItems,
      risk: caps.hooks?.intercepts?.length ? "medium" : "low",
    });
  }

  // Medium risk: Gateway methods
  if (caps.gateway?.methods && caps.gateway.methods.length > 0) {
    capabilities.push({
      icon: "server",
      label: "Gateway Methods",
      items: caps.gateway.methods,
      risk: "medium",
    });
  }

  // Medium risk: HTTP routes
  if (caps.gateway?.httpRoutes && caps.gateway.httpRoutes.length > 0) {
    capabilities.push({
      icon: "globe",
      label: "HTTP Routes",
      items: caps.gateway.httpRoutes,
      risk: "medium",
    });
  }

  // Low risk: Providers
  if (caps.providers?.provides && caps.providers.provides.length > 0) {
    capabilities.push({
      icon: "cpu",
      label: "LLM Providers",
      items: caps.providers.provides,
      risk: "low",
    });
  }

  // High risk: Environment variables
  if (caps.resources?.env && caps.resources.env.length > 0) {
    capabilities.push({
      icon: "key",
      label: "Environment Variables",
      items: caps.resources.env,
      risk: "high",
    });
  }

  // High risk: File system access
  const fsItems: string[] = [];
  if (caps.resources?.fs?.read && caps.resources.fs.read.length > 0) {
    fsItems.push(...caps.resources.fs.read.map((p) => `Read: ${p}`));
  }
  if (caps.resources?.fs?.write && caps.resources.fs.write.length > 0) {
    fsItems.push(...caps.resources.fs.write.map((p) => `Write: ${p}`));
  }
  if (fsItems.length > 0) {
    capabilities.push({
      icon: "folder",
      label: "File System Access",
      items: fsItems,
      risk: "high",
    });
  }

  // High risk: Network access
  if (caps.resources?.network?.hosts && caps.resources.network.hosts.length > 0) {
    capabilities.push({
      icon: "wifi",
      label: "Network Access",
      items: caps.resources.network.hosts,
      risk: "high",
    });
  }

  // Sort by risk: high first, then medium, then low
  const riskOrder: Record<CapabilityRisk, number> = { high: 0, medium: 1, low: 2 };
  capabilities.sort((a, b) => riskOrder[a.risk] - riskOrder[b.risk]);

  return capabilities;
}

function renderCapabilityGroup(cap: CapabilityItem) {
  const riskClass = cap.risk === "high" ? "danger" : cap.risk === "medium" ? "warning" : "success";
  const riskIcon = cap.risk === "high" ? "!" : cap.risk === "medium" ? "~" : "";

  return html`
    <div class="capability-group">
      <div class="capability-header">
        <span class="capability-label">${cap.label}</span>
        ${
          cap.risk !== "low"
            ? html`<span class="chip ${riskClass}">${riskIcon} ${cap.risk}</span>`
            : nothing
        }
      </div>
      <ul class="capability-items">
        ${cap.items.map(
          (item) => html`
            <li class="capability-item">${item}</li>
          `,
        )}
      </ul>
    </div>
  `;
}

export function renderInstallModal(props: InstallModalProps) {
  const pkg = props.package;
  const capabilities = extractCapabilities(pkg);
  const hasHighRisk = capabilities.some((c) => c.risk === "high");

  return html`
    <div class="modal-overlay" @click=${props.onCancel}>
      <div class="modal install-modal" @click=${(e: Event) => e.stopPropagation()}>
        <div class="modal-header">
          <div class="modal-title">Install ${pkg.name}?</div>
          <button class="modal-close" @click=${props.onCancel}>x</button>
        </div>

        <div class="modal-body">
          <div class="install-modal-info">
            <div class="install-modal-meta">
              <span class="chip">${pkg.version}</span>
              <span class="chip muted">${pkg.type}</span>
              ${pkg.author ? html`<span class="muted">by ${pkg.author}</span>` : nothing}
            </div>
            ${pkg.description ? html`<p class="install-modal-desc">${pkg.description}</p>` : nothing}
          </div>

          ${
            capabilities.length > 0
              ? html`
                <div class="install-modal-capabilities">
                  <div class="capability-section-title">
                    This package requests the following capabilities:
                  </div>
                  ${capabilities.map((cap) => renderCapabilityGroup(cap))}
                </div>
              `
              : html`
                  <div class="install-modal-capabilities">
                    <div class="muted">This package does not declare any capabilities.</div>
                  </div>
                `
          }

          ${
            hasHighRisk
              ? html`
                  <div class="callout warning" style="margin-top: 12px">
                    This package requests high-risk capabilities. Only install packages from trusted sources.
                  </div>
                `
              : nothing
          }
        </div>

        <div class="modal-footer">
          <button class="btn" @click=${props.onCancel}>Cancel</button>
          <button class="btn primary" @click=${props.onConfirm}>Install</button>
        </div>
      </div>
    </div>

    <style>
      .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }

      .install-modal {
        background: var(--bg-color, #1a1a1a);
        border: 1px solid var(--border-color, #333);
        border-radius: 8px;
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
      }

      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px;
        border-bottom: 1px solid var(--border-color, #333);
      }

      .modal-title {
        font-size: 1.1em;
        font-weight: 600;
      }

      .modal-close {
        background: none;
        border: none;
        color: var(--text-muted, #888);
        cursor: pointer;
        font-size: 1.2em;
        padding: 4px 8px;
      }

      .modal-close:hover {
        color: var(--text-color, #fff);
      }

      .modal-body {
        padding: 16px;
        overflow-y: auto;
        flex: 1;
      }

      .modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding: 16px;
        border-top: 1px solid var(--border-color, #333);
      }

      .install-modal-info {
        margin-bottom: 16px;
      }

      .install-modal-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
        margin-bottom: 8px;
      }

      .install-modal-desc {
        margin: 0;
        color: var(--text-muted, #888);
      }

      .install-modal-capabilities {
        background: var(--bg-secondary, #222);
        border-radius: 6px;
        padding: 12px;
      }

      .capability-section-title {
        font-weight: 500;
        margin-bottom: 12px;
      }

      .capability-group {
        margin-bottom: 12px;
      }

      .capability-group:last-child {
        margin-bottom: 0;
      }

      .capability-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 4px;
      }

      .capability-label {
        font-weight: 500;
      }

      .capability-items {
        margin: 0;
        padding-left: 20px;
        color: var(--text-muted, #888);
      }

      .capability-item {
        margin: 2px 0;
      }
    </style>
  `;
}
