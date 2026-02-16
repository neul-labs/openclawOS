# UI Contributions

Apps can extend the OpenClawOS dashboard by contributing UI elements. This guide covers how to add tabs, web components, and settings panels to the control UI.

## Overview

Apps contribute UI elements through the `capabilities.ui` section in their manifest:

```json
{
  "capabilities": {
    "ui": {
      "tabs": [...],
      "components": [...],
      "settings": [...]
    }
  }
}
```

The UI fetches these contributions via `apps.getUiManifest` and renders them dynamically.

## Adding Tabs

Tabs appear in the sidebar navigation, allowing apps to provide dedicated views.

### Basic Tab

```json
{
  "capabilities": {
    "ui": {
      "tabs": [
        {
          "id": "dashboard",
          "title": "My Dashboard",
          "icon": "layout-dashboard",
          "render": {
            "type": "iframe",
            "src": "/app/@myorg/myapp/dashboard"
          }
        }
      ]
    }
  }
}
```

### Tab Configuration

| Field      | Type   | Required | Description                          |
| ---------- | ------ | -------- | ------------------------------------ |
| `id`       | string | Yes      | Unique identifier within the app     |
| `title`    | string | Yes      | Display name in sidebar              |
| `icon`     | string | No       | Lucide icon name (default: "puzzle") |
| `render`   | object | Yes      | How to render tab content            |
| `position` | string | No       | Where to place in sidebar            |
| `badge`    | object | No       | Badge count configuration            |

### Tab Positioning

Control where your tab appears in the sidebar:

| Position         | Description                         |
| ---------------- | ----------------------------------- |
| `top`            | First position in first group       |
| `bottom`         | In "Apps" group at bottom (default) |
| `after:chat`     | Right after the Chat tab            |
| `after:channels` | Right after the Channels tab        |

Example:

```json
{
  "id": "quick-actions",
  "title": "Quick Actions",
  "position": "after:chat",
  "render": { "type": "iframe", "src": "/app/@myorg/myapp/quick" }
}
```

### Render Types

#### iframe

Embed app-hosted content in a sandboxed iframe:

```json
{
  "render": {
    "type": "iframe",
    "src": "/app/@myorg/myapp/dashboard"
  }
}
```

The iframe has these sandbox permissions:

- `allow-scripts`
- `allow-same-origin`
- `allow-forms`
- `allow-popups`

#### component

Use a registered web component:

```json
{
  "render": {
    "type": "component",
    "tag": "my-app-dashboard"
  }
}
```

The component must be registered in the `components` section.

### Icons

