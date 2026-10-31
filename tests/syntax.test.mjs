import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("the whole app script (all modules, boot included) parses", () => {
  const order = fs.readFileSync(path.join(ROOT, "src/_order.txt"), "utf8").split("\n").map(s => s.trim()).filter(Boolean);
  new vm.Script(order.map(n => fs.readFileSync(path.join(ROOT, "src", n), "utf8")).join("\n"), { filename: "app.js" });
  new vm.Script(fs.readFileSync(path.join(ROOT, "web/sw.js"), "utf8"), { filename: "sw.js" });
  new vm.Script(fs.readFileSync(path.join(ROOT, "web/config.js"), "utf8"), { filename: "config.js" });
});
