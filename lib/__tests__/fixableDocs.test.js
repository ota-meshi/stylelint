"use strict";

const fs = require("fs");
const path = require("path");

function getFixableRules() {
  const rulesRoot = path.resolve(__dirname, "../rules");
  const list = fs.readdirSync(rulesRoot);
  const result = {};

  for (const name of list) {
    const dirPath = path.resolve(rulesRoot, name);

    if (!fs.statSync(dirPath).isDirectory()) {
      continue;
    }

    for (const testName of fs.readdirSync(path.resolve(dirPath, "__tests__"))) {
      const testPath = path.resolve(dirPath, "__tests__/" + testName);

      if (testPath.indexOf(".js") !== testPath.length - 3) {
        continue;
      }

      if (fs.statSync(testPath).isDirectory()) {
        continue;
      }

      const context = fs.readFileSync(
        path.resolve(dirPath, "__tests__/" + testName),
        "utf8"
      );

      if (/\bfix\s*:\s*true\s*,/g.test(context)) {
        result[name] = dirPath;
        break;
      }
    }
  }

  return result;
}

const fixableRules = getFixableRules();

const unfixableRules = [];

describe("Checks whether there is an `(Autofixable)` mark.", () => {
  const userGuideRules = fs.readFileSync(
    path.resolve(__dirname, "../../docs/user-guide/rules.md"),
    "utf8"
  );
  const re = /^- {3}\[`([a-z-]+)`]\(\S+README.md\):([\S\s]+?)$/gm;
  let match = undefined;

  while ((match = re.exec(userGuideRules)) !== null) {
    const line = match[0];
    const name = match[1];

    if (/\(Autofixable\)/.test(line)) {
      it(
        "Fixable rules should be marked as `(Autofixable)`. @docs/user-guide/rules.md#" +
          name,
        () => {
          // expected fixable
          expect(!!fixableRules[name]).toBe(true);
        }
      );
    } else {
      unfixableRules.push(name);
      it(
        "Unfixable rules should not be marked as `(Autofixable)`. @docs/user-guide/rules.md#" +
          name,
        () => {
          // expected not fixable
          expect(!fixableRules[name]).toBe(true);
        }
      );
    }
  }
});

console.log(JSON.stringify(unfixableRules.sort(), null, "    "));

describe("Check if there is a description of the `--fix` option.", () => {
  for (const name in fixableRules) {
    const dirPath = fixableRules[name];
    const readme = fs.readFileSync(
      path.resolve(dirPath, "./README.md"),
      "utf8"
    );

    it("@" + name + "/README.md", () => {
      const fixDescription = /The `--fix` option on the \[command line\]\(\.\.\/\.\.\/\.\.\/docs\/user-guide\/cli\.md#autofixing-errors\) can automatically fix (all|most|some) of the problems reported by this rule\./gm;

      expect(fixDescription.test(readme)).toBe(true);
    });
  }
});
