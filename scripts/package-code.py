"""Package source and Skill only; never include the live asset library."""
import argparse
import hashlib
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
FOLDERS = ("src", "web", "server", "shared", "worker", "scripts", "skill", "docs", ".github")
ROOT_FILES = (".gitignore", "AGENTS.md", "README.md", "package.json",
              "package-lock.json", "pnpm-lock.yaml", "index.html", "vite.config.mjs", "vite.pages.config.mjs", "start.ps1",
              "启动资产工坊.cmd")
EXTENSIONS = {".md", ".txt", ".json", ".js", ".mjs", ".cjs", ".jsx",
              ".ts", ".tsx", ".css", ".html", ".py", ".ps1", ".cmd", ".yaml", ".yml"}
EXCLUDED_DIRS = {"data", "library", "assets", "migration", "dist", "node_modules", ".git", "__pycache__",
                 ".pytest_cache", ".cache", ".venv", "venv"}
EXCLUDED_FILES = {"workbench.json", "credentials.json", "service.json",
                  "service-management.lock"}


def excluded(relative):
    return (any(part in EXCLUDED_DIRS for part in relative.parts)
            or relative.name in EXCLUDED_FILES
            or relative.name.startswith(".env")
            or relative.name.endswith((".log", ".pyc", ".partial")))


def source_files():
    files = [ROOT / name for name in ROOT_FILES if (ROOT / name).is_file()]
    skipped = []
    for folder in FOLDERS:
        for file in (ROOT / folder).rglob("*"):
            relative = file.relative_to(ROOT)
            if excluded(relative):
                continue
            if file.is_symlink():
                raise RuntimeError(f"Refusing symbolic link: {relative}")
            if not file.is_file():
                continue
            if file.suffix.lower() not in EXTENSIONS:
                skipped.append(relative.as_posix())
                continue
            files.append(file)
    return sorted(set(files)), sorted(skipped)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser(description="资产工坊纯代码打包，不包含资源")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    output = Path(args.output).resolve()
    if output.suffix.lower() != ".zip":
        raise RuntimeError("输出必须是 ZIP")
    if output == ROOT or ROOT in output.parents:
        raise RuntimeError("代码包必须输出到项目目录之外")
    partial = output.with_suffix(output.suffix + ".partial")
    checksum = output.with_suffix(output.suffix + ".sha256")
    if any(p.exists() for p in (output, partial, checksum)):
        raise RuntimeError("目标已存在，请换一个文件名；不会覆盖已有包")
    files, skipped = source_files()
    entries = []
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(partial, "x", compression=zipfile.ZIP_DEFLATED,
                         compresslevel=9) as archive:
        for file in files:
            relative = file.relative_to(ROOT).as_posix()
            data = file.read_bytes()
            archive.writestr("AssetWorkbench/" + relative, data)
            entries.append({"path": relative, "bytes": len(data), "sha256": digest(data)})
        guide = (ROOT / "docs/纯代码迁移说明.md").read_bytes()
        archive.writestr("AssetWorkbench/迁移必读.md", guide)
        entries.append({"path": "迁移必读.md", "bytes": len(guide), "sha256": digest(guide)})
        manifest = {
            "format": "asset-workbench-code-only-v1",
            "createdAt": datetime.now(timezone(timedelta(hours=8))).isoformat(),
            "includesAssets": False,
            "includesCredentials": False,
            "includesMachineBinding": False,
            "includesDependencies": False,
            "includesBuild": False,
            "excludedDirectories": sorted(EXCLUDED_DIRS),
            "excludedFiles": sorted(EXCLUDED_FILES),
            "otherSkippedFiles": skipped,
            "files": entries,
        }
        archive.writestr("AssetWorkbench/代码包清单.json",
                         json.dumps(manifest, ensure_ascii=False, indent=2).encode("utf-8"))
    with zipfile.ZipFile(partial) as archive:
        expected = {"AssetWorkbench/" + entry["path"] for entry in entries}
        expected.add("AssetWorkbench/代码包清单.json")
        if set(archive.namelist()) != expected or len(archive.namelist()) != len(expected):
            raise RuntimeError("包内文件清单不一致")
        for entry in entries:
            data = archive.read("AssetWorkbench/" + entry["path"])
            if len(data) != entry["bytes"] or digest(data) != entry["sha256"]:
                raise RuntimeError("包内文件校验失败：" + entry["path"])
    partial.rename(output)
    sha = digest(output.read_bytes())
    checksum.write_text(sha + "  " + output.name + "\n", encoding="utf-8")
    print(json.dumps({"archive": str(output), "bytes": output.stat().st_size,
                      "sourceFiles": len(files), "verifiedFiles": len(entries),
                      "sha256": sha, "checksum": str(checksum),
                      "skipped": skipped}, ensure_ascii=False))


if __name__ == "__main__":
    main()
