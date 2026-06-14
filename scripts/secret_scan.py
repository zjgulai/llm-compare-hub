#!/usr/bin/env python3
"""Scan project files for likely secrets without printing secret values."""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


REPO = Path(__file__).resolve().parents[1]
RELEASE = REPO / "release"
MAX_TEXT_BYTES = 1_000_000


@dataclass(frozen=True)
class Rule:
    rule_id: str
    label: str
    severity: str
    pattern: re.Pattern[str]


@dataclass(frozen=True)
class Finding:
    source: str
    line: int
    rule_id: str
    severity: str
    label: str

    def render(self) -> str:
        return f"{self.source}:{self.line}: {self.severity} {self.rule_id} ({self.label})"


RULES = [
    Rule(
        "private-key",
        "private key block",
        "critical",
        re.compile(r"-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----"),
    ),
    Rule(
        "github-token",
        "GitHub token",
        "critical",
        re.compile(r"\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b|\bgithub_pat_[A-Za-z0-9_]{20,}\b"),
    ),
    Rule(
        "aws-access-key",
        "AWS access key id",
        "high",
        re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b"),
    ),
    Rule(
        "tencent-secret-id",
        "Tencent Cloud SecretId",
        "high",
        re.compile(r"\bAKID[A-Za-z0-9]{13,}\b"),
    ),
    Rule(
        "openai-key",
        "OpenAI-compatible API key",
        "high",
        re.compile(r"\bsk-[A-Za-z0-9][A-Za-z0-9_-]{18,}\b"),
    ),
    Rule(
        "bearer-token",
        "Authorization bearer token",
        "high",
        re.compile(r"(?i)\bAuthorization\s*:\s*Bearer\s+[A-Za-z0-9._~+/=-]{24,}"),
    ),
    Rule(
        "generic-secret-assignment",
        "generic secret assignment",
        "medium",
        re.compile(
            r"(?i)\b(?:api[_-]?key|secret(?:[_-]?key)?|access[_-]?token|auth[_-]?token|"
            r"github[_-]?token|password|passwd)\b\s*[:=]\s*(?:[\"'][^\"'\s<>]{16,}[\"']|"
            r"[A-Za-z0-9._~+/=-]{20,})"
        ),
    ),
]


PLACEHOLDER_MARKERS = (
    "your_",
    "example",
    "placeholder",
    "changeme",
    "change_me",
    "dummy",
    "fake",
    "redacted",
    "xxxx",
    "****",
    "${{ secrets.",
    "<redacted>",
    "<token>",
    "<api_key>",
    "<api-key>",
)

SKIP_SUFFIXES = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".ico",
    ".pdf",
    ".zip",
    ".gz",
    ".tar",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
}


def is_placeholder(text: str) -> bool:
    lowered = text.lower()
    return any(marker in lowered for marker in PLACEHOLDER_MARKERS)


def is_probably_text(path: Path) -> bool:
    return path.suffix.lower() not in SKIP_SUFFIXES


class SecretScanner:
    def __init__(self, rules: list[Rule] | None = None) -> None:
        self.rules = rules or RULES

    def scan_text(self, source: str, text: str) -> list[Finding]:
        findings: list[Finding] = []
        seen: set[tuple[str, int, str]] = set()
        for line_number, line in enumerate(text.splitlines(), start=1):
            for rule in self.rules:
                for match in rule.pattern.finditer(line):
                    matched_text = match.group(0)
                    if is_placeholder(matched_text):
                        continue
                    key = (source, line_number, rule.rule_id)
                    if key in seen:
                        continue
                    seen.add(key)
                    findings.append(
                        Finding(
                            source=source,
                            line=line_number,
                            rule_id=rule.rule_id,
                            severity=rule.severity,
                            label=rule.label,
                        )
                    )
        return findings

    def scan_path(self, path: Path, source: str | None = None) -> list[Finding]:
        if not path.is_file() or not is_probably_text(path):
            return []
        if path.stat().st_size > MAX_TEXT_BYTES:
            return []
        text = path.read_text(errors="ignore")
        return self.scan_text(source or str(path.relative_to(REPO)), text)


