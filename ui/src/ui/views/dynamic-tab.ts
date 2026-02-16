/**
 * Dynamic Tab View
 *
 * Renders app-contributed tab content (iframe or web component).
 */

import { html, nothing } from "lit";
import type { AppTab } from "../controllers/ui-manifest.ts";
import { isComponentLoaded } from "../controllers/component-loader.ts";

export type DynamicTabProps = {
  tab: AppTab;
};

/**
 * Render dynamic tab content based on render type.
 */
export function renderDynamicTab(props: DynamicTabProps) {
  const { tab } = props;

  switch (tab.render.type) {
    case "iframe":
      return renderIframeTab(tab);

    case "component":
      return renderComponentTab(tab);

    case "builtin":
      return renderBuiltinTab(tab);

    default:
      return html`
        <div class="app-tab-error">Unknown render type</div>
      `;
  }
}

/**
 * Render an iframe-based app tab.
 */
function renderIframeTab(tab: AppTab) {
  if (tab.render.type !== "iframe") {
    return nothing;
  }

  return html`
    <div class="app-tab-container">
      <iframe
        src="${tab.render.src}"
        class="app-iframe"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        title="${tab.title}"
        loading="lazy"
      ></iframe>
    </div>
  `;
}

/**
 * Render a web component-based app tab.
 */
function renderComponentTab(tab: AppTab) {
  if (tab.render.type !== "component") {
    return nothing;
  }

  const tag = tab.render.tag;

  if (!isComponentLoaded(tag)) {
    return html`
      <div class="app-tab-container app-tab-container--error">
        <div class="app-tab-error">
          <p>Component not available: <code>${tag}</code></p>
          <p class="muted">The app may still be loading or failed to register this component.</p>
        </div>
      </div>
    `;
  }

  // Create the custom element dynamically
  const element = document.createElement(tag);
  element.setAttribute("data-package-id", tab.packageId);

  return html`
    <div class="app-tab-container app-tab-container--component">${element}</div>
  `;
}

/**
 * Render a built-in view (placeholder for future use).
 */
function renderBuiltinTab(tab: AppTab) {
  if (tab.render.type !== "builtin") {
    return nothing;
  }

  return html`
    <div class="app-tab-container">
      <div class="app-tab-builtin">Built-in view: ${tab.render.view}</div>
    </div>
  `;
}
