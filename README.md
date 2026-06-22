# Table to SecretStorage

An Obsidian plugin that migrates plaintext secrets from a markdown table into Obsidian's built-in SecretStorage, then replaces the table values with their storage IDs.

## What it does

You have a note with secrets stored in plain text:

```
| Secret name     | Value                        |
| ---             | ---                          |
| OpenAI API Key  | sk-abc123...                 |
| DB Password     | hunter2                      |
```

Run the command **"Convert table at cursor to SecretStorage entries"** with your cursor inside the table. The plugin:

1. Parses each row and slugifies the key name into a valid SecretStorage ID (`OpenAI API Key` → `openai-api-key`)
2. Shows a confirmation modal listing what will be written and flagging any overwrites
3. Writes each secret to Obsidian's SecretStorage
4. Replaces the table in your note with IDs only — plaintext values are removed:

```
| Secret name     | SecretStorage ID   |
| ---             | ---                |
| OpenAI API Key  | `openai-api-key`   |
| DB Password     | `db-password`      |
```

## Installation

Copy `main.js`, `manifest.json` to your vault at `.obsidian/plugins/table-to-secrets/`, then enable the plugin in Settings → Community Plugins.

## Development

```bash
npm i
npm run dev   # watch mode — recompile on save
```

Reload Obsidian after each build, or use the [Hot Reload](https://github.com/pjeby/hot-reload) plugin.
