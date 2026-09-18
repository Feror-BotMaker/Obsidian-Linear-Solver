import { describe, expect, it } from "vitest";
import { parseGmpl } from "../src/parser";
import { solveProgram } from "../src/solver";

describe("solveProgram", () => {
  it("solves the example and reports row statuses", () => {
    const program = parseGmpl(`
      var x1 >= 0; var x2 >= 0;
      maximize z: 30*x1 + 40*x2;
      subject to c11: 2*x1 + x2 <= 100;
      subject to c12: x1 + 3*x2 <= 120;
      subject to c13: 2*x1 + 2*x2 <= 100;
    `);
    const solution = solveProgram(program);
    expect(solution.status).toBe("optimal");
    expect(solution.objectiveValue).toBeCloseTo(1850);
    expect(solution.variables.map(({ value }) => value)).toEqual([15, 35]);
    expect(solution.constraints.map(({ status }) => status)).toEqual(["Basic", "At upper bound", "At upper bound"]);
  });

  it("honors negative variable bounds", () => {
    const solution = solveProgram(parseGmpl("var x >= -4, <= -2; maximize z: x;"));
    expect(solution.status).toBe("optimal");
    expect(solution.variables[0]?.value).toBeCloseTo(-2);
    expect(solution.variables[0]?.status).toBe("At upper bound");
  });
});
