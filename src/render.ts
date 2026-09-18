import { createFeasiblePlot } from "./plot";
import type { LinearProgram, Solution } from "./model";

export interface RenderOptions { precision: number; showSource: boolean }

function formatNumber(value: number, precision: number): string {
  if (!Number.isFinite(value)) return value > 0 ? "∞" : "−∞";
  if (Math.abs(value) < 10 ** -(precision + 1)) return "0";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: precision }).format(value);
}

function badge(text: string, tone: string): HTMLElement {
  const element = document.createElement("span");
  element.className = `linear-solver-badge linear-solver-badge--${tone}`;
  element.textContent = text;
  return element;
}

function makeTable(headers: string[], rows: (string | HTMLElement)[][]): HTMLTableElement {
  const table = document.createElement("table");
  table.className = "linear-solver-table";
  const thead = table.createTHead();
  const headerRow = thead.insertRow();
  for (const header of headers) {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = header;
    headerRow.appendChild(cell);
  }
  const tbody = table.createTBody();
  for (const row of rows) {
    const tr = tbody.insertRow();
    for (const value of row) {
      const cell = tr.insertCell();
      if (typeof value === "string") cell.textContent = value;
      else cell.appendChild(value);
    }
  }
  return table;
}

function statusTone(status: string): string {
  if (status === "Basic" || status === "Free") return "quiet";
  if (status === "Fixed") return "fixed";
  return "bound";
}

export function renderResult(container: HTMLElement, source: string, program: LinearProgram, solution: Solution, options: RenderOptions): void {
  container.empty();
  container.addClass("linear-solver");
  if (options.showSource) {
    const sourcePanel = container.createEl("div", { cls: "linear-solver-source" });
    const pre = sourcePanel.createEl("pre");
    pre.createEl("code", { text: source });
  }
  const result = container.createEl("section", { cls: "linear-solver-result" });
  const header = result.createEl("header", { cls: "linear-solver-header" });
  const titleGroup = header.createEl("div");
  titleGroup.createEl("span", { cls: "linear-solver-eyebrow", text: "LINEAR PROGRAM" });
  titleGroup.createEl("h4", { text: program.objective.name });
  const tone = solution.status === "optimal" ? "success" : solution.status === "error" ? "danger" : "warning";
  header.appendChild(badge(solution.status, tone));

  if (solution.status !== "optimal") {
    result.createEl("p", { cls: "linear-solver-message", text: solution.message ?? "The model could not be solved." });
    return;
  }

  const summary = result.createEl("div", { cls: "linear-solver-summary" });
  const metric = summary.createEl("div", { cls: "linear-solver-objective" });
  metric.createEl("span", { text: `${program.objective.sense === "maximize" ? "Maximum" : "Minimum"} objective` });
  metric.createEl("strong", { text: formatNumber(solution.objectiveValue!, options.precision) });
  const compactVariables = summary.createEl("div", { cls: "linear-solver-compact-values" });
  for (const variable of solution.variables) {
    const item = compactVariables.createEl("span");
    item.createEl("code", { text: variable.name });
    item.appendText(` = ${formatNumber(variable.value, options.precision)}`);
  }

  const plot = createFeasiblePlot(program, solution);
  if (plot) {
    const figure = result.createEl("figure", { cls: "linear-solver-figure" });
    const caption = figure.createEl("figcaption");
    caption.createEl("strong", { text: "Feasible region" });
    caption.createEl("span", { text: "constraint boundaries and optimum" });
    figure.appendChild(plot);
  } else if (program.variables.length !== 2) {
    result.createEl("p", { cls: "linear-solver-plot-note", text: `Plot unavailable: this model has ${program.variables.length} variables; plotting requires exactly two.` });
  }

  const details = result.createEl("div", { cls: "linear-solver-details" });
  const variableSection = details.createEl("section");
  variableSection.createEl("h5", { text: "Variables" });
  variableSection.appendChild(makeTable(
    ["Name", "Value", "Status"],
    solution.variables.map((variable) => [
      variable.name,
      formatNumber(variable.value, options.precision),
      badge(variable.status, statusTone(variable.status))
    ])
  ));
  const constraintSection = details.createEl("section");
  constraintSection.createEl("h5", { text: "Constraints" });
  constraintSection.appendChild(makeTable(
    ["Name", "Activity", "Slack", "Status"],
    solution.constraints.map((constraint) => [
      constraint.name,
      formatNumber(constraint.activity, options.precision),
      formatNumber(constraint.slack, options.precision),
      badge(constraint.status, statusTone(constraint.status))
    ])
  ));
}

export function renderError(container: HTMLElement, source: string, error: unknown, showSource: boolean): void {
  container.empty();
  container.addClass("linear-solver");
  if (showSource) {
    const sourcePanel = container.createEl("div", { cls: "linear-solver-source" });
    const pre = sourcePanel.createEl("pre");
    pre.createEl("code", { text: source });
  }
  const panel = container.createEl("section", { cls: "linear-solver-result linear-solver-error" });
  const header = panel.createEl("header", { cls: "linear-solver-header" });
  header.createEl("h4", { text: "Couldn’t read this model" });
  header.appendChild(badge("parse error", "danger"));
  panel.createEl("pre", { cls: "linear-solver-error-detail", text: error instanceof Error ? error.message : String(error) });
}
