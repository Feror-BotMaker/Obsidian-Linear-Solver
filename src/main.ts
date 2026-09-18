import { Plugin, PluginSettingTab, Setting } from "obsidian";
import { parseGmpl } from "./parser";
import { renderError, renderResult } from "./render";
import { solveProgram } from "./solver";

interface LinearSolverSettings {
  precision: number;
  showSource: boolean;
}

const DEFAULT_SETTINGS: LinearSolverSettings = {
  precision: 4,
  showSource: true
};

export default class LinearSolverPlugin extends Plugin {
  settings: LinearSolverSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData() as Partial<LinearSolverSettings> | null) };
    for (const language of ["gmpl", "mathprog", "mod"]) {
      this.registerMarkdownCodeBlockProcessor(language, (source, element) => {
        try {
          const program = parseGmpl(source);
          const solution = solveProgram(program);
          renderResult(element, source, program, solution, this.settings);
        } catch (error) {
          renderError(element, source, error, this.settings.showSource);
        }
      });
    }
    this.addSettingTab(new LinearSolverSettingTab(this));
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}

class LinearSolverSettingTab extends PluginSettingTab {
  constructor(private readonly plugin: LinearSolverPlugin) {
    super(plugin.app, plugin);
  }

  display(): void {
    this.containerEl.empty();
    new Setting(this.containerEl)
      .setName("Show model source")
      .setDesc("Keep the GMPL source visible above the result in reading view.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.showSource)
        .onChange(async (value) => {
          this.plugin.settings.showSource = value;
          await this.plugin.saveSettings();
        }));
    new Setting(this.containerEl)
      .setName("Decimal precision")
      .setDesc("Maximum number of decimal places shown in results.")
      .addSlider((slider) => slider
        .setLimits(0, 10, 1)
        .setDynamicTooltip()
        .setValue(this.plugin.settings.precision)
        .onChange(async (value) => {
          this.plugin.settings.precision = value;
          await this.plugin.saveSettings();
        }));
  }
}
