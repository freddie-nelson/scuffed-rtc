const fs = require("fs");
const path = require("path");

const dir = __dirname;
const folders = ["client", "server"];

const typesDir = path.resolve(dir, "@types");

for (const folder of folders) {
  fs.cpSync(typesDir, path.resolve(dir, folder, "@types"), { recursive: true });
}
