#!/usr/bin/env python3
"""Validate the Echo example against the Echo subschema.

The save schema's root is the envelope (profile + stash + run). Echo files are
standalone documents, so they validate against $defs/Echo. This script wraps
that subschema in a root document so internal $refs keep resolving.

Usage:
    python3 tools/validate-save-schema.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parent.parent
SCHEMA_PATH = ROOT / "design" / "save.schema.json"
ECHO_PATH = ROOT / "design" / "examples" / "echo.example.json"


def main() -> int:
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    echo = json.loads(ECHO_PATH.read_text(encoding="utf-8"))

    # Compile every definition once so malformed refs fail here, not at runtime.
    for name in schema.get("$defs", {}):
        Draft202012Validator({"$schema": schema["$schema"], "$ref": f"#/$defs/{name}", "$defs": schema["$defs"]})

    echo_schema = {
        "$schema": schema["$schema"],
        "$ref": "#/$defs/Echo",
        "$defs": schema["$defs"],
    }
    errors = sorted(Draft202012Validator(echo_schema).iter_errors(echo), key=lambda e: list(e.path))
    if errors:
        print(f"Echo example INVALID ({len(errors)} errors):", file=sys.stderr)
        for error in errors:
            location = "/".join(str(part) for part in error.path) or "<root>"
            print(f"  {location}: {error.message}", file=sys.stderr)
        return 1

    print(f"Echo example valid: {ECHO_PATH.relative_to(ROOT)}")
    print(f"Definitions compiled: {len(schema.get('$defs', {}))}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
