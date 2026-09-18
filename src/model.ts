export type Sense = "maximize" | "minimize";
export type Relation = "<=" | ">=" | "=";

export interface LinearExpression {
  coefficients: Record<string, number>;
  constant: number;
}

export interface VariableDefinition {
  name: string;
  lower: number;
  upper: number;
  kind: "continuous" | "integer" | "binary";
}

export interface ConstraintDefinition {
  name: string;
  expression: LinearExpression;
  relation: Relation;
  rhs: number;
}

export interface LinearProgram {
  variables: VariableDefinition[];
  objective: {
    name: string;
    sense: Sense;
    expression: LinearExpression;
  };
  constraints: ConstraintDefinition[];
}

export type SolveStatus = "optimal" | "infeasible" | "unbounded" | "error";

export interface ConstraintResult extends ConstraintDefinition {
  activity: number;
  slack: number;
  status: "Basic" | "At upper bound" | "At lower bound" | "Fixed";
}

export interface VariableResult extends VariableDefinition {
  value: number;
  status: "Basic" | "At upper bound" | "At lower bound" | "Fixed" | "Free";
}

export interface Solution {
  status: SolveStatus;
  objectiveValue?: number;
  variables: VariableResult[];
  constraints: ConstraintResult[];
  message?: string;
}