Tabs use [Lucide](https://lucide.dev/icons) icons. Common choices:

| Icon Name          | Use Case          |
| ------------------ | ----------------- |
| `layout-dashboard` | Dashboards        |
| `bar-chart`        | Analytics         |
| `settings`         | Configuration     |
| `bell`             | Notifications     |
| `mail`             | Messages          |
| `users`            | User management   |
| `folder`           | File/folder views |
| `puzzle`           | Default/generic   |

## Web Components

Register custom elements for dynamic tab content or widgets.

### Registering Components

```json
{
  "capabilities": {
    "ui": {
      "components": [
        {
          "tag": "my-app-dashboard",
          "module": "./components/dashboard.js",
          "scope": "tab"
        }
      ]
    }
  }
}
```

### Component Configuration

| Field    | Type   | Required | Description                              |
| -------- | ------ | -------- | ---------------------------------------- |
| `tag`    | string | Yes      | Custom element tag (must contain hyphen) |
| `module` | string | Yes      | Path to JavaScript module                |
| `scope`  | string | Yes      | Where the component is used              |

### Component Scopes

| Scope      | Description             |
| ---------- | ----------------------- |
| `tab`      | Used as tab content     |
| `settings` | Used in settings panels |
| `widget`   | Embeddable widget       |
| `global`   | Loaded on app start     |

### Writing Components

Export your component class as the default export or as a PascalCase named export:

```typescript
// components/dashboard.js
export default class MyAppDashboard extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `<h1>My Dashboard</h1>`;
  }
}

// Or named export (PascalCase of tag name)
export class MyAppDashboard extends HTMLElement { ... }
```

The component receives `data-package-id` attribute with your app's package ID.

## Settings Panels

Add app-specific settings to the Config tab.

```json
{
  "capabilities": {
    "ui": {
      "settings": [
        {
          "id": "preferences",
          "title": "My App Settings",
          "render": {
            "type": "component",
            "tag": "my-app-settings"
          }
        }
      ]
    }
  }
}
```

### Settings Configuration

| Field    | Type   | Required | Description                         |
| -------- | ------ | -------- | ----------------------------------- |
| `id`     | string | Yes      | Unique identifier                   |
| `title`  | string | Yes      | Section heading                     |
| `render` | object | Yes      | How to render (iframe or component) |

## Badge Counts

Tabs can display badge counts (e.g., unread notifications).

### Manifest Configuration

```json
{
  "id": "notifications",
  "title": "Notifications",
  "render": { "type": "iframe", "src": "/app/@myorg/myapp/notifications" },
  "badge": {
    "method": "myapp.getNotificationCount",
    "interval": 30
  }
}
```

### Badge Configuration

| Field      | Type   | Required | Description                               |
| ---------- | ------ | -------- | ----------------------------------------- |
| `method`   | string | Yes      | Gateway method to call                    |
| `interval` | number | No       | Polling interval in seconds (default: 30) |

### Implementing the Gateway Method

```typescript
// In your app
app.registerGatewayMethod("myapp.getNotificationCount", async () => {
  const count = await getUnreadNotifications();
  return { count };
});
```

The method must return an object with a `count` property. Zero or missing count hides the badge.

## HTTP Routes for Iframes

Serve iframe content via HTTP routes:

```typescript
// Register HTTP route
app.registerHttpRoute("/dashboard", async (req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Dashboard</title>
        <style>
          body { font-family: system-ui; padding: 20px; }
        </style>
      </head>
      <body>
        <h1>My Dashboard</h1>
        <p>Content here...</p>
      </body>
    </html>
  `);
});
```

The iframe src follows the pattern: `/app/{packageId}/path`

For `@myorg/myapp` with route `/dashboard`, the full URL is:

```
/app/@myorg/myapp/dashboard
```

### Declaring HTTP Routes

Add to capabilities:

```json
{
  "capabilities": {
    "gateway": {
      "httpRoutes": ["/dashboard", "/dashboard/*"]
    },
    "ui": {
      "tabs": [...]
    }
  }
}
```

## Complete Example

Full manifest with UI contributions:

```json
{
  "id": "@myorg/my-dashboard",
  "name": "My Dashboard",
  "version": "1.0.0",
  "type": "app",
  "main": "dist/index.js",
  "protocol": { "version": "1.0" },
  "capabilities": {
    "gateway": {
      "methods": ["mydash.getBadgeCount"],
      "httpRoutes": ["/dashboard", "/dashboard/*", "/settings"]
    },
    "ui": {
      "tabs": [
        {
          "id": "main",
          "title": "Dashboard",
          "icon": "layout-dashboard",
          "render": {
            "type": "iframe",
            "src": "/app/@myorg/my-dashboard/dashboard"
          },
          "position": "after:chat",
          "badge": {
            "method": "mydash.getBadgeCount",
            "interval": 30
          }
        }
      ],
      "components": [
        {
          "tag": "mydash-widget",
          "module": "./components/widget.js",
          "scope": "widget"
        },
        {
          "tag": "mydash-settings",
          "module": "./components/settings.js",
          "scope": "settings"
        }
      ],
      "settings": [
        {
          "id": "config",
          "title": "Dashboard Settings",
          "render": {
            "type": "component",
            "tag": "mydash-settings"
          }
        }
      ]
    }
  }
}
```

## Best Practices

1. **Use meaningful IDs**: Tab and setting IDs should be descriptive and unique within your app
2. **Choose appropriate icons**: Select icons that represent your tab's purpose
3. **Position thoughtfully**: Use `position` to place tabs where users expect them
4. **Optimize badge polling**: Set `interval` based on data freshness needs (longer = less load)
5. **Handle loading states**: Show loading indicators in iframes and components
6. **Respect theming**: Use CSS variables from the parent UI for consistent styling

## Troubleshooting

### Tab not appearing

- Verify manifest `capabilities.ui.tabs` is properly formatted
- Check the gateway logs for manifest loading errors
- Ensure your app is enabled and running

### Component not rendering

- Confirm the tag name includes a hyphen (required for custom elements)
- Check that the module path is correct and accessible
- Look for JavaScript errors in the browser console

### Badge not updating

- Verify the gateway method is registered and returns `{ count: number }`
- Check that the method name matches exactly
- Confirm the method doesn't throw errors

## Next Steps

- [App Structure](app-structure.md) - Manifest format reference
- [Gateway Methods](../sdk/openclaw-app.md) - Registering gateway methods
- [Capabilities](../architecture/capabilities.md) - All capability types
