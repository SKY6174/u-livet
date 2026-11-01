#!/usr/bin/env python3
"""Migrate the two legacy local Docker projects; preview unless --apply is set.

Snapshots, original volumes and private inspect/dump backups are retained locally.
Run from the reviewed checkout. No cloud database or other project is touched.
"""
import argparse
import hashlib
import http.client
import io
import json
import os
from pathlib import Path
import re
import socket
import subprocess
import tarfile
import time
from urllib.parse import quote


def docker(*args, binary=False, input_bytes=None):
    result = subprocess.run(["docker", *args], check=True, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, input=input_bytes)
    return result.stdout if binary else result.stdout.decode().strip()


def inspect(kind, name):
    return json.loads(docker(kind, "inspect", name))[0]


def rewrite(value, replacements):
    if isinstance(value, str):
        for old, new in replacements.items():
            value = value.replace(old, new)
        return value
    if isinstance(value, list):
        return [rewrite(item, replacements) for item in value]
    if isinstance(value, dict):
        return {rewrite(k, replacements): rewrite(v, replacements) for k, v in value.items()}
    return value


class LocalDocker(http.client.HTTPConnection):
    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.settimeout(120)
        self.sock.connect(self.host)


def api(path, body):
    connection = LocalDocker(SOCKET_PATH, timeout=120)
    connection.request("POST", path, json.dumps(body), {
        "Content-Type": "application/json", "Host": "localhost"})
    response = connection.getresponse()
    data = response.read()
    connection.close()
    if response.status >= 300:
        raise RuntimeError(f"Docker API {path.split('?')[0]} returned {response.status}")
    return json.loads(data) if data else {}


def save_private(path, value):
    with open(path, "wb", opener=lambda p, flags: os.open(p, flags, 0o600)) as out:
        out.write(value)


def dump_database(name):
    return docker("exec", name, "pg_dumpall", "-U", "postgres", "--no-role-passwords", binary=True)


def digest(data):
    # Recent pg_dump releases generate a random psql restriction key per dump.
    normalized = re.sub(rb"(?m)^\\(?:un)?restrict .*\n", b"", data)
    return hashlib.sha256(normalized).hexdigest()


def wait_ready(name):
    deadline = time.monotonic() + 120
    while time.monotonic() < deadline:
        state = inspect("container", name)["State"]
        health = state.get("Health", {}).get("Status")
        if state["Running"] and health in (None, "healthy"):
            return
        if not state["Running"]:
            raise RuntimeError(f"Container did not stay running: {name}")
        time.sleep(1)
    raise RuntimeError(f"Container health timed out: {name}")


