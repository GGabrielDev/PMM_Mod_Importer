const { spawnSync } = require("node:child_process");
const { readFileSync } = require("node:fs");
const manifest = JSON.parse(readFileSync("dist/firefox/manifest.json", "utf8"));
const id = manifest.browser_specific_settings.gecko.id;
if (!process.env.WEB_EXT_API_KEY || !process.env.WEB_EXT_API_SECRET) {
  throw new Error("Signing requires WEB_EXT_API_KEY and WEB_EXT_API_SECRET; unsigned validation does not.");
}
if (!process.env.FIREFOX_ADDON_ID || id !== process.env.FIREFOX_ADDON_ID || id.endsWith("@example.invalid")) {
  throw new Error("Signing requires the configured production FIREFOX_ADDON_ID matching the built manifest.");
}
const command = process.platform === "win32" ? "web-ext.cmd" : "web-ext";
const result = spawnSync(command, ["sign", "--channel=unlisted", "--source-dir=dist/firefox",
  "--artifacts-dir=dist/signed"], { stdio: "inherit", env: process.env });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
