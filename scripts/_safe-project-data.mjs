import { readFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

export const projectRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
);

/** @param {string} path */
export function assertProjectPath(path) {
  const absolute = resolve(path);
  if (
    absolute !== projectRoot &&
    !absolute.startsWith(`${projectRoot}${sep}`)
  ) {
    throw new Error(
      `Refusing to access a path outside the portfolio: ${absolute}`,
    );
  }
  return absolute;
}

/** @param {import("typescript").Expression} expression */
function unwrap(expression) {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isSatisfiesExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

/**
 * Evaluate data-only syntax. Function calls, imports, identifiers, computed
 * properties, spreads, and template expressions are rejected rather than run.
 *
 * @param {import("typescript").Expression} expression
 * @param {Map<string, unknown>} [bindings]
 * @returns {unknown}
 */
function literalValue(expression, bindings = new Map()) {
  const node = unwrap(expression);
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isIdentifier(node) && node.text === "undefined") return undefined;
  if (ts.isIdentifier(node) && bindings.has(node.text)) {
    return bindings.get(node.text);
  }
  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.MinusToken
  ) {
    const operand = literalValue(node.operand, bindings);
    if (typeof operand === "number") return -operand;
  }
  if (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "defineProject" &&
    node.arguments.length === 1
  ) {
    const seed = literalValue(node.arguments[0], bindings);
    if (!seed || typeof seed !== "object" || Array.isArray(seed)) {
      throw new Error("defineProject requires one object literal.");
    }
    const defaultLimitation =
      typeof bindings.get("defaultLimitation") === "string"
        ? bindings.get("defaultLimitation")
        : "Research prototype; repository evidence does not establish broad real-world performance.";
    return {
      repositoryUrl: `https://github.com/pxnkit/${seed.slug}`,
      sourceStatus: "verified",
      implementationStatus: "research-prototype",
      claimStatus: "research-claim-open",
      limitations: [defaultLimitation],
      ...seed,
    };
  }
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.map((element) => {
      if (ts.isSpreadElement(element)) {
        throw new Error("Spread elements are not allowed in project data.");
      }
      return literalValue(element, bindings);
    });
  }
  if (ts.isObjectLiteralExpression(node)) {
    const value = {};
    for (const property of node.properties) {
      if (ts.isSpreadAssignment(property)) {
        const spread = literalValue(property.expression, bindings);
        if (!spread || typeof spread !== "object" || Array.isArray(spread)) {
          throw new Error("Object spreads must resolve to data-only objects.");
        }
        Object.assign(value, spread);
        continue;
      }
      if (!ts.isPropertyAssignment(property)) {
        throw new Error(
          "Only explicit property assignments are allowed in project data.",
        );
      }
      let name;
      if (
        ts.isIdentifier(property.name) ||
        ts.isStringLiteral(property.name) ||
        ts.isNumericLiteral(property.name)
      ) {
        name = property.name.text;
      } else {
        throw new Error(
          "Computed property names are not allowed in project data.",
        );
      }
      value[name] = literalValue(property.initializer, bindings);
    }
    return value;
  }
  throw new Error(
    `Unsupported executable syntax in project data: ${ts.SyntaxKind[node.kind]}.`,
  );
}

/**
 * Parse an exported literal without importing the module.
 *
 * @param {string} path
 * @param {string} exportName
 */
export async function readLiteralExport(path, exportName) {
  const absolute = assertProjectPath(path);
  const sourceText = await readFile(absolute, "utf8");
  const source = ts.createSourceFile(
    absolute,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  const bindings = new Map();
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        !ts.isIdentifier(declaration.name) ||
        declaration.name.text === exportName ||
        !declaration.initializer
      ) {
        continue;
      }
      try {
        bindings.set(
          declaration.name.text,
          literalValue(declaration.initializer, bindings),
        );
      } catch {
        // Non-data helpers such as maps and filtered arrays are irrelevant.
      }
    }
  }

  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === exportName &&
        declaration.initializer
      ) {
        return literalValue(declaration.initializer, bindings);
      }
    }
  }
  throw new Error(
    `Could not find literal export "${exportName}" in ${absolute}.`,
  );
}

/** @param {string} path @param {unknown} fallback */
export async function readOptionalJson(path, fallback) {
  const absolute = assertProjectPath(path);
  try {
    return JSON.parse(await readFile(absolute, "utf8"));
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT")
      return fallback;
    throw error;
  }
}

/** @param {string[]} argv */
export function parseArguments(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const equals = token.indexOf("=");
    if (equals > 2) {
      args.set(token.slice(2, equals), token.slice(equals + 1));
      continue;
    }
    const name = token.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args.set(name, next);
      index += 1;
    } else {
      args.set(name, true);
    }
  }
  return args;
}

/** @param {string} path */
export function relativeProjectPath(path) {
  return assertProjectPath(path)
    .slice(projectRoot.length + 1)
    .replaceAll("\\", "/");
}
