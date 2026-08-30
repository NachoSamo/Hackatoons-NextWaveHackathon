"""Reancla los artefactos reproducibles del demo al horario del pitch.

Uso manual el día de la demo, antes de resembrar PostgreSQL::

    python -B backend/data/refresh.py
    python -B backend/db.py

El baseline agregado no cambia: contiene perfiles para cada hora UTC y tipo de
día. El fixture conserva su semilla; sólo cambian sus timestamps y el contexto
horario de las probabilidades sanas.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Sequence

# Permite ejecutar el script directo: python backend/data/refresh.py
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.data.gen_fixture import CUBE_SAMPLE_PATH, DATA_DIR, FIXTURE_PATH, generate_fixture


def _parse_anchor(value: str | None) -> datetime:
    if value is None:
        return datetime.now(timezone.utc).replace(microsecond=0)

    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("--at debe incluir zona horaria, por ejemplo 2026-08-30T07:30:00Z")
    return parsed.astimezone(timezone.utc).replace(microsecond=0)


def refresh_artifacts(anchor: datetime | None = None) -> dict[str, object]:
    """Regenera fixture y cube sample con una misma ancla UTC."""
    source_anchor = anchor or datetime.now(timezone.utc)
    if source_anchor.tzinfo is None:
        raise ValueError("anchor debe incluir zona horaria")
    resolved_anchor = source_anchor.astimezone(timezone.utc)
    resolved_anchor = resolved_anchor.replace(microsecond=0)
    fixture, cube_sample = generate_fixture(resolved_anchor)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    fixture.to_parquet(FIXTURE_PATH, engine="pyarrow", index=False)
    cube_sample.to_parquet(CUBE_SAMPLE_PATH, engine="pyarrow", index=False)
    return {
        "anchor": resolved_anchor.isoformat(),
        "fixture_rows": len(fixture),
        "cube_leaves": len(cube_sample),
        "fixture_path": str(FIXTURE_PATH),
        "cube_sample_path": str(CUBE_SAMPLE_PATH),
    }


def backup_artifacts(backup_root: Path) -> dict[str, str]:
    """Guarda parquets y un ``pg_dump`` en una carpeta externa al repositorio."""
    destination = backup_root.expanduser().resolve()
    repository = PROJECT_ROOT.resolve()
    try:
        destination.relative_to(repository)
    except ValueError:
        pass
    else:
        raise ValueError("--backup-dir debe estar fuera del repositorio")

    pg_dump = shutil.which("pg_dump")
    if pg_dump is None:
        raise RuntimeError("pg_dump no está disponible en PATH")

    from backend.db import database_url

    snapshot_name = datetime.now(timezone.utc).strftime("centinel-%Y%m%dT%H%M%SZ")
    snapshot = destination / snapshot_name
    if snapshot.exists():
        raise FileExistsError(f"El snapshot ya existe: {snapshot}")
    snapshot.mkdir(parents=True)

    artifacts = [FIXTURE_PATH, CUBE_SAMPLE_PATH, DATA_DIR / "baseline_profile.parquet"]
    for artifact in artifacts:
        if not artifact.exists():
            raise FileNotFoundError(f"No existe el artefacto para backup: {artifact}")
        shutil.copy2(artifact, snapshot / artifact.name)

    database_dump = snapshot / "centinel.pg_dump"
    subprocess.run(
        [
            pg_dump,
            "--format=custom",
            "--no-owner",
            "--no-privileges",
            f"--file={database_dump}",
            f"--dbname={database_url()}",
        ],
        check=True,
    )
    manifest = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "fixture": FIXTURE_PATH.name,
        "cube_sample": CUBE_SAMPLE_PATH.name,
        "baseline": "baseline_profile.parquet",
        "database_dump": database_dump.name,
        "restore": "pg_restore --clean --if-exists --no-owner --dbname=$DATABASE_URL centinel.pg_dump",
    }
    (snapshot / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )
    return {"snapshot_dir": str(snapshot), "database_dump": str(database_dump)}


def main(argv: Sequence[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Reancla el fixture sintético del demo a UTC.")
    parser.add_argument("--at", help="ISO 8601 con zona horaria; por defecto, now() UTC")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Muestra el ancla sin sobrescribir artefactos.",
    )
    parser.add_argument(
        "--seed-db",
        action="store_true",
        help="Recarga PostgreSQL después de reanclar los artefactos.",
    )
    parser.add_argument(
        "--backup-dir",
        type=Path,
        help="Directorio externo donde crear el snapshot de parquets y pg_dump; requiere --seed-db.",
    )
    args = parser.parse_args(argv)

    try:
        anchor = _parse_anchor(args.at)
    except ValueError as exc:
        parser.error(str(exc))
    if args.backup_dir is not None and not args.seed_db:
        parser.error("--backup-dir requiere --seed-db para snapshot coherente")

    if args.dry_run:
        print(f"Dry run: fixture se reanclaría a {anchor.isoformat()}.")
        print(
            "Luego ejecutar: python -B backend/data/refresh.py "
            f"--at {anchor.isoformat()} --seed-db"
        )
        return

    result = refresh_artifacts(anchor)
    print(
        f"Fixture reanclado a {result['anchor']}: "
        f"{result['fixture_rows']:,} transacciones y {result['cube_leaves']} hojas."
    )
    if not args.seed_db:
        print(
            "Siguiente paso: python -B backend/data/refresh.py "
            f"--at {anchor.isoformat()} --seed-db"
        )
        return

    from backend.db import seed_database

    database = seed_database()
    print(
        f"PostgreSQL resembrado: {database['transactions']:,} fixture rows y "
        f"{database['baseline_profile']:,} perfiles."
    )
    if args.backup_dir is not None:
        backup = backup_artifacts(args.backup_dir)
        print(f"Snapshot creado en {backup['snapshot_dir']}.")


if __name__ == "__main__":
    main()
