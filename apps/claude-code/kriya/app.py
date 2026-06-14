"""Kriya - Karta's support agent (a Karta harness app).

Kriya's behavior lives in CLAUDE.md (the Claude Code harness reads it); the
home-page intro it continues from is in homepage-conversation.md. This module
just exposes a Karta instance that `karta dev` and the production runtime serve.
"""

from karta import Karta

app = Karta()


def main() -> None:
    # Quick local smoke: one turn from the command line.
    print(app.send_sync("Hi!").text)


if __name__ == "__main__":
    main()
