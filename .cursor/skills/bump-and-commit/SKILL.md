---
name: bump-and-commit
description: Esegue bump versione npm (root, frontend, backend) e prepara commit per modifiche che toccano l’app. Usa quando l’utente chiede commit, release, o dopo modifiche in frontend/ o backend/.
---

# Bump versione e commit

## Quando fare il bump

- Se il commit include modifiche in **`frontend/`** o **`backend/`** che impattano l’app, esegui prima il bump dalla **root del repo**:

```bash
node scripts/bump-version.js
```

- Non serve bump per solo `README`, `.cursor/`, `docs/`, solo config che non cambiano runtime.

## Cosa fa lo script

Aggiorna il campo **`version`** (patch +1) in:

- `package.json` (root)
- `frontend/package.json`
- `backend/package.json`

Rigenera anche **`frontend/src/version.js`** (costante `FRONTEND_VERSION` per il footer in UI).

## Commit

1. `git add` includendo i tre `package.json` se modificati dal bump.
2. Messaggio chiaro: `feat:`, `fix:`, `chore:`.
3. `git push` sul branch corrente.

## Pre-commit (opzionale)

Si può aggiungere un hook git che chiama `node scripts/bump-version.js` prima del commit; finché non è configurato, eseguire lo script manualmente quando serve.