def run_git(args: list[str], *, text: bool = True) -> str | bytes:
    result = subprocess.run(
        ["git", *args],
        cwd=REPO,
        check=True,
        capture_output=True,
        text=text,
    )
    return result.stdout


def tracked_files() -> list[Path]:
    output = run_git(["ls-files", "-z"], text=False)
    assert isinstance(output, bytes)
    files: list[Path] = []
    for raw in output.split(b"\0"):
        if not raw:
            continue
        path = REPO / raw.decode()
        if path.is_file():
            files.append(path)
    return files


def release_files() -> list[Path]:
    if not RELEASE.is_dir():
        return []
    return [path for path in RELEASE.rglob("*") if path.is_file()]


def git_config_files() -> list[Path]:
    config = REPO / ".git" / "config"
    return [config] if config.is_file() else []


def scan_current_tree(include_release: bool, include_git_config: bool) -> list[Finding]:
    scanner = SecretScanner()
    findings: list[Finding] = []
    for path in tracked_files():
        findings.extend(scanner.scan_path(path))
    if include_release:
        for path in release_files():
            findings.extend(scanner.scan_path(path, source=f"release/{path.relative_to(RELEASE)}"))
    if include_git_config:
        for path in git_config_files():
            findings.extend(scanner.scan_path(path, source=".git/config"))
    return findings


def scan_history() -> list[Finding]:
    scanner = SecretScanner()
    findings: list[Finding] = []
    commits_raw = run_git(["rev-list", "--all"])
    assert isinstance(commits_raw, str)
    for commit in commits_raw.splitlines():
        tree_raw = run_git(["ls-tree", "-r", "-z", "--name-only", commit], text=False)
        assert isinstance(tree_raw, bytes)
        for raw_path in tree_raw.split(b"\0"):
            if not raw_path:
                continue
            rel = raw_path.decode()
            path = Path(rel)
            if not is_probably_text(path):
                continue
            try:
                size_raw = run_git(["cat-file", "-s", f"{commit}:{rel}"])
                assert isinstance(size_raw, str)
                if int(size_raw.strip()) > MAX_TEXT_BYTES:
                    continue
                blob = run_git(["show", f"{commit}:{rel}"], text=False)
                assert isinstance(blob, bytes)
            except (subprocess.CalledProcessError, ValueError):
                continue
            text = blob.decode(errors="ignore")
            source = f"{commit[:12]}:{rel}"
            findings.extend(scanner.scan_text(source, text))
    return findings


def print_findings(findings: list[Finding], *, title: str) -> None:
    if not findings:
        print(f"{title}: no likely secrets found")
        return
    print(f"{title}: {len(findings)} likely secret finding(s)")
    for finding in findings:
        print(f"  {finding.render()}")


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Scan project files for likely secrets without printing secret values."
    )
    parser.add_argument(
        "--include-release",
        action="store_true",
        help="also scan release/ when it exists",
    )
    parser.add_argument(
        "--include-git-config",
        action="store_true",
        default=True,
        help="also scan local .git/config for unsafe remote URLs",
    )
    parser.add_argument(
        "--no-git-config",
        action="store_false",
        dest="include_git_config",
        help="skip local .git/config",
    )
    parser.add_argument(
        "--history",
        action="store_true",
        help="scan all committed git history; reports commit/path/line only",
    )
    parser.add_argument(
        "--report-only",
        action="store_true",
        help="always exit 0 after reporting findings",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    current_findings = scan_current_tree(args.include_release, args.include_git_config)
    print_findings(current_findings, title="current tree")

    history_findings: list[Finding] = []
    if args.history:
        history_findings = scan_history()
        print_findings(history_findings, title="git history")

    has_findings = bool(current_findings or history_findings)
    return 0 if args.report_only or not has_findings else 1


if __name__ == "__main__":
    sys.exit(main())
