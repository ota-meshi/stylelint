"use strict";
const jasmine = require("jasmine-node");
global.jest = { mock() {} };
jasmine.getGlobal();
require("./jest-setup");
expect.extend = obj => {
  beforeEach(function() {
    this.addMatchers({
      toHaveMessage() {
        return { compare: obj.toHaveMessage };
      }
    });
  });
};

require("./lib/rules/value-list-comma-space-after/__tests__");

jasmine.getEnv().execute();
