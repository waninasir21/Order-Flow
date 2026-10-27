// Metro config for the mobile app inside the monorepo.
//
// Expo watches the whole repo root (the shared node_modules lives there). That includes the
// web app and the backend, which the phone never bundles: apps/web/.next alone can hold
// thousands of files that change constantly while `next dev` runs. Not watching them
// keeps Metro's file watcher small and quiet. Nothing in apps/mobile imports from them.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);
const repoRoot = path.resolve(__dirname, "../..");

// Turns a folder path into a regex that matches the folder and everything inside it.
const hide = (...parts) => {
  const dir = path.join(repoRoot, ...parts).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${dir}[/\\\\].*`);
};

const existing = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(existing) ? existing : existing ? [existing] : []),
  hide("apps", "web"),
  hide("apps", "backend"),
];

// Expo also adds every workspace folder as a separate watched root. Drop the two the phone
// never uses so Metro doesn't start a watcher for each.
const skipRoots = [path.join(repoRoot, "apps", "web"), path.join(repoRoot, "apps", "backend")];
config.watchFolders = (config.watchFolders ?? []).filter((f) => !skipRoots.includes(path.resolve(f)));

module.exports = config;
