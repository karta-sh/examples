# Artifact examples

These Agent Apps each produce exactly one Karta Artifact. They are ordered by
Artifact complexity so every example introduces one new idea without hiding the
core production flow.

| # | Example | Artifact | New concept |
| --- | --- | --- | --- |
| 01 | [`hello-world-markdown`](01-hello-world-markdown/) | Markdown document | Produce a file, designate it as an Artifact, and open it from the transcript or Artifacts list. |
| 02 | [`generated-report`](02-generated-report/) | Markdown report | Multiple source files distilled into one rendered output. |
| 03 | [`data-table`](03-data-table/) | CSV-backed table | Data rendered with a Karta-owned file viewer. |
| 04 | [`static-dashboard`](04-static-dashboard/) | Static HTML application | Custom HTML/CSS/JavaScript served at the Artifact root. |
| 05 | `interactive-simulation` | Executable web application | Opaque runner command, parameters, and interactive state. |
| 06 | `shared-data-explorer` | Application with a named input | Read-only pinned and follow inputs mounted from canonical workspace data. |
| 07 | `connected-analysis` | Connected application | Execution-time authorization to an external API or database. |
| 08 | `delegated-researcher` | Child Agent App | Headless delegation, lineage, status, and optional new-tab interaction. |

Folders 01-04 are implemented and validated against the RFC 0061 branch. They
become deployable when that Artifact-capable Karta release is available. Later
rows are the acceptance ladder for executable-Artifact milestones and
intentionally have no folder yet.

## Expected Karta experience

When an agent produces an Artifact, Karta adds an **Artifact ready** card to the
conversation and adds the current version to the persistent **Artifacts** list.
Karta does not automatically open the Artifact and interrupt the conversation.
Selecting either entry opens the Artifact in the right-hand canvas. Closing the
canvas only closes the view; the Artifact remains available from both places.
