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

## Trace Indigo tokens

Use semantic custom properties instead of literal colors inside components.
The exact implementation lives in `app/globals.css`, but the core palette is a
stable contract.

| Role                | Light                              | Dark                  |
| ------------------- | ---------------------------------- | --------------------- |
| Page                | `#f7f6f2`                          | `#0d0d0f`             |
| Surface             | `#ffffff`                          | `#171719`             |
| Soft surface        | `#fbfaf7`                          | `#202024`             |
| Ink                 | `#171719`                          | `#f6f5f2`             |
| Muted               | `#6e6e73` / quiet `#929298`        | `#a7a7ad`             |
| Line                | current ink at approximately `10%` | current ink at `10%`  |
| Trace               | `#4b55d9`                          | `#9aa3ff`             |
| Trace hover/pressed | `#3d47c7` / `#303aa7`              | theme-adjusted states |
| Trace soft          | `#eceeff`                          | translucent trace     |

Primary semantic tokens cover page, surface, soft surface, ink, muted copy,
line, trace, focus, status, radii, elevation, editorial gutter, and header
height. New components consume those tokens rather than introducing another
neutral or accent family.

Do not encode meaning with color alone. Pair status color with text, shape, or
an accessible label.

## Typography

- Use Geist Sans for navigation, controls, body copy, and most headings.
- Use Newsreader selectively for editorial hero and section headlines. It adds
  contrast; it is not the default UI face.
- Use Geist Mono for repository identifiers, code, model names, labels, source
  IDs, and compact technical metadata.
- Keep body text at a comfortable reading size and line height and preserve the
  tighter rhythm of labels and evidence metadata.
- Prefer sentence case. Repository names retain their canonical casing.
- Avoid all-caps paragraphs; short eyebrows and compact status labels are the
  exception.

## Layout

- The global content width is shared by navigation, main content, and footer.
- Reading-heavy copy uses a narrower measure inside that frame.
- Project grids should use responsive `minmax()` behavior rather than fixed
  card counts.
- The home route keeps a compact orientation hero, followed by the dark
  four-step process panel, four research questions, and ranked/featured rails.
- The chat composer is fixed within the viewport while preserving enough bottom
  space that it never covers the most recent answer or footer content.
- On narrow screens, horizontal rails remain keyboard-scrollable and expose
  their next item rather than hiding overflow without a cue.
- Preserve scroll-snap behavior only where it improves rail browsing; never
  trap vertical page scrolling.
- Components should work at 320 CSS pixels and at 200% browser zoom.

## Components

### Navigation

The primary routes are Chat (`/`), Portfolio (`/portfolio`), project catalogue
and detail routes, Writing, and Privacy. Writing may render a deliberate empty
state; it must not imply that draft templates are published articles. The
current route has a non-color indicator. The theme control has an accessible
name that describes the action or current state.

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
filesystem paths. Approved citations remain visible as numbered inline links;
they are keyboard-focusable and their accessible label names the associated
source card.

The compact hero explains that chat is a grounded research guide, while the
four-step dark panel makes the answer path legible: interpret, retrieve,
ground, and answer. Four suggested research questions act as genuine controls
and remain distinct from the ranked and featured project rails.

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
