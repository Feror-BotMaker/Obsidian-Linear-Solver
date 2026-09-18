import type { LinearProgram, Solution } from "./model";

interface Point { x: number; y: number }
interface HalfPlane { a: number; b: number; c: number; keepLess: boolean }

const SVG_NS = "http://www.w3.org/2000/svg";
const EPSILON = 1e-9;

function svg<K extends keyof SVGElementTagNameMap>(name: K, attributes: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  return element;
}

function intersect(start: Point, end: Point, plane: HalfPlane): Point {
  const startValue = plane.a * start.x + plane.b * start.y - plane.c;
  const endValue = plane.a * end.x + plane.b * end.y - plane.c;
  const ratio = startValue / (startValue - endValue);
  return { x: start.x + ratio * (end.x - start.x), y: start.y + ratio * (end.y - start.y) };
}

function inside(point: Point, plane: HalfPlane): boolean {
  const value = plane.a * point.x + plane.b * point.y - plane.c;
  return plane.keepLess ? value <= EPSILON : value >= -EPSILON;
}

function clipPolygon(polygon: Point[], plane: HalfPlane): Point[] {
  const result: Point[] = [];
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index]!;
    const end = polygon[(index + 1) % polygon.length]!;
    const startInside = inside(start, plane);
    const endInside = inside(end, plane);
    if (startInside && endInside) result.push(end);
    else if (startInside) result.push(intersect(start, end, plane));
    else if (endInside) result.push(intersect(start, end, plane), end);
  }
  return result;
}

function niceStep(span: number, target = 6): number {
  const raw = span / target;
  const power = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / power;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * power;
}

function formatTick(value: number): string {
  if (Math.abs(value) < 1e-9) return "0";
  return Number(value.toPrecision(5)).toString();
}

function plotRanges(program: LinearProgram, solution: Solution): { minX: number; maxX: number; minY: number; maxY: number } {
  const [x, y] = program.variables;
  const pointsX: number[] = [0, solution.variables[0]?.value ?? 0];
  const pointsY: number[] = [0, solution.variables[1]?.value ?? 0];
  if (Number.isFinite(x!.lower)) pointsX.push(x!.lower);
  if (Number.isFinite(x!.upper)) pointsX.push(x!.upper);
  if (Number.isFinite(y!.lower)) pointsY.push(y!.lower);
  if (Number.isFinite(y!.upper)) pointsY.push(y!.upper);
  for (const constraint of program.constraints) {
    const a = constraint.expression.coefficients[x!.name] ?? 0;
    const b = constraint.expression.coefficients[y!.name] ?? 0;
    if (Math.abs(a) > EPSILON) pointsX.push(constraint.rhs / a);
    if (Math.abs(b) > EPSILON) pointsY.push(constraint.rhs / b);
  }
  const finiteX = pointsX.filter(Number.isFinite);
  const finiteY = pointsY.filter(Number.isFinite);
  let minX = Math.min(...finiteX);
  let maxX = Math.max(...finiteX);
  let minY = Math.min(...finiteY);
  let maxY = Math.max(...finiteY);
  if (maxX - minX < 1) maxX = minX + 10;
  if (maxY - minY < 1) maxY = minY + 10;
  const padX = (maxX - minX) * 0.14;
  const padY = (maxY - minY) * 0.14;
  return { minX: minX - padX, maxX: maxX + padX, minY: minY - padY, maxY: maxY + padY };
}

