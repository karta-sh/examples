#!/usr/bin/env python3
"""Generate app.log for the checkout incident scenario.

Deterministic (seeded) so the fixture is reproducible. The log tells one
coherent story: checkout is healthy until the a3f9c21 deploy at 14:31:18 UTC
replaces a batched product lookup with a per-row query, after which p99 climbs
from ~65ms to ~3.6s, the checkout-db pool saturates at 100, and ~20% of
checkouts fail with pool-timeout errors. Run: `python3 generate_log.py`.
"""
from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone

random.seed(1918)

START = datetime(2026, 5, 19, 14, 20, 0, tzinfo=timezone.utc)
DEPLOY = datetime(2026, 5, 19, 14, 31, 18, tzinfo=timezone.utc)
END = datetime(2026, 5, 19, 14, 50, 0, tzinfo=timezone.utc)

SERVICES = ["cart", "payments", "search", "catalog"]
PATHS = {
    "cart": ["GET /cart", "POST /cart/items", "DELETE /cart/items"],
    "payments": ["POST /payments/authorize", "POST /payments/capture"],
    "search": ["GET /search"],
    "catalog": ["GET /catalog/products", "GET /catalog/products/{id}"],
}


def ts(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


def req_id() -> str:
    return "req_" + "".join(random.choice("0123456789abcdef") for _ in range(12))


def line(dt, level, service, msg):
    return f"{ts(dt)} {level:<5} [{service}] {msg}"


def main() -> None:
    out: list[str] = []
    out.append(line(START - timedelta(seconds=3), "INFO", "checkout",
                    "worker boot: pool=100 build=e90f13a"))

    cur = START
    while cur < END:
        # Background noise from neighboring services (steady, healthy).
        for _ in range(random.randint(3, 6)):
            svc = random.choice(SERVICES)
            path = random.choice(PATHS[svc])
            lat = random.randint(8, 220)
            jitter = timedelta(milliseconds=random.randint(0, 999))
            out.append(line(cur + jitter, "INFO", svc,
                            f"{req_id()} {path} 200 {lat}ms"))

        # Checkout traffic: a handful of requests per second.
        for _ in range(random.randint(4, 7)):
            rid = req_id()
            jitter = timedelta(milliseconds=random.randint(0, 999))
            t = cur + jitter
            after = t >= DEPLOY

            if not after:
                lat = random.randint(48, 72)
                out.append(line(t, "DEBUG", "checkout",
                                f"{rid} order.assemble batched_lookup items=3 db_ms=6"))
                out.append(line(t + timedelta(milliseconds=lat), "INFO", "checkout",
                                f"{rid} POST /checkout 200 {lat}ms"))
            else:
                items = random.randint(2, 5)
                # Per-row lookups: one DB round trip per line item.
                for i in range(items):
                    q = random.randint(70, 140)
                    out.append(line(t + timedelta(milliseconds=8 * i), "DEBUG", "checkout",
                                    f"{rid} order.assemble per_row_lookup product_id="
                                    f"{4000 + random.randint(0, 500)} db_ms={q}"))
                fail = random.random() < 0.20
                if fail:
                    out.append(line(t + timedelta(milliseconds=5000), "ERROR", "checkout",
                                    f"{rid} POST /checkout 503 5000ms "
                                    "error=pool_timeout: could not acquire connection from "
                                    "checkout-db pool (in_use=100/100) within 5000ms"))
                else:
                    lat = random.randint(2600, 3650)
                    out.append(line(t + timedelta(milliseconds=lat), "WARN", "checkout",
                                    f"{rid} POST /checkout 200 {lat}ms slow_query_path=per_row"))
        cur += timedelta(seconds=1)

    # Deploy + saturation markers, inserted at the right timestamps.
    markers = [
        (DEPLOY - timedelta(seconds=1), "INFO", "checkout",
         "deploy: activating release a3f9c21 (checkout: fetch line items per row "
         "instead of one batched query) author=priya.nair"),
        (DEPLOY, "INFO", "checkout", "deploy: release a3f9c21 live; draining old workers"),
        (DEPLOY + timedelta(seconds=42), "WARN", "checkout-db",
         "connection pool pressure: in_use=74/100"),
        (DEPLOY + timedelta(seconds=95), "WARN", "checkout-db",
         "connection pool pressure: in_use=96/100"),
        (DEPLOY + timedelta(seconds=130), "ERROR", "checkout-db",
         "connection pool exhausted: in_use=100/100 waiters=37"),
        (DEPLOY + timedelta(seconds=360), "ERROR", "checkout-db",
         "connection pool exhausted: in_use=100/100 waiters=61"),
    ]
    out.extend(line(*m) for m in markers)

    out.sort(key=lambda ln: ln[:24])
    with open("app.log", "w") as fh:
        fh.write("\n".join(out) + "\n")
    print(f"wrote app.log: {len(out)} lines")


if __name__ == "__main__":
    main()
