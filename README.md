# Linear Solver for Obsidian

[![CI](https://github.com/Feror-BotMaker/Obsidian-Linear-Solver/actions/workflows/ci.yml/badge.svg)](https://github.com/Feror-BotMaker/Obsidian-Linear-Solver/actions/workflows/ci.yml)

Write a scalar GMPL/MathProg linear model in a fenced code block and see its solution directly in Reading view. Two-variable models also get a theme-aware feasible-region plot.

````markdown
```gmpl
var x1 >= 0;
var x2 >= 0;

maximize z: 30*x1 + 40*x2;

subject to c11: 2*x1 + x2 <= 100;
subject to c12: x1 + 3*x2 <= 120;
subject to c13: 2*x1 + 2*x2 <= 100;

end;
```
````

The plugin reports the objective, variable values, bounds/basis-style statuses, constraint activity and slack. It accepts `gmpl`, `mathprog`, and `mod` fence names.

## Supported GMPL subset

- Scalar `var` declarations with `>=`, `<=`, or fixed (`=`) numeric bounds
- `integer` and `binary` variable modifiers
- One named `maximize` or `minimize` objective
- Named `subject to` constraints using `<=`, `>=`, or `=`
- Linear arithmetic with `+`, `-`, `*`, `/`, and parentheses
- `#` line comments

Indexed sets, parameters, summations, conditional expressions, and nonlinear terms are intentionally not supported yet. The plugin shows a precise parse error instead of silently misreading them.

## Install for development

```bash
npm install
npm run check
```

Copy or symlink this directory into `<vault>/.obsidian/plugins/linear-solver`, then enable **Linear Solver** in Obsidian’s Community plugins settings. The runtime files are `manifest.json`, `main.js`, and `styles.css`.

Or build and install it into a vault in one step:

```bash
./scripts/install-vault.sh /path/to/your/vault
# Equivalent: npm run install:vault -- /path/to/your/vault
```

The installer validates that the destination contains `.obsidian`, builds the current source, and installs only the three runtime files under `.obsidian/plugins/linear-solver`.

During development, `npm run dev` watches and rebuilds `main.js`.

## Releases

Pushing a version tag such as `v0.1.0` runs the full check suite and publishes a GitHub release containing the three Obsidian runtime files plus an installable ZIP. The tag must match the version in `manifest.json`.

To create the same package locally:

```bash
npm run package
```
