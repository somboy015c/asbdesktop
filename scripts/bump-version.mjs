// Usage: node scripts/bump-version.mjs <patch|minor|major> [exact-version]
// Updates every place the version lives and prints it for the workflow.
import fs from 'node:fs';

const [, , bump = 'patch', exact = ''] = process.argv;
const read = (p) => fs.readFileSync(p, 'utf8');

const confPath = 'src-tauri/tauri.conf.json';
const conf = JSON.parse(read(confPath));
const current = conf.version;

let next;
if (exact.trim()) {
  next = exact.trim().replace(/^v/, '');
  if (!/^\d+\.\d+\.\d+$/.test(next)) {
    console.error(`"${exact}" is not a valid version (expected e.g. 1.4.0)`);
    process.exit(1);
  }
} else {
  let [major, minor, patch] = current.split('.').map(Number);
  if (bump === 'major') { major++; minor = 0; patch = 0; }
  else if (bump === 'minor') { minor++; patch = 0; }
  else { patch++; }
  next = `${major}.${minor}.${patch}`;
}

conf.version = next;
fs.writeFileSync(confPath, JSON.stringify(conf, null, 2) + '\n');

const pkg = JSON.parse(read('package.json'));
pkg.version = next;
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');

const cargo = read('src-tauri/Cargo.toml').replace(/^version = ".*"$/m, `version = "${next}"`);
fs.writeFileSync('src-tauri/Cargo.toml', cargo);

console.log(`Version ${current} -> ${next}`);
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `version=${next}\n`);
