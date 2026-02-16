/**
 * Component Loader
 *
 * Dynamically loads and registers web components provided by apps.
 */

import type { AppComponent } from "./ui-manifest.ts";

// Registry of loaded app components
const loadedComponents = new Set<string>();

/**
 * Convert kebab-case to PascalCase.
 */
function pascalCase(str: string): string {
  return str
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
}

/**
 * Load and register app-provided web components.
 * Components are loaded from app-served module URLs.
 */
export async function loadAppComponents(components: AppComponent[]): Promise<void> {
  for (const component of components) {
    if (loadedComponents.has(component.tag)) {
      continue;
    }

    try {
      // Validate tag name (must include hyphen for custom elements)
      if (!component.tag.includes("-")) {
        console.warn(`[component-loader] Invalid component tag: ${component.tag}`);
        continue;
      }

      // Skip if already defined
      if (customElements.get(component.tag)) {
        loadedComponents.add(component.tag);
        continue;
      }

      // Dynamic import from app-provided module URL
      const module = await import(/* @vite-ignore */ component.module);

      // Expect module to export a custom element class
      const ElementClass = module.default || module[pascalCase(component.tag)];

      if (ElementClass && typeof ElementClass === "function") {
        customElements.define(component.tag, ElementClass);
        loadedComponents.add(component.tag);
      } else {
        console.warn(
          `[component-loader] Component ${component.tag} module did not export element class`,
        );
      }
    } catch (err) {
      console.error(`[component-loader] Failed to load component ${component.tag}:`, err);
    }
  }
}

/**
 * Check if a component is available for use.
 */
export function isComponentLoaded(tag: string): boolean {
  return loadedComponents.has(tag) || customElements.get(tag) !== undefined;
}

/**
 * Get all loaded component tags.
 */
export function getLoadedComponents(): string[] {
  return Array.from(loadedComponents);
}
