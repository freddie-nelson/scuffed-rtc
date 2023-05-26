const fs = require("fs");
const path = require("path");

const dir = __dirname;
const folders = ["client", "server"];
const dist = "dist";

const updateType = process.argv[2]; // p, m, M
if (updateType !== "p" && updateType !== "m" && updateType !== "M") {
  throw new Error("Invalid update type.");
}

for (const folder of folders) {
  const base = fs.readFileSync(`${path.resolve(dir, folder)}/package.json`, "utf8");
  const json = JSON.parse(base);

  const version = json.version.split(".");
  if (updateType === "p") {
    version[2] = (parseInt(version[2]) + 1).toString();
  } else if (updateType === "m") {
    version[1] = (parseInt(version[1]) + 1).toString();
    version[2] = "0";
  } else if (updateType === "M") {
    version[0] = (parseInt(version[0]) + 1).toString();
    version[1] = "0";
    version[2] = "0";
  }
  json.version = version.join(".");

  console.log(`Updating ${folder} to ${json.version}`);

  fs.writeFileSync(`${path.resolve(dir, folder)}/package.json`, JSON.stringify(json, null, 4), "utf8");
}
