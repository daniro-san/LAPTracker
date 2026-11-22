# tlc-spec-lean: source and licence

This folder is a copy of the `tlc-spec-lean` skill by **Tech Leads Club**.

- Upstream repository: https://github.com/tech-leads-club/agent-skills
- Path: `packages/skills-catalog/skills/(development)/tlc-spec-lean`
- Pinned commit: `f69e6154b3ac900ea661687479b407cc1be9d4a9` (2026-10-31, "feat(skills-catalog): run the build line before building, name what follows"). Skill version 2.2.0.
- Author: Tech Leads Club (https://github.com/tech-leads-club). The skill says it is derived from tlc-spec-driven 3.3.0 by Felipe Rodrigues, tlc-plan and tlc-implement.
- Licence:
  - `SKILL.md`: Creative Commons Attribution 4.0 International (CC-BY-4.0), https://creativecommons.org/licenses/by/4.0/, as its frontmatter (`license: CC-BY-4.0`) and the dual-licensing note in upstream's `LICENSE` state.
  - Everything else (`references/`, `scripts/` and `scripts/fixtures/`): the MIT License of the upstream repository, reproduced below. Upstream's `LICENSE` grants MIT to the repository and carves out only the `SKILL.md` files.

## Changes

Copied into LAPTracker on 2026-11-21. Every upstream file is unmodified and byte-identical to the pinned commit. This `NOTICE.md` is the only added file.

## Re-syncing

1. Pick a newer commit of the same upstream path. Prefer one that is at least two weeks old.
2. Replace every upstream file in this folder with that commit's copy. Keep this `NOTICE.md`.
3. Update the pinned commit, its date and the skill version above. If you change any upstream file, list the change under "Changes".
4. Before committing, read the new scripts. Never run them before you have read them.

## MIT License (everything except SKILL.md)

MIT License

Copyright (c) 2026 Tech Leads Club

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
