import { App, Editor, MarkdownFileInfo, MarkdownView, Modal, Notice, Plugin, Setting } from "obsidian";
import { PluginSettings, DEFAULT_SETTINGS } from "./settings";

// A valid SecretStorage id: lowercase alphanumeric, dashes allowed as separators.
// Obsidian throws if you call setSecret() with anything outside this shape.
const SECRET_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

interface ParsedSecretRow {
	rawKey: string; // the human-readable label from the table, e.g. "OpenAI API Key"
	secretId: string; // slugified id, e.g. "openai-api-key"
	value: string; // the plaintext secret value currently sitting in the note
	alreadyExists: boolean; // true if this id is already present in SecretStorage
}

interface FailedRow {
	row: ParsedSecretRow;
	error?: string;
}

interface TableMatch {
	startLine: number;
	endLine: number;
	rows: ParsedSecretRow[];
}

/**
 * Turns a human label into a valid SecretStorage id.
 * "OpenAI API Key"  -> "openai-api-key"
 * "DB_PASSWORD!!"   -> "db-password"
 */
function slugify(label: string): string {
	return label
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function isValidSecretId(id: string): boolean {
	return SECRET_ID_PATTERN.test(id);
}

const isTableRow = (line: string) => /^\s*\|.*\|\s*$/.test(line);
const isSeparatorRow = (line: string) =>
	/^\s*\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?\s*$/.test(line);

function splitRow(line: string): string[] {
	return line
		.trim()
		.replace(/^\|/, "")
		.replace(/\|$/, "")
		.split("|")
		.map((cell) => cell.trim());
}

/**
 * Finds the GFM pipe table that the cursor is currently sitting inside,
 * by walking outward while lines keep matching the table-row shape.
 * Returns null if the cursor isn't inside a real 2+ column table.
 */
function findTableAtCursor(editor: Editor): TableMatch | null {
	const cursorLine = editor.getCursor().line;
	const totalLines = editor.lineCount();

	if (!isTableRow(editor.getLine(cursorLine))) return null;

	let start = cursorLine;
	while (start > 0 && isTableRow(editor.getLine(start - 1))) start--;

	let end = cursorLine;
	while (end < totalLines - 1 && isTableRow(editor.getLine(end + 1))) end++;

	const lines: string[] = [];
	for (let i = start; i <= end; i++) lines.push(editor.getLine(i));

	// Row 0 is the header, row 1 must be the --- separator for this to be a real table.
	if (lines.length < 3 || !isSeparatorRow(lines[1]!)) return null;

	const rows: ParsedSecretRow[] = [];
	for (const line of lines.slice(2)) {
		const cells = splitRow(line);
		if (cells.length < 2) continue;

		const [rawKey, value] = cells;
		if (!rawKey || !value) continue;

		rows.push({
			rawKey,
			secretId: slugify(rawKey),
			value,
			alreadyExists: false, // filled in by the caller, which has access to app.secretStorage
		});
	}

	return rows.length > 0 ? { startLine: start, endLine: end, rows } : null;
}

class ConfirmMigrationModal extends Modal {
	constructor(
		app: App,
		private rows: ParsedSecretRow[],
		private onConfirm: () => void
	) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		// @ts-ignore 
		contentEl.createEl("h2", { text: "Move secrets to secretstorage?" });
		contentEl.createEl("p", {
			text: "This will write each row below to secretstorage, then replace the table in your note with secret ids only — the plaintext values will be removed from the note.",
		});

		const list = contentEl.createEl("ul");
		for (const row of this.rows) {
			const item = list.createEl("li");
			const valid = isValidSecretId(row.secretId);

			let text = `"${row.rawKey}" → secretStorage id "${row.secretId}"`;
			if (!valid) text += "  (invalid id — will be skipped)";
			else if (row.alreadyExists) text += "  (existing secret will be overwritten)";

			item.setText(text);
			if (!valid || row.alreadyExists) item.addClass("mod-warning");
		}

		new Setting(contentEl)
			.addButton((btn) => btn.setButtonText("Cancel").onClick(() => this.close()))
			.addButton((btn) =>
				btn
					.setButtonText("Move secrets")
					.setCta()
					.onClick(() => {
						this.close();
						this.onConfirm();
					})
			);
	}

	onClose() {
		this.contentEl.empty();
	}
}

export default class TableToSecretsPlugin extends Plugin {
	settings!: PluginSettings;

	async onload() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<PluginSettings>);
		this.addCommand({
			id: "convert-table-to-secrets",
			name: "Convert table at Cursor to secretstorage entries",
			editorCallback: (editor: Editor, _view: MarkdownView | MarkdownFileInfo) => {
				const table = findTableAtCursor(editor);
				if (!table) {
					new Notice("Place your Cursor inside a 2-column Markdown table first.");
					return;
				}

				const existingIds = new Set(this.app.secretStorage.listSecrets());
				for (const row of table.rows) {
					row.alreadyExists = existingIds.has(row.secretId);
				}

				new ConfirmMigrationModal(this.app, table.rows, () => {
					this.migrate(editor, table);
				}).open();
			},
		});
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private migrate(editor: Editor, table: TableMatch) {
		const succeeded: ParsedSecretRow[] = [];
		const failed: FailedRow[] = [];

		for (const row of table.rows) {
			if (!isValidSecretId(row.secretId)) {
				failed.push({ row, error: "id is invalid after slugify" });
				continue;
			}
			try {
				// setSecret is synchronous — no await.
				this.app.secretStorage.setSecret(row.secretId, row.value);
				succeeded.push(row);
			} catch (err) {
				failed.push({ row, error: err instanceof Error ? err.message : String(err) });
			}
		}

		if (succeeded.length > 0) {
			const replacement = [
				"| Secret name | SecretStorage ID |",
				"| --- | --- |",
				...succeeded.map((r) => `| ${r.rawKey} | \`${r.secretId}\` |`),
			].join("\n");

			editor.replaceRange(
				replacement,
				{ line: table.startLine, ch: 0 },
				{ line: table.endLine, ch: editor.getLine(table.endLine).length }
			);
		}

		const summary = [`Moved ${succeeded.length} secret(s) to SecretStorage.`];
		if (failed.length > 0) {
			summary.push(`${failed.length} row(s) failed — see console for details.`);
			console.warn("[table-to-secrets] rows that failed to migrate:", failed);
		}
		new Notice(summary.join(" "));
	}
}
