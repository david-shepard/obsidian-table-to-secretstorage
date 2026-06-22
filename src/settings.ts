import { App, PluginSettingTab, Setting } from 'obsidian';
import TableToSecretsPlugin from './main';

export interface PluginSettings {
	futureSetting: string;
}

export const DEFAULT_SETTINGS: PluginSettings = {
	futureSetting: 'default',
};

export class SettingsTab extends PluginSettingTab {
	plugin: TableToSecretsPlugin;

	constructor(app: App, plugin: TableToSecretsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Settings #1')
			.setDesc("It's a secret")
			.addText((text) =>
				text
					.setPlaceholder('Enter your secret')
					.setValue(this.plugin.settings.futureSetting)
					.onChange(async (value) => {
						this.plugin.settings.futureSetting = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
