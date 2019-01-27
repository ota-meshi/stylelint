"use strict";

const calcAstParser = require("postcss-calc-ast-parser");
const declarationValueIndex = require("../../utils/declarationValueIndex");
const report = require("../../utils/report");
const ruleMessages = require("../../utils/ruleMessages");
const validateOptions = require("../../utils/validateOptions");
const valueParser = require("postcss-value-parser");

const ruleName = "function-calc-no-invalid";

const messages = ruleMessages(ruleName, {
  expectedExpression: () => "Expected a valid expression",
  expectedSpaceBeforeOperator: operator =>
    `Expected space before "${operator}" operator`,
  expectedSpaceAfterOperator: operator =>
    `Expected space after "${operator}" operator`,
  rejectedDivisionByZero: () => "Unexpected division by zero",
  expectedValidResolvedType: operator =>
    `Expected to be compatible with the left and right argument types of "${operator}" operation.`
});

const rule = function(actual) {
  return (root, result) => {
    const validOptions = validateOptions(result, ruleName, { actual });

    if (!validOptions) {
      return;
    }

    root.walkDecls(decl => {
      const checked = [];

      valueParser(decl.value).walk(node => {
        if (node.type !== "function" || node.value.toLowerCase() !== "calc") {
          return;
        }

        if (checked.indexOf(node) >= 0) {
          return;
        }

        checked.push(...getCalcNodes(node));

        checked.push(...node.nodes);

        const ast = calcAstParser.parse(valueParser.stringify(node));

        if (ast.errors.length) {
          for (const error of ast.errors) {
            complain(
              messages.expectedExpression(),
              node.sourceIndex + error.index
            );
          }
        }

        // check empty `calc()` and `()`
        ast.walk(/^(Function|Parentheses)$/, expr => {
          if (expr.nodes.length) {
            return;
          }

          if (expr.type === "Function") {
            if (expr.name.toLowerCase() !== "calc") {
              return;
            }
          }

          complain(
            messages.expectedExpression(),
            node.sourceIndex + expr.source.end.index - 1
          );
        });
        ast.walk("MathExpression", expr => {
          verifyMathExpressions(expr, node);
        });
      });

      function complain(message, valueIndex) {
        report({
          message,
          node: decl,
          index: declarationValueIndex(decl) + valueIndex,
          result,
          ruleName
        });
      }

      /**
       * Verify that each operation expression is valid.
       * Reports when a invalid operation expression is found.
       * @param {object} expression expression node.
       * @param {object} node calc function node.
       * @returns {void}
       */
      function verifyMathExpressions(expression, node) {
        const { operator, left, right } = expression;

        if (operator === "+" || operator === "-") {
          if (
            expression.source.operator.end.index === right.source.start.index
          ) {
            complain(
              messages.expectedSpaceAfterOperator(operator),
              node.sourceIndex + expression.source.operator.end.index
            );
          }

          if (
            expression.source.operator.start.index === left.source.end.index
          ) {
            complain(
              messages.expectedSpaceBeforeOperator(operator),
              node.sourceIndex + expression.source.operator.start.index
            );
          }
        } else if (operator === "/") {
          if (getNumber(right) === 0) {
            complain(
              messages.rejectedDivisionByZero(),
              node.sourceIndex + expression.source.operator.end.index
            );
          }
        }

        if (getResolvedType(expression) === "invalid") {
          complain(
            messages.expectedValidResolvedType(operator),
            node.sourceIndex + expression.source.operator.start.index
          );
        }
      }
    });
  };
};

function getCalcNodes(node) {
  if (node.type !== "function") {
    return [];
  }

  const functionName = node.value.toLowerCase();
  const result = [];

  if (functionName === "calc") {
    result.push(node);
  }

  if (!functionName || functionName === "calc") {
    // find nested calc
    for (const c of node.nodes) {
      result.push(...getCalcNodes(c));
    }
  }

  return result;
}

function getNumber(mathExpression) {
  const r = calcAstParser.reduceExpression(mathExpression);

  if (r && r.type === "Number") {
    return r.value;
  } else {
    return null;
  }
}

function getResolvedType(mathExpression) {
  return calcAstParser.getResolvedType(mathExpression);
}

rule.ruleName = ruleName;
rule.messages = messages;
module.exports = rule;
