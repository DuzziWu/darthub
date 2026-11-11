# DevFlow Monitoring

Monitoring is disabled by default. The local helper writes bounded event counters only when `monitoring.enabled` is explicitly true in `.devflow/config.json`. Session lifecycle logging additionally requires `monitoring.recordSessionEvents=true`.

Allowed metrics: coarse task lifecycle, test outcome, correction count, and agent-start count. No prompts, transcripts, source contents, file paths, tool arguments, credentials, model names, session IDs or account identifiers are collected. Provider token/cost usage is not inferred.

Keep local event files out of version control. Metrics never block Claude Code and are not sent to a server.
