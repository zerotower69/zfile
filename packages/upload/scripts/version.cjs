const { execSync } = require("child_process");
const semver = require("semver");

const currentVersion = process.env.npm_package_version;
console.log(currentVersion);
