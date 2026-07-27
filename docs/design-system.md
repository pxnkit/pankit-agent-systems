# Design system

The visual system is intentionally editorial rather than dashboard-like: clear
research typography, quiet neutral surfaces, restrained accent color, compact
evidence labels, and generous reading space. The UI should feel credible before
it feels decorative.

`app/globals.css` is the implementation source of truth. This document explains
the decisions that should remain stable when components evolve.

## Principles

1. **Evidence first.** Project status, source links, and limitations are visible
   near the claim they qualify.
2. **Readable density.** Long research titles and descriptions wrap naturally;
   cards do not truncate meaning to preserve a rigid grid.
3. **Progressive detail.** The landing page gives orientation, project routes
   provide depth, and source cards expose provenance without overwhelming the
   primary answer.
4. **Calm interaction.** Motion communicates state changes and respects
   `prefers-reduced-motion`.
5. **Theme parity.** Light and dark themes preserve hierarchy, contrast, and
   semantic colors rather than simply inverting pixels.

## Token model

Use semantic custom properties instead of literal colors inside components.
The exact values live in `app/globals.css`; new components should consume the
closest existing token.

| Custom property                         | Intended use                                           |
| --------------------------------------- | ------------------------------------------------------ |
| `--page`                                | Page canvas                                            |
| `--surface`                             | Primary cards, composer, and raised regions            |
| `--surface-soft`                        | Secondary panels and quiet grouped content             |
| `--ink`                                 | Headlines and main body copy                           |
| `--muted`                               | Descriptions, metadata, helper copy, inactive controls |
| `--line`                                | Quiet structure and dividers                           |
| `--line-strong`                         | Selected or emphasized boundaries                      |
| `--dark-surface`, `--dark-ink`          | Dark cards that remain dark in either theme            |
| `--accent`, `--accent-blue`             | Primary actions, active filters, links, and focus      |
| `--success`, `--warning`                | Semantic status only                                   |
| `--radius-card`, `--radius-panel`       | Consistent card and panel geometry                     |
| `--radius-pill`                         | Segmented controls, chips, and pill buttons            |
| `--shadow-card`, `--shadow-lift`        | Resting and elevated depth                             |
| `--editorial-gutter`, `--header-height` | Shared page geometry                                   |

Do not encode meaning with color alone. Pair status color with text, shape, or
an accessible label.

## Typography

- Use the configured sans family for navigation, controls, and body copy.
- Use the configured display or serif treatment only where the stylesheet
  defines it; do not introduce a third family for one component.
- Keep body text at a comfortable reading size and line height.
- Use the monospace family for repository identifiers, code, model names, and
  compact technical metadata.
- Prefer sentence case. Repository names retain their canonical casing.
- Avoid all-caps paragraphs; short eyebrows and compact status labels are the
  exception.

## Layout

- The global content width is shared by navigation, main content, and footer.
- Reading-heavy copy uses a narrower measure inside that frame.
- Project grids should use responsive `minmax()` behavior rather than fixed
  card counts.
- The chat composer remains reachable without covering the most recent answer.
- On narrow screens, horizontal rails remain keyboard-scrollable and expose
  their next item rather than hiding overflow without a cue.
- Components should work at 320 CSS pixels and at 200% browser zoom.

## Components

### Navigation

The global navigation provides a consistent path to the portfolio, projects,
research context, and privacy information. The current route has a non-color
indicator. The theme control has an accessible name that describes the action
or current state.

### Project cards

A project card contains:

- canonical project name;
- concise, source-grounded description;
- focus tags drawn from the shared taxonomy;
- honest status or limitation language;
- an internal detail link and, where approved, an external repository link.

The whole card may have a hover treatment, but nested links must remain valid
and independently focusable. Do not turn unsupported source gaps into polished
marketing copy.

### Chat

User and assistant messages differ through layout, label, and surface—not color
alone. Streaming state is announced politely. The stop control remains
available during generation, `Escape` stops generation, and `Enter` sends while
`Shift+Enter` creates a newline.

Source cards are part of the answer contract. They show a human-readable title,
repository identifier, source type, and safe link without exposing internal
filesystem paths.

### Filters and search

Filters use real buttons or form controls, expose selected state with
`aria-pressed` or native semantics, and remain usable without hover. Empty
results explain how to recover.

## Interaction and motion

- Keyboard focus must be visible and must not depend on browser defaults being
  preserved.
- Hover effects are enhancements; all actions work by keyboard and touch.
- Animate opacity and transforms sparingly. Avoid layout-shifting entrance
  animations for long content.
- Streaming indicators and skeletons have a reduced-motion alternative.
- Do not auto-scroll when it would steal the reader's position; only keep the
  newest message in view when the reader is already near the conversation end.

## Accessibility checklist

- One descriptive `h1` per route and a logical heading outline.
- A skip link targets the main content region.
- Landmarks and link names make sense outside visual context.
- Text and interactive controls meet WCAG AA contrast.
- Touch targets are comfortably sized and not crowded.
- Status changes use an appropriate live region without reading every streamed
  token.
- Decorative artwork is hidden from assistive technology; informative images
  have meaningful alternatives.
- Theme choice does not cause hydration flashes that make content unreadable.

## Writing style

Use concrete research language: what a system studies, what is implemented,
what evidence exists, and what remains unvalidated. Avoid superlatives,
publication claims unsupported by a source, and vague phrases such as
“revolutionary AI.” Keep caveats adjacent to claims rather than collecting them
in a distant disclaimer.

## Adding a component

1. Reuse an existing semantic token and spacing pattern.
2. Start with native HTML behavior.
3. Add the smallest client boundary needed for interaction.
4. Test light, dark, narrow, wide, keyboard, touch, reduced-motion, and zoomed
   states.
5. Verify loading, empty, error, and long-content cases.
6. Run the formatting, lint, type, build, and end-to-end checks described in
   [Deployment](deployment.md).
