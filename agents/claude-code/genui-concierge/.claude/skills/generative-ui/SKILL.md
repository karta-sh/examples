---
name: generative-ui
description: Render rich, interactive UI (forms, cards, pickers, charts) to the user by emitting an A2UI surface inline in your reply. Use when a structured input or a visual beats plain text.
---

# Generative UI (A2UI)

You can render real interactive UI in the chat - forms, cards, tables, pickers,
charts - instead of describing them in text. You do this by emitting an **A2UI
surface** inside a fenced ` ```a2ui ` block in your reply. Karta extracts the
block, validates it, and renders it natively (themed to the app). The rest of
your message renders as normal prose around the UI.

Emit a surface when a structured input or a visual is genuinely better than text:
collecting fields, confirming a choice, showing a record, picking from options.
For a plain answer, just write prose - do not wrap everything in UI.

## How to emit

Put a fenced `a2ui` block containing a JSON array of A2UI messages:

    Here you go:

    ```a2ui
    [
      {"createSurface": {"surfaceId": "s1", "catalogId": "sh.karta/basic", "root": "card"}},
      {"updateComponents": {"surfaceId": "s1", "components": [ ... ]}},
      {"updateDataModel": {"surfaceId": "s1", "path": "/field", "value": "..."}}
    ]
    ```

- **createSurface** starts a surface. `surfaceId` is any short id. `catalogId` is
  the component set you draw from (use `sh.karta/basic` for the built-ins below,
  or your app's registered catalog id). `root` is the id of the top component.
- **updateComponents** adds components. Each has an `id`, a `component` type from
  the catalog, and `properties`. Children are referenced by id (a flat list, not
  nested), e.g. a Card's `children: ["a", "b"]`.
- **updateDataModel** seeds/updates values that components bind to, at a JSON
  Pointer `path` (e.g. `/email`).

Rules:
- Only use component types that exist in the catalog. Unknown types render a
  fallback, not your UI.
- Keep the block to ONE surface unless you truly need several.
- Emit valid JSON. If unsure, prefer fewer components that you know are valid.

## Built-in catalog (`sh.karta/basic`)

Layout: `Card` (title, subtitle, children), `Column` (children, gap), `Row`
(children, gap), `Divider`.
Display: `Text` (text, muted), `Heading` (text), `Badge` (text, variant:
default|success|warning|danger).
Input: `TextField` (label, placeholder, value, inputType), `Checkbox` (label,
checked), `Select` (label, value, options), `Button` (text, variant:
default|outline|ghost, onPress).

### Data binding (two-way)

Bind an input's value to the data model with `{"path": "/name"}`. The user's edits
update the model locally (no round-trip). Seed initial values with
`updateDataModel`.

    {"id": "email", "component": "TextField",
     "properties": {"label": "Email", "value": {"path": "/email"}}}

### Actions (round-trip to you)

A Button's `onPress` raises a named event that comes back to you as the user's next
turn. Put bound values in `context` to receive a snapshot of what they entered:

    {"id": "go", "component": "Button",
     "properties": {"text": "Submit",
       "onPress": {"action": {"event": {"name": "submit",
         "context": {"email": {"path": "/email"}}}}}}}

When the user clicks it, you receive an event named `submit` with
`context: {"email": "<what they typed>"}`. Continue the conversation from there.

## Examples

A feedback form:

    ```a2ui
    [
      {"createSurface": {"surfaceId": "fb", "catalogId": "sh.karta/basic", "root": "card"}},
      {"updateComponents": {"surfaceId": "fb", "components": [
        {"id": "card", "component": "Card", "properties": {"title": "Quick feedback", "children": ["rating", "note", "send"]}},
        {"id": "rating", "component": "Select", "properties": {"label": "Rating", "value": {"path": "/rating"}, "options": ["great", "ok", "bad"]}},
        {"id": "note", "component": "TextField", "properties": {"label": "Anything to add?", "value": {"path": "/note"}}},
        {"id": "send", "component": "Button", "properties": {"text": "Send", "onPress": {"action": {"event": {"name": "feedback", "context": {"rating": {"path": "/rating"}, "note": {"path": "/note"}}}}}}}
      ]}},
      {"updateDataModel": {"surfaceId": "fb", "path": "/rating", "value": "great"}}
    ]
    ```

A read-only status card:

    ```a2ui
    [
      {"createSurface": {"surfaceId": "ord", "catalogId": "sh.karta/basic", "root": "card"}},
      {"updateComponents": {"surfaceId": "ord", "components": [
        {"id": "card", "component": "Card", "properties": {"title": "Order #4821", "children": ["b", "items"]}},
        {"id": "b", "component": "Badge", "properties": {"text": "Shipped", "variant": "success"}},
        {"id": "items", "component": "Text", "properties": {"text": "2x pour-over dripper, 1x Ethiopia 250g"}}
      ]}}
    ]
    ```

## Custom components (your app's catalog)

If your app registered its own catalog (via `karta.toml [genui]`), use its
`catalogId` and its component types (e.g. a custom `pentagraph` chart or a canvas
app). Those render with the app's own look. Follow the same message format; the
component types and their properties are whatever your app registered.
