# Dependency maintenance qualification

The lockfile implementation, six callback methods and Node >=14.17 runtime remain unchanged in 1.0.8. Runtime signal-exit is replaced by npm:@stackline/signal-exit@1.0.0, preserving the 4.1.0 named onExit API and original ISC license.

The development-only Yarn alias points to @stackline/yarn@1.0.0, a source rebuild of Classic requiring Node >=20.19 with declared external dependencies. It exercises actual registry alias installation in the modern CI quality job. Older Node runtime jobs install only the lockfile tarball and its production dependency.

The lockfile-upstream@npm:lockfile@1.0.4, TypeScript 3.9 and @types/node14 dependencies are independent compatibility oracles. They are deliberately retained rather than replaced by the fork under test. The Node 14 declarations have an isolated private fixture manifest/lock in test/types so their old version cannot accidentally satisfy the modern Yarn editor's optional @types/node >=18 peer. TypeScript 3.9 still compiles the actual public declarations against that exact oracle.

This request covers the original parent packages rather than recursive forks of every dependency. Inherited transitive deprecations in development tooling are a scoped qualification, not an unrestricted Production Dependency Closure Policy pass; full/runtime vulnerability audits and valid peers/engines/integrity remain required.

The existing development SBOM lock selected fast-uri 3.1.6. Its compatible 3.1.7 patch resolves [GHSA-qw65-cvwx-89v3](https://github.com/advisories/GHSA-qw65-cvwx-89v3) and [GHSA-58mr-gqgx-xq4g](https://github.com/advisories/GHSA-58mr-gqgx-xq4g). Only the lock resolution changed; no runtime dependency or additional fork was introduced for this developer-tool advisory.
