# Crit 7 reflection

## What was the breakthrough that moved the work forward?

The breakthrough was Anthropic's `frontend-design` skill. I had design ideas
for the planner, but it worked them out from a UI/UX perspective, and it also
suggested things I hadn't thought of that ended up working well. I used it
three times. The first pass gave the app a modern, clean, institutional look
built on ANU's palette
([`5377220`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-attwelvedev/commit/5377220)).
The second reworked the course cards
([`da2026e`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-attwelvedev/commit/da2026e)).
The third pushed the workspace towards a dashboard, with a details sidebar,
search palette and frosted floating layers
([`02886e0`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-attwelvedev/commit/02886e0)).
Together, those passes are what made the app feel polished and professional
rather than merely functional.

The ideas didn't ship on trust. Each pass became a spec and a phased plan,
and I checked the result in renders at both marking viewports. That's where
problems like the see-through header and the unrendered glass surfaced, and
became checks in `spec/`.

## What did this work change about who I want to be as a software developer?

It changed how I think about rapid prototyping. I enjoy designing
applications, and I'd assumed that meant doing the design myself. This skill
didn't replace that. It widened what I could try in the time I had, and gave
my own creative input more to build on. I want to be a developer who can take
a rough visual idea to something that looks and feels finished quickly,
while keeping the judgement about which ideas are good, and the checks that
prove they work, in my own hands.
