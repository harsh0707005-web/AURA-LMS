# Integrations

| Integration | Use | Configuration | Current state |
| --- | --- | --- | --- |
| PostgreSQL + pgvector | relational data and vector retrieval | `DATABASE_URL` | Required |
| Gemini | embeddings and primary tutor generation | `GEMINI_API_KEY` and model/budget variables | Required for AI features |
| Groq | optional generation failover | `GROQ_API_KEY`, model, URL, timeout | Optional |
| Resend | email verification and password reset | `RESEND_API_KEY`, `VERIFICATION_EMAIL_FROM`, `FRONTEND_URL` | Optional in local development; required for real delivery |
| Local/S3 storage | uploaded PDF material files | `S3_ENABLED`, `S3_BUCKET_NAME`, `S3_REGION`, `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE`, `S3_DELIVERY_MODE`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Local development default; S3 is required in production |
| PDF.js/pdf-parse | browser viewing and backend extraction | package dependencies | Implemented |

No MCP connection, analytics provider, or error-tracking provider is assumed by this repository. Add one only after its privacy, retention, and deployment owner are decided.

See [`../.planning/codebase/INTEGRATIONS.md`](../.planning/codebase/INTEGRATIONS.md) for the existing detailed provider notes.
