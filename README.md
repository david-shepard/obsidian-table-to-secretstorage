# Obsidian Table to SecretStorage Plugin

An Obsidian plugin that migrates plaintext secrets from a markdown table into Obsidian's built-in SecretStorage, then replaces the table values with their storage IDs.

## What it does

> [!CAUTION]
> This plugin is experimental, please make a backup of secrets first

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

Copy `dist/main.js`, `dist/manifest.json` to your vault at `.obsidian/plugins/obsidian-markdown-to-secretstore/`, then enable the plugin in Settings → Community Plugins. Alternatively you can symlink the directory.

## Development

```bash
npm i
npm run dev   # watch mode (recompiles on save)
```

Reload Obsidian after each build, use the [Hot Reload](https://github.com/pjeby/hot-reload) plugin (add `.hotreload` file to `dist` folder), and/or add a symlink (ie. `ln -s "$(pwd)/dist" "/path/to/vault/.obsidian/plugins/obsidian-table-to-secretstorage"`).

## Disclaimer & things worth knowing

- I'm not responsible for the security of your secrets
- Secret IDs must match `^[a-z0-9]+(-[a-z0-9]+)*$`. This plugin slugifies
  your table's key column automatically, but if two different labels
  slugify to the same ID, the second one will silently overwrite the
  first. The confirmation modal will flag pre-existing IDs, but it
  won't catch collisions *within the same table*.
- Ddon't treat it as equivalent to a proper OS credential store yet.
- This only handles the table *under your cursor*, not every table in the
  vault. That's deliberate as bulk-migrating without review is the kind of
  thing that's fun until row 14 has a value with a literal `|` in it.

## Possible next steps

- Handling code-fences (```) & (``)
- A settings tab using `SecretComponent` so other parts of your own plugin
  ecosystem can reference a stored secret by name instead of hardcoding IDs.
- A `deleteSecret`-based "undo" command, if/when that method is exposed.
- Handling for escaped pipes (`\|`) inside table cells.
- Display a modal with an easy way to fetch your secrets
- Adapt plugin to work with [BRAT](https://tfthacker.com/brat-developers) 
