import { runAll } from "./harness";

import "./rewards.test";
import "./merchantMatch.test";
import "./nudgePolicy.test";
import "./spend.test";
import "./schema.test";
import "./wallet.test";
import "./quarterly.test";
import "./exclusions.test";

void runAll().then((failures) => {
  process.exitCode = failures > 0 ? 1 : 0;
});
