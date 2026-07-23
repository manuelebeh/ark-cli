import { defineCommand, runMain } from "citty";
import { addCommand } from "./commands/add.js";
import { adoptCommand } from "./commands/adopt.js";
import { createCommand } from "./commands/create.js";
import { checkCommand } from "./commands/check.js";
import { doctorCommand } from "./commands/doctor.js";
import { listCommand } from "./commands/list.js";
import { removeCommand } from "./commands/remove.js";
import { updateCommand } from "./commands/update.js";

const main = defineCommand({
  meta: {
    name: "ark",
    version: "0.5.0",
    description:
      "Create projects from catalogs with enforceable architecture contracts",
  },
  subCommands: {
    create: createCommand,
    check: checkCommand,
    list: listCommand,
    add: addCommand,
    adopt: adoptCommand,
    update: updateCommand,
    remove: removeCommand,
    doctor: doctorCommand,
  },
});

runMain(main);
