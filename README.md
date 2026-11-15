# FORGE

### The AI Engineering Workbench

**Understand the codebase. Plan the change. Verify the result.**

FORGE is an open-source engineering workbench for building safer, more understandable AI-assisted software workflows. Its goal is to help developers inspect projects, create evidence-backed implementation plans, run quality checks, and coordinate specialist tools without surrendering control of their code.

> FORGE is an independent project. It is not a fork, rebrand, or continuation of another engineering toolkit.

## Project principles

- **Understand before changing:** inspect project structure and conventions before proposing edits.
- **Evidence over confidence:** reports should point to files, commands, and test results.
- **Human control:** potentially destructive actions require explicit approval.
- **Local-first foundations:** project metadata and notes stay in the workspace unless an integration is deliberately configured.
- **Composable by design:** keep the core small and make integrations replaceable.

## Planned capabilities

| Area | Direction |
| --- | --- |
| Project intelligence | Detect project languages, package managers, scripts, and key files |
| Planning | Turn a goal into a reviewable implementation plan |
| Quality checks | Run existing project checks and summarize their actual results |
| Agent workflows | Coordinate specialist roles through explicit task contracts |
| Project memory | Store decisions and conventions locally, with user control |
| Integrations | Connect supported coding agents and developer tools |

These are roadmap items, not claims that every capability is already implemented.

## Development

Requirements: Node.js 22 or newer and npm.

```bash
npm install
npm run dev -- --help
npm test
npm run typecheck
npm run build
```

## Current status

Early foundation. The initial CLI exposes help and version information. Project inspection, planning, orchestration, and integrations will be added incrementally with tests and documented limitations.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Security issues should be reported privately; see [SECURITY.md](SECURITY.md).

## License

MIT. See [LICENSE](LICENSE).
