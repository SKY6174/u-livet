import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const version = pkg.devDependencies.supabase;
assert.match(version, /^3\.\d+\.\d+$/);
assert.equal(lock.packages[""].devDependencies.supabase, version);
assert.equal(lock.packages["node_modules/supabase"].version, version);
const cli = resolve("node_modules/.bin/supabase");
const run = args => {
  const result = spawnSync(cli, args, { encoding: "utf8", timeout: 30000 });
  assert.equal(result.status, 0, `CLI command failed: ${args.slice(0, 2).join(" ")}`);
  assert.doesNotMatch(result.stderr, /deprecated|no longer supported/i);
  return result.stdout;
};
assert.equal(run(["--version"]).trim(), version);
for (const args of [["db", "query"], ["db", "push"], ["functions", "deploy"], ["projects", "api-keys"]]) {
  assert.match(run([...args, "--help"]), /--remote/);
}
// Load the real project configuration without exposing status credentials.
run(["services"]);
for (const file of ["scripts/import-archived-reports.mjs", "scripts/provision-management-fixtures.mjs", "scripts/backfill-archived-result-drafts.py"]) {
  const source = readFileSync(file, "utf8");
  assert.doesNotMatch(source, /["']--linked["']/);
  assert.match(source, /--remote=/);
  assert.match(source, /--yes/);
}
for (const name of readdirSync("scripts").filter(name => name.endsWith(".mjs"))) {
  const source = readFileSync(resolve("scripts", name), "utf8");
  assert.doesNotMatch(source, /(?:execFileSync|spawnSync|spawn)\(["']supabase["']/, `${name} must use the pinned CLI`);
}
// Execute the actual Python query function against a fake subprocess. This
// proves reads/writes select different consent flags and remove private SQL.
const python = spawnSync("python3", ["-c", `
import ast, json, pathlib, subprocess, tempfile, types
tree = ast.parse(pathlib.Path('scripts/backfill-archived-result-drafts.py').read_text())
function = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == 'db_query')
calls = []
def run(args, **kwargs):
    calls.append(args)
    assert pathlib.Path(args[args.index('--file') + 1]).exists()
    return types.SimpleNamespace(returncode=0, stdout='{"rows":[{"ok":true}]}')
with tempfile.TemporaryDirectory() as directory:
    def temporary(**kwargs):
        kwargs['dir'] = directory
        return tempfile.NamedTemporaryFile(**kwargs)
    scope = {'tempfile': types.SimpleNamespace(NamedTemporaryFile=temporary), 'Path': pathlib.Path,
             'subprocess': types.SimpleNamespace(run=run), 'json': json, 'SUPABASE_CLI': ${JSON.stringify(cli)}}
    exec(compile(ast.Module(body=[function], type_ignores=[]), '<query-function>', 'exec'), scope)
    ref = 'abcdefghijklmnopqrst'
    assert scope['db_query'](ref, 'select 1') == [{'ok': True}]
    scope['db_query'](ref, 'select 1', read_only=False)
    assert '--read-only' in calls[0] and '--yes' not in calls[0]
    assert '--yes' in calls[1] and '--read-only' not in calls[1]
    assert all('--remote=' + ref in args and args[0] == ${JSON.stringify(cli)} for args in calls)
    assert not list(pathlib.Path(directory).iterdir())
`], { encoding: "utf8", timeout: 10000 });
assert.equal(python.status, 0, python.stderr);
if (process.env.CLI_TEST_DB_DIR) {
  const dir = resolve(process.env.CLI_TEST_DB_DIR);
  assert.match(readFileSync(resolve(dir, "supabase/config.toml"), "utf8"), /^project_id = "u-livet-cli3-test"$/m);
  const result = JSON.parse(run(["db", "query", "select 3 as cli_major", "--read-only", "--workdir", dir, "-o", "json"]));
  assert.equal(result.rows[0].cli_major, 3);
}
console.log(`PASS pinned Supabase CLI ${version}, config, command surfaces and explicit hosted targeting`);
