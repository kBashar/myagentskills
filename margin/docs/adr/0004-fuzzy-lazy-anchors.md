# Fuzzy, lazily-resolved anchors

An annotation references its passage by exact quote + ~40 characters of prefix/suffix context + the heading trail — never by DOM path, character offset, or injected element id. Resolution happens lazily against the current file, reporting a confidence: `exact`, `normalized` (whitespace drift), `partial` (head/tail words survive a rewrite), or `lost`. Lost annotations are kept and displayed, never dropped.

Rejected: fixed positions (they shatter the moment the agent edits the doc, which is the primary workflow) and injected `data-*` ids (they don't exist in the source file the agent must edit). Validated in the throwaway prototype (`margin-prototype.html`), including the rewrite/re-resolution behavior.
