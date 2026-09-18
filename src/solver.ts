import solver from "javascript-lp-solver";
import type { ConstraintDefinition, LinearProgram, Solution, VariableDefinition } from "./model";

const EPSILON = 1e-7;
const OBJECTIVE_KEY = "__linear_solver_objective";
const INTERNAL_PREFIX = "__linear_solver_bound_";

interface SolverModel {
  optimize: string;
  opType: "max" | "min";
  constraints: Record<string, { min?: number; max?: number; equal?: number }>;
  variables: Record<string, Record<string, number>>;
  unrestricted: Record<string, 1>;
  ints: Record<string, 1>;
  binaries: Record<string, 1>;
}

interface RawResult {
  feasible?: boolean;
  bounded?: boolean;
  result?: number;
  [name: string]: number | boolean | undefined;
}

function almostEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= EPSILON * Math.max(1, Math.abs(left), Math.abs(right));
}

function constraintBound(constraint: ConstraintDefinition): { min?: number; max?: number; equal?: number } {
  if (constraint.relation === "<=") return { max: constraint.rhs };
  if (constraint.relation === ">=") return { min: constraint.rhs };
  return { equal: constraint.rhs };
}

function variableStatus(variable: VariableDefinition, value: number): Solution["variables"][number]["status"] {
  if (Number.isFinite(variable.lower) && Number.isFinite(variable.upper) && almostEqual(variable.lower, variable.upper)) return "Fixed";
  if (Number.isFinite(variable.lower) && almostEqual(value, variable.lower)) return "At lower bound";
  if (Number.isFinite(variable.upper) && almostEqual(value, variable.upper)) return "At upper bound";
  if (!Number.isFinite(variable.lower) && !Number.isFinite(variable.upper)) return "Free";
  return "Basic";
}

export function solveProgram(program: LinearProgram): Solution {
  const model: SolverModel = {
    optimize: OBJECTIVE_KEY,
    opType: program.objective.sense === "maximize" ? "max" : "min",
    constraints: {},
    variables: {},
    unrestricted: {},
    ints: {},
    binaries: {}
  };

  for (const constraint of program.constraints) model.constraints[constraint.name] = constraintBound(constraint);
  for (const variable of program.variables) {
    const column: Record<string, number> = {
      [OBJECTIVE_KEY]: program.objective.expression.coefficients[variable.name] ?? 0
    };
    for (const constraint of program.constraints) column[constraint.name] = constraint.expression.coefficients[variable.name] ?? 0;

    if (Number.isFinite(variable.lower)) {
      const key = `${INTERNAL_PREFIX}${variable.name}_lower`;
      model.constraints[key] = { min: variable.lower };
      column[key] = 1;
    }
    if (!Number.isFinite(variable.lower) || variable.lower < 0) model.unrestricted[variable.name] = 1;
    if (Number.isFinite(variable.upper)) {
      const key = `${INTERNAL_PREFIX}${variable.name}_upper`;
      model.constraints[key] = { max: variable.upper };
      column[key] = 1;
    }
    if (variable.kind === "integer") model.ints[variable.name] = 1;
    if (variable.kind === "binary") model.binaries[variable.name] = 1;
    model.variables[variable.name] = column;
  }

  try {
    const raw = solver.Solve(model as never) as RawResult;
    if (raw.feasible === false) return { status: "infeasible", variables: [], constraints: [], message: "The model has no feasible solution." };
    if (raw.bounded === false) return { status: "unbounded", variables: [], constraints: [], message: "The objective is unbounded." };
    const values = Object.fromEntries(program.variables.map(({ name }) => [name, typeof raw[name] === "number" ? raw[name] : 0]));
    const variables = program.variables.map((variable) => ({
      ...variable,
      value: values[variable.name]!,
      status: variableStatus(variable, values[variable.name]!)
    }));
    const constraints = program.constraints.map((constraint) => {
      const activity = Object.entries(constraint.expression.coefficients)
        .reduce((total, [name, coefficient]) => total + coefficient * (values[name] ?? 0), 0);
      const slack = constraint.relation === ">=" ? activity - constraint.rhs : constraint.rhs - activity;
      const binding = almostEqual(activity, constraint.rhs);
      return {
        ...constraint,
        activity,
        slack: Math.abs(slack) < EPSILON ? 0 : slack,
        status: constraint.relation === "=" ? "Fixed" as const
          : binding ? (constraint.relation === "<=" ? "At upper bound" as const : "At lower bound" as const)
          : "Basic" as const
      };
    });
    const objectiveValue = (typeof raw.result === "number" ? raw.result : 0) + program.objective.expression.constant;
    return { status: "optimal", objectiveValue, variables, constraints };
  } catch (error) {
    return {
      status: "error",
      variables: [],
      constraints: [],
      message: error instanceof Error ? error.message : "The solver failed unexpectedly."
    };
  }
}