export function createFeasiblePlot(program: LinearProgram, solution: Solution): HTMLElement | null {
  if (program.variables.length !== 2 || solution.status !== "optimal") return null;
  const [xVariable, yVariable] = program.variables;
  const range = plotRanges(program, solution);
  const planes: HalfPlane[] = program.constraints.flatMap((constraint) => {
    const plane = {
      a: constraint.expression.coefficients[xVariable!.name] ?? 0,
      b: constraint.expression.coefficients[yVariable!.name] ?? 0,
      c: constraint.rhs
    };
    if (constraint.relation === "=") return [{ ...plane, keepLess: true }, { ...plane, keepLess: false }];
    return [{ ...plane, keepLess: constraint.relation === "<=" }];
  });
  for (const [index, variable] of program.variables.entries()) {
    if (Number.isFinite(variable.lower)) planes.push({ a: index === 0 ? 1 : 0, b: index === 1 ? 1 : 0, c: variable.lower, keepLess: false });
    if (Number.isFinite(variable.upper)) planes.push({ a: index === 0 ? 1 : 0, b: index === 1 ? 1 : 0, c: variable.upper, keepLess: true });
  }
  let polygon: Point[] = [
    { x: range.minX, y: range.minY }, { x: range.maxX, y: range.minY },
    { x: range.maxX, y: range.maxY }, { x: range.minX, y: range.maxY }
  ];
  for (const plane of planes) polygon = clipPolygon(polygon, plane);

  const wrapper = document.createElement("div");
  wrapper.className = "linear-solver-plot";
  const chart = svg("svg", { viewBox: "0 0 720 430", role: "img", "aria-label": `Feasible region for ${xVariable!.name} and ${yVariable!.name}` });
  wrapper.appendChild(chart);
  const margin = { left: 68, right: 24, top: 30, bottom: 58 };
  const width = 720 - margin.left - margin.right;
  const height = 430 - margin.top - margin.bottom;
  const px = (value: number) => margin.left + ((value - range.minX) / (range.maxX - range.minX)) * width;
  const py = (value: number) => margin.top + height - ((value - range.minY) / (range.maxY - range.minY)) * height;

  const defs = svg("defs");
  const clip = svg("clipPath", { id: `linear-solver-clip-${Math.random().toString(36).slice(2)}` });
  clip.appendChild(svg("rect", { x: margin.left, y: margin.top, width, height, rx: 8 }));
  defs.appendChild(clip);
  chart.appendChild(defs);
  const grid = svg("g", { class: "linear-solver-grid" });
  const xStep = niceStep(range.maxX - range.minX);
  const yStep = niceStep(range.maxY - range.minY);
  for (let value = Math.ceil(range.minX / xStep) * xStep; value <= range.maxX + EPSILON; value += xStep) {
    const x = px(value);
    grid.appendChild(svg("line", { x1: x, x2: x, y1: margin.top, y2: margin.top + height }));
    const label = svg("text", { x, y: margin.top + height + 25, "text-anchor": "middle" });
    label.textContent = formatTick(value);
    grid.appendChild(label);
  }
  for (let value = Math.ceil(range.minY / yStep) * yStep; value <= range.maxY + EPSILON; value += yStep) {
    const y = py(value);
    grid.appendChild(svg("line", { x1: margin.left, x2: margin.left + width, y1: y, y2: y }));
    const label = svg("text", { x: margin.left - 13, y: y + 4, "text-anchor": "end" });
    label.textContent = formatTick(value);
    grid.appendChild(label);
  }
  chart.appendChild(grid);

  const clipped = svg("g", { "clip-path": `url(#${clip.id})` });
  for (const constraint of program.constraints) {
    const a = constraint.expression.coefficients[xVariable!.name] ?? 0;
    const b = constraint.expression.coefficients[yVariable!.name] ?? 0;
    if (Math.abs(a) < EPSILON && Math.abs(b) < EPSILON) continue;
    let start: Point;
    let end: Point;
    if (Math.abs(b) > EPSILON) {
      start = { x: range.minX, y: (constraint.rhs - a * range.minX) / b };
      end = { x: range.maxX, y: (constraint.rhs - a * range.maxX) / b };
    } else {
      start = { x: constraint.rhs / a, y: range.minY };
      end = { x: constraint.rhs / a, y: range.maxY };
    }
    clipped.appendChild(svg("line", { class: "linear-solver-constraint-line", x1: px(start.x), y1: py(start.y), x2: px(end.x), y2: py(end.y) }));
  }
  if (polygon.length >= 3) {
    clipped.appendChild(svg("polygon", {
      class: "linear-solver-region",
      points: polygon.map((point) => `${px(point.x)},${py(point.y)}`).join(" ")
    }));
  }
  const optimum = { x: solution.variables[0]!.value, y: solution.variables[1]!.value };
  clipped.appendChild(svg("circle", { class: "linear-solver-optimum-halo", cx: px(optimum.x), cy: py(optimum.y), r: 11 }));
  clipped.appendChild(svg("circle", { class: "linear-solver-optimum", cx: px(optimum.x), cy: py(optimum.y), r: 5 }));
  chart.appendChild(clipped);

  const xLabel = svg("text", { class: "linear-solver-axis-title", x: margin.left + width / 2, y: 418, "text-anchor": "middle" });
  xLabel.textContent = xVariable!.name;
  const yLabel = svg("text", { class: "linear-solver-axis-title", x: 18, y: margin.top + height / 2, transform: `rotate(-90 18 ${margin.top + height / 2})`, "text-anchor": "middle" });
  yLabel.textContent = yVariable!.name;
  chart.append(xLabel, yLabel);
  return wrapper;
}
