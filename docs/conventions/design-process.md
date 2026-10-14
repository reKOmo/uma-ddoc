# Design process

How much design a change gets depends on its size.

| Change | Interview + plan | Plan doc in `docs/` |
|---|---|---|
| Small and clear: a button, a style tweak, a one-file fix | no, just do it | no |
| A feature or change with open questions: a new page, a new setting, a new filter | yes, in the conversation | only if asked |
| Really big, or split into parts / several sessions: a new data pipeline, a cross-cutting refactor, a migration | yes | yes |

## Interview

Before designing, ask the developer every open question (scope, behaviour, edge cases, UI, data shape, what's out of
scope) instead of assuming, a few at a time, until nothing is left to guess. Check the code first so you only ask what
the code can't answer. Then lay out the design and the plan and get them approved before implementing.

## Plan docs

- Written only for the big tier above, or when asked. They hold the decisions, the steps, and how each step is
  checked.
- They are temporary. When the plan is complete, move its lasting decisions into the topic doc they belong to
  (`docs/conventions/`, `docs/data/`…), delete the plan, and remove every link to it (docs, code comments).
