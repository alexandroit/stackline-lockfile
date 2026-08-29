# Publishing

This is a release gate checklist, not authorization to publish.

1. Freeze one untagged release-candidate commit after a clean
   `npm ci && npm run validate` and `node docs-site/check.mjs` pass.
2. Require every Linux, Windows, macOS, filesystem, stress, package, type, and
   CodeQL job for that exact commit to be green. Exercise exact Node.js 14.17
   plus the supported current matrix, including Node.js 20, 22, 24, and 26.
3. Differentially confirm that issue 18's non-`ENOENT` async unlock branch is
   the sole runtime delta; successful and `ENOENT` async outcomes and all sync
   behavior must remain compatible with 1.0.4.
4. Run `npm pack --dry-run`, package/license checks, type-consumer checks,
   `publint`, production audit, and SBOM generation. Record the complete file
   inventory, sizes, SHA-256 hashes, npm integrity, license evidence, and
   source commit for one immutable artifact.
5. Publish that exact archive to an isolated Verdaccio registry. Byte-verify
   it and test clean direct and historical-key alias consumers before any
   official registry action.
6. Publish the already-verified bytes once to official npm with the authorized
   account. Verify registry integrity, metadata, provenance or signatures,
   production dependencies, declarations, and both install forms.
7. Only after registry verification, create the immutable release tag and
   GitHub release at the already-green commit. Do not rebuild or move a tag.
8. Deploy and verify Alexandro.Net documentation at
   `https://alexandro.net/docs/vanilla/lockfile/`, including responsive and
   keyboard behavior, `robots.txt`, `sitemap.xml`, `llms.txt`, and
   `llms-full.txt`.
9. Re-run live downstream policy, direct-use, and Stackline-contact
   deduplication immediately before any public pull request or issue.

Stop at the first red or missing gate. Never bypass human-factor
authentication, weaken a compatibility check to meet a date, contact a
downstream before immutable publication, or claim `PUBLISHED` before npm,
source release, and Alexandro.Net verification all agree.
