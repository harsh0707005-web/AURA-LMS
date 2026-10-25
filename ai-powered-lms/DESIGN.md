# AURA LMS Design System

## Direction

AURA LMS uses an academic operations aesthetic: calm, precise, high-contrast, and information-dense without feeling clinical. The interface should communicate institutional trust before decorative novelty.

## Tokens and typography

- Primary: deep navy (`#00288e` family); success: emerald; warning: amber; danger: rose.
- Surfaces use the existing `surface`, `surface-container-*`, and outline tokens in `frontend/app/globals.css`.
- Body typography uses Hanken Grotesk; labels, IDs, and technical metadata use JetBrains Mono.
- Use the existing Tailwind tokens and component utilities before adding one-off colors.

## Layout and responsive behavior

Use the shared dashboard shell, sidebar, topbar, cards, tables, `EmptyState`, skeletons, badges, and progress components. Verify important flows at 320px, 375px, 768px, and 1024px. Tables should scroll or collapse intentionally; sidebars must not trap the content on small screens.

## States

- Loading: show page-level skeletons for dashboards/tables and button-level progress for submissions. Disable duplicate submits.
- Empty: explain what is absent and provide the next useful action; do not leave a blank card.
- Error: use a short safe message, field-level guidance where possible, and a retry action for transient requests.
- Success: confirm the real persisted result, not merely that a button was clicked.

## Accessibility baseline

Every input needs a visible label or accessible name. Keep keyboard focus visible, associate errors with fields, preserve logical tab order, provide meaningful alt text, use semantic headings, maintain WCAG AA contrast, and respect `prefers-reduced-motion`. Video captions/subtitles are a product requirement only where video content is introduced.

## AI Tutor patterns

Show course scope, loading/processing status, source citations, retry affordances, and safe provider errors. Never render private prompt content in telemetry. Distinguish an out-of-syllabus response from a network failure.
