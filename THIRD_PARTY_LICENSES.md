# Third-Party Licenses

## `lockfile@1.0.4`

- Upstream: <https://github.com/npm/lockfile>
- Published artifact:
  <https://registry.npmjs.org/lockfile/-/lockfile-1.0.4.tgz>
- Published tarball SHA-256:
  `887b137414eb92de260da9d42544b852c4999b38b7da7e1f39946f59f4d8c6c5`
- Copyright: Isaac Z. Schlueter and Contributors
- License: ISC

`@stackline/lockfile` derives from the official 1.0.4 npm artifact. The
artifact contains post-tag and tarball-only provenance, so the npm artifact—not
the earlier Git tag alone—is the compatibility baseline. The complete
upstream ISC notice is retained exactly in `LICENSE` and reproduced in
`NOTICE` with the independent-project attribution.

## `signal-exit@4.1.0`

- Upstream: <https://github.com/tapjs/signal-exit>
- Package: <https://www.npmjs.com/package/signal-exit/v/4.1.0>
- Role: runtime dependency used for best-effort process-exit cleanup
- License: ISC

The following license text is reproduced from `signal-exit@4.1.0`'s
`LICENSE.txt`:

```text
The ISC License

Copyright (c) 2015-2023 Benjamin Coe, Isaac Z. Schlueter, and Contributors

Permission to use, copy, modify, and/or distribute this software
for any purpose with or without fee is hereby granted, provided
that the above copyright notice and this permission notice
appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES
OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE
LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES
OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS,
WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION,
ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

Development, test, type, audit, and release tools are excluded from the
production dependency inventory and retain their licenses in the installed
development graph. Stackline is not affiliated with or endorsed by either
upstream project or its maintainers.
