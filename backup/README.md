# Rescued data (Railway -> Cloudflare)

Pulled off the Railway deployment before it is decommissioned.

| File | What |
| --- | --- |
| `projects.json` | all portfolio cases, straight from `GET /api/projects` |
| `team.json` | team members, from `GET /api/team` |
| `uploads/` | images that lived on the Railway volume at `/data/uploads` |
| `../worker/import.sql` | the same data as D1 INSERTs |

**Still missing: the applications (client leads).** They sit behind auth, so
they need `GET /api/export` from a signed-in browser — see DEPLOY-CLOUDFLARE.md
step 0. Once `slv-visual-backup.json` lands in the project root, its rows get
appended to `worker/import.sql`.

The `uploads/` images must be copied into R2 after the bucket exists:

```bash
for f in backup/uploads/*; do
  npx wrangler r2 object put "slv-visual-uploads/$(basename "$f")" --file "$f" --remote
done
```

The database references them by the same filename (`/uploads/<name>`), so no
paths change.
