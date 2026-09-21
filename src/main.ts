import { Plugin, PluginSettingTab } from "obsidian";
import type { SettingDefinitionItem } from "obsidian";
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

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        name: "Show model source",
        desc: "Keep the GMPL source visible above the result in reading view.",
        control: {
          type: "toggle",
          key: "showSource",
          defaultValue: DEFAULT_SETTINGS.showSource
        }
      },
      {
        name: "Decimal precision",
        desc: "Maximum number of decimal places shown in results.",
        control: {
          type: "slider",
          key: "precision",
          min: 0,
          max: 10,
          step: 1,
          defaultValue: DEFAULT_SETTINGS.precision
        }
      }
    ];
  }

  getControlValue(key: string): unknown {
    if (key === "showSource") return this.plugin.settings.showSource;
    if (key === "precision") return this.plugin.settings.precision;
    return undefined;
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    if (key === "showSource" && typeof value === "boolean") this.plugin.settings.showSource = value;
    else if (key === "precision" && typeof value === "number") this.plugin.settings.precision = value;
    else return;
    await this.plugin.saveSettings();
  }
}
