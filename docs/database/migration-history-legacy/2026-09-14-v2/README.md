# Reliance legacy migration archive — Cutover V2

This directory preserves, byte-for-byte, the 57 migration directories and 61 SQL files present in authoritative recovery commit `9332627314ea6f8786625cc0891f58b9582736e5`.

These files are historical evidence and are not executable Prisma migrations. The only executable migrations are the forward baseline and reconciliation migration under `prisma/migrations`.

The generated archive manifest binds every archived file to its source Git blob and raw SHA-256. The active migration manifest binds the two executable migrations to this archive.
