import { defineCommand, runMain } from "citty";
import { addCommand } from "./commands/add.js";
import { createCommand } from "./commands/create.js";
import { checkCommand } from "./commands/check.js";
import { listCommand } from "./commands/list.js";

const main = defineCommand({
  meta: {
    name: "ark",
    version: "0.4.0",
    description:
      "Create projects from catalogs with enforceable architecture contracts",
  },
  subCommands: {
    create: createCommand,
    check: checkCommand,
    list: listCommand,
    add: addCommand,
  },
});

runMain(main);
