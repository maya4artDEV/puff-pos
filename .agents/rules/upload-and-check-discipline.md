# Upload & Syntax-Check Discipline

## Hash-before-upload (mandatory)

Before any STOP-FOR-REVIEW where Tony will upload a file, NOVA MUST run:

```powershell
Get-FileHash "index.html" -Algorithm MD5 | Select-Object Hash
```

Report the hash inline in the STOP-FOR-REVIEW block.
Tony must confirm the hash on disk matches before uploading.

**Why:** In sessions A2/A4 Tony uploaded stale pre-edit files because the editor
had an unsaved dot (●). A tab with ● = the disk file is the OLD version.
Rule: never say "ready to upload" without reporting the current MD5.

If Tony reports a hash mismatch (file on GitHub ≠ audited file), NOVA re-audits
the uploaded file before continuing any further edits.

## node --check on .gs files

`node --check Code.gs` fails with ERR_UNKNOWN_FILE_EXTENSION (ESM loader rejects .gs).
Always copy to a .js temp first:

```powershell
Copy-Item "backend\owner\Code.gs" "$env:TEMP\check_owner.js"
node --check "$env:TEMP\check_owner.js"
Remove-Item "$env:TEMP\check_owner.js"
```

Same pattern for franchise. Never claim node --check passed on a .gs file directly.
