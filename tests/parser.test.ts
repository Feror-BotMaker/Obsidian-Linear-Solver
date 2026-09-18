import { describe, expect, it } from "vitest";
import { parseGmpl, parseLinearExpression } from "../src/parser";

const example = `
var x1 >= 0;
var x2 >= 0;
maximize z: 30*x1 + 40*x2;
subject to c11: 2*x1 + x2 <= 100;
subject to c12: x1 + 3*x2 <= 120;
subject to c13: 2*x1 + 2*x2 <= 100;
end;
`;

describe("parseLinearExpression", () => {
  it("handles scalar multiplication, division and parentheses", () => {
    expect(parseLinearExpression("2 * (x + 3*y) - z/2 + 4")).toEqual({
      coefficients: { x: 2, y: 6, z: -0.5 },
      constant: 4
    });
  });

  it("rejects non-linear products", () => {
    expect(() => parseLinearExpression("x*y")).toThrow(/Non-linear/);
  });
});

describe("parseGmpl", () => {
  it("parses the requested model", () => {
    const model = parseGmpl(example);
    expect(model.variables).toHaveLength(2);
    expect(model.objective.expression.coefficients).toEqual({ x1: 30, x2: 40 });
    expect(model.constraints.map(({ name, rhs }) => [name, rhs])).toEqual([
      ["c11", 100], ["c12", 120], ["c13", 100]
    ]);
  });

  it("moves expressions on the right to the left", () => {
    const model = parseGmpl("var x; var y; minimize cost: x; subject to balance: 2*x <= y + 6;");
    expect(model.constraints[0]).toMatchObject({
      expression: { coefficients: { x: 2, y: -1 }, constant: 0 },
      rhs: 6
    });
  });

  it("accepts the short constraint spelling", () => {
    const model = parseGmpl("var x >= 0; maximize z: x; s.t. cap: x <= 2;");
    expect(model.constraints[0]?.name).toBe("cap");
  });
});
