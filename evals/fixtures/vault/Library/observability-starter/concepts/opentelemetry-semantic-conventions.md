---
title: OpenTelemetry Semantic Conventions
type: Concept
domain: observability
tags: [observability, standards]
timestamp: 2026-06-01T00:00:00.000Z
description: Naming conventions for spans, attributes, and instrumentation so telemetry stays comparable across services.
---

# OpenTelemetry Semantic Conventions

OpenTelemetry semantic conventions standardize how spans, attributes, and instrumentation
are named so telemetry stays comparable across services and vendors.

## Span naming

- Span names should be low-cardinality: `HTTP GET /users/{id}`, never the concrete URL.
- HTTP attributes: `http.request.method`, `http.response.status_code`, `server.address`.
- Database spans carry `db.system`, `db.operation.name`, and the sanitized statement.

Follow the conventions before inventing new attribute names; comparability across
services is the entire point.