def migrate(old_project, new_project, backup, source_root, issues_root):
    names = docker("ps", "-a", "--filter", f"label=com.supabase.cli.project={old_project}",
                   "--format", "{{.Names}}").splitlines()
    # One previously customized storage container has no project label.
    all_names = docker("ps", "-a", "--format", "{{.Names}}").splitlines()
    storage = f"supabase_storage_{old_project}"
    if storage in all_names and storage not in names:
        names.append(storage)
    if not names:
        raise RuntimeError(f"Source project is absent: {old_project}")
    originals = [inspect("container", name) for name in names]
    if any(d["Name"].lstrip("/").replace(old_project, new_project) in all_names for d in originals):
        raise RuntimeError("Target containers already exist; inspect the previous migration first")
    replacements = {old_project: new_project,
                    "/Users/thomas/Documents/uc-life": str(source_root),
                    "/tmp/u-livet-issues-db": str(issues_root)}
    print(json.dumps({"source": old_project, "target": new_project,
                      "containers": len(originals), "apply": ARGS.apply}), flush=True)
    if not ARGS.apply:
        return
    folder = backup / new_project
    folder.mkdir(mode=0o700)
    save_private(folder / "inspect.json", json.dumps(originals).encode())
    db = f"supabase_db_{old_project}"
    before = dump_database(db)
    save_private(folder / "database.sql", before)
    images, created = {}, []
    running = [d["Name"].lstrip("/") for d in originals if d["State"]["Running"]]
    try:
        # Stop every writer before taking snapshots and copying physical data.
        for name in sorted(running, key=lambda n: n == db):
            docker("stop", "--time", "30", name)
        for original in originals:
            name = original["Name"].lstrip("/")
            image = f"u-livet-local-backup:{ARGS.stamp}-{name.removeprefix('supabase_').replace(old_project, new_project)}"
            images[name] = docker("commit", name, image)
            for mount in original["Mounts"]:
                if mount["Type"] != "bind":
                    continue
                destination = Path(rewrite(mount["Source"], replacements))
                if not destination.exists():
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    docker("cp", f"{name}:{mount['Destination']}", str(destination))
        volumes = {m["Name"] for d in originals for m in d["Mounts"] if m["Type"] == "volume"}
        for name in sorted(volumes):
            target = rewrite(name, replacements)
            if target == name:
                raise RuntimeError("Refusing to reuse a source volume")
            if target in docker("volume", "ls", "--format", "{{.Name}}").splitlines():
                raise RuntimeError(f"Target volume already exists: {target}")
            v = inspect("volume", name)
            api("/volumes/create", {"Name": target, "Driver": v["Driver"],
                                   "DriverOpts": v.get("Options") or {},
                                   "Labels": rewrite(v.get("Labels") or {}, replacements)})
            docker("run", "--rm", "--network", "none", "--user", "0", "--entrypoint", "sh",
                   "--mount", f"type=volume,source={name},target=/from,readonly",
                   "--mount", f"type=volume,source={target},target=/to", images[db],
                   "-c", "cp -a /from/. /to/")
        networks = {n for d in originals for n in d["NetworkSettings"]["Networks"]}
        for name in sorted(networks):
            n = inspect("network", name)
            api("/networks/create", {"Name": rewrite(name, replacements), "Driver": n["Driver"],
                                     "Internal": n["Internal"], "Attachable": n["Attachable"],
                                     "EnableIPv6": n["EnableIPv6"], "Options": n.get("Options") or {},
                                     "Labels": rewrite(n.get("Labels") or {}, replacements)})
        for original in originals:
            name = original["Name"].lstrip("/")
            target = rewrite(name, replacements)
            config = rewrite(original["Config"], replacements)
            config["Image"] = images[name]
            config["Labels"].update({"com.docker.compose.project": new_project,
                                      "com.supabase.cli.project": new_project,
                                      "com.supabase.cli.workdir": str(issues_root if new_project.endswith("issues") else source_root)})
            endpoints = {rewrite(n, replacements): {
                "Aliases": [rewrite(a, replacements) for a in (v.get("Aliases") or [])
                            if a != original["Id"][:12]]}
                for n, v in original["NetworkSettings"]["Networks"].items()}
            api("/containers/create?name=" + quote(target), {
                **config, "HostConfig": rewrite(original["HostConfig"], replacements),
                "NetworkingConfig": {"EndpointsConfig": endpoints}})
            created.append(target)
            # Supabase generates these files with full container DNS names.
            # Snapshotting preserves them, so rewrite their upstream references too.
            if name.startswith("supabase_kong_"):
                for filename in ("kong.yml", "custom_nginx.template"):
                    try:
                        archive = docker("cp", f"{name}:/home/kong/{filename}", "-", binary=True)
                    except subprocess.CalledProcessError:
                        if original["State"]["Running"]:
                            raise
                        continue
                    output = io.BytesIO()
                    with tarfile.open(fileobj=io.BytesIO(archive)) as source, \
                            tarfile.open(fileobj=output, mode="w") as dest:
                        for member in source:
                            if not member.isfile():
                                raise RuntimeError("Expected a regular Kong configuration file")
                            content = rewrite(source.extractfile(member).read().decode(), replacements).encode()
                            member.size = len(content)
                            dest.addfile(member, io.BytesIO(content))
                    # Keep the original UID/GID; Kong rewrites these files on startup.
                    docker("cp", "-a", "-", f"{target}:/home/kong/", input_bytes=output.getvalue())
        for name in sorted(running, key=lambda n: n != db):
            target = rewrite(name, replacements)
            docker("start", target)
            wait_ready(target)
        after = dump_database(rewrite(db, replacements))
        save_private(folder / "database-after.sql", after)
        if digest(before) != digest(after):
            raise RuntimeError("Logical database dump differs; reverting containers")
        config_path = (issues_root if new_project.endswith("issues") else source_root) / "supabase/config.toml"
        if config_path.exists():
            current_config = config_path.read_text()
            save_private(folder / "config-before.toml", current_config.encode())
            config_path.write_text(rewrite(current_config, replacements))
        else:
            template = Path(__file__).resolve().parents[1] / "supabase/config.toml"
            current_config = template.read_text().replace("u-livet-core", new_project)
            if new_project.endswith("issues"):
                current_config = current_config.replace("5532", "5632")
            config_path.parent.mkdir(parents=True, exist_ok=True)
            config_path.write_text(current_config)
        # All original data volumes and snapshot images remain available for rollback.
        docker("rm", *names)
        print(json.dumps({"project": new_project, "databaseSha256": digest(after),
                          "running": len(running), "stopped": len(originals) - len(running),
                          "verified": True}), flush=True)
    except Exception:
        for name in created:
            try:
                docker("rm", "-f", name)
            except subprocess.CalledProcessError:
                pass
        for name in sorted(running, key=lambda n: n != db):
            docker("start", name)
            wait_ready(name)
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--source-root", type=Path, required=True)
    parser.add_argument("--issues-root", type=Path, default=Path("/tmp/u-livet-issues-db"))
    parser.add_argument("--backup-dir", type=Path, required=True)
    ARGS = parser.parse_args()
    ARGS.stamp = time.strftime("%Y%m%d%H%M%S", time.gmtime())
    endpoint = os.environ.get("DOCKER_HOST") or docker("context", "inspect", "--format", "{{.Endpoints.docker.Host}}")
    if not endpoint.startswith("unix:///"):
        raise SystemExit("Only a local Docker UNIX socket is supported")
    SOCKET_PATH = endpoint.removeprefix("unix://")
    if ARGS.apply:
        os.umask(0o077)
        ARGS.backup_dir.mkdir(parents=True, mode=0o700, exist_ok=False)
    try:
        for suffix in ("issues", "core"):
            migrate(f"uc-life-{suffix}", f"u-livet-{suffix}", ARGS.backup_dir,
                    ARGS.source_root.resolve(), ARGS.issues_root)
    except Exception as error:
        # Docker inspect/environment and SQL dumps can contain secrets; keep errors terse.
        reason = str(error) if isinstance(error, RuntimeError) else type(error).__name__
        raise SystemExit(f"Migration failed: {reason}; inspect private backups and Docker state") from None
