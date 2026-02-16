# App Structure

This guide covers the structure and manifest format for OpenClawOS apps.

## Directory Layout

```
my-app/
├── openclawos.manifest.json   # Required: Package manifest
├── package.json               # Required: Node.js package
├── tsconfig.json              # TypeScript configuration
├── src/
│   ├── index.ts              # Entry point (referenced in manifest.main)
│   ├── app.ts                # App class implementation
│   └── ...
├── dist/                      # Compiled output
│   └── index.js
└── README.md                  # Documentation
```

## Manifest File

The `openclawos.manifest.json` file defines your app:

```json
{
  "id": "@myorg/my-app",
  "name": "My App",
  "version": "1.0.0",
  "description": "Description of what this app does",
  "author": "Your Name",
  "license": "MIT",
  "repository": "https://github.com/myorg/my-app",
  "icon": "https://example.com/icon.png",
  "tags": ["channel", "messaging"],

  "type": "app",
  "main": "dist/index.js",

  "protocol": {
    "version": "1.0",
    "minKernelVersion": "2026.2.0"
  },

  "capabilities": {
    "channels": {
      "provides": ["mychannel"]
    },
    "hooks": {
      "subscribes": ["message_received"],
      "intercepts": ["message_sending"]
    },
    "resources": {
      "env": ["MY_API_TOKEN"],
      "network": {
        "hosts": ["api.example.com"]
      }
    }
  },

  "configSchema": {
    "type": "object",
    "properties": {
      "apiToken": { "type": "string" },
      "endpoint": { "type": "string", "default": "https://api.example.com" },
      "debug": { "type": "boolean", "default": false }
    },
    "required": ["apiToken"]
  },

  "configUiHints": {
    "apiToken": {
      "label": "API Token",
      "description": "Your API token from example.com",
      "sensitive": true,
      "type": "text"
    },
    "endpoint": {
      "label": "API Endpoint",
      "advanced": true
    }
  }
}
```

## Manifest Fields

### Identity

| Field         | Required | Description                              |
| ------------- | -------- | ---------------------------------------- |
| `id`          | Yes      | Unique package ID, format: `@scope/name` |
| `name`        | Yes      | Human-readable display name              |
| `version`     | Yes      | Semantic version (e.g., `1.0.0`)         |
| `description` | No       | Short description                        |
| `author`      | No       | Author name or organization              |
| `license`     | No       | SPDX license identifier                  |
| `repository`  | No       | Source code URL                          |
| `icon`        | No       | Icon URL for App Store                   |
| `tags`        | No       | Categorization tags                      |

### Package Type

| Field  | Required | Description                                  |
| ------ | -------- | -------------------------------------------- |
| `type` | Yes      | One of: `app`, `skill`, `agent`, `extension` |
| `main` | For apps | Entry point file path                        |

### Protocol

| Field                       | Required | Description                        |
| --------------------------- | -------- | ---------------------------------- |
| `protocol.version`          | Yes      | IPC protocol version (e.g., `1.0`) |
| `protocol.minKernelVersion` | No       | Minimum kernel version required    |

### Capabilities

See [Capabilities](../architecture/capabilities.md) for full reference.

### Configuration Schema

Define app configuration using JSON Schema:

```json
{
  "configSchema": {
    "type": "object",
    "properties": {
      "apiToken": {
        "type": "string",
        "minLength": 10
      },
      "maxRetries": {
        "type": "integer",
        "minimum": 0,
        "maximum": 10,
        "default": 3
      },
      "features": {
        "type": "array",
        "items": { "type": "string" }
      }
    },
    "required": ["apiToken"]
  }
}
```

### Configuration UI Hints

Customize how config fields appear in the UI:

```json
{
  "configUiHints": {
    "apiToken": {
      "label": "API Token",
      "description": "Get this from your account settings",
      "placeholder": "Enter your token...",
      "sensitive": true,
      "type": "text"
    },
    "debugMode": {
      "label": "Debug Mode",
      "description": "Enable verbose logging",
      "advanced": true,
      "type": "boolean"
    },
    "region": {
      "label": "Region",
      "type": "select",
      "options": [
        { "label": "US East", "value": "us-east" },
        { "label": "EU West", "value": "eu-west" }
      ]
    }
  }
}
```

#### UI Hint Fields

| Field         | Description                                                                          |
| ------------- | ------------------------------------------------------------------------------------ |
| `label`       | Display label                                                                        |
| `description` | Help text                                                                            |
| `placeholder` | Input placeholder                                                                    |
| `sensitive`   | Mask input (for secrets)                                                             |
| `advanced`    | Hide in basic view                                                                   |
| `type`        | Input type: `text`, `number`, `boolean`, `select`, `multiselect`, `code`, `textarea` |
| `options`     | Options for select/multiselect                                                       |

## Package.json

Standard Node.js package:

```json
{
  "name": "@myorg/my-app",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@openclawos/sdk": "^1.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  }
}
```

## TypeScript Configuration

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

## Packaging for Distribution

### Directory Package

The simplest format - just the app directory:

```
my-app/
├── openclawos.manifest.json
├── dist/
│   └── index.js
└── package.json
```

### Zip Archive

Compress for distribution:

```bash
zip -r my-app.zip openclawos.manifest.json dist/ package.json
```

The zip should contain:

```
my-app.zip
├── openclawos.manifest.json
├── dist/
│   └── index.js
└── package.json
```

## Versioning

### Semantic Versioning

Use semantic versioning for your app:

- `MAJOR.MINOR.PATCH` (e.g., `1.2.3`)
- Increment MAJOR for breaking changes
- Increment MINOR for new features
- Increment PATCH for bug fixes

### Protocol Version

The `protocol.version` field indicates IPC compatibility:

- `1.0` - Initial protocol version
- Future versions will be backward compatible within major version

### Minimum Kernel Version

Use `protocol.minKernelVersion` to require specific kernel features:

```json
{
  "protocol": {
    "version": "1.0",
    "minKernelVersion": "2026.2.0"
  }
}
```

## Next Steps

- [Channel Apps](channel-app.md) - Build a channel app
- [Plugin Apps](plugin-app.md) - Build a plugin app
- [Manifest Schema](../reference/manifest-schema.md) - Full reference
