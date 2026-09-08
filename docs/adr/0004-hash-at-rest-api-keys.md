# Hash-at-Rest API Key Storage

We store API keys as SHA-256 hashes in PostgreSQL, revealing the plaintext secret (`op_live_...`) only once upon generation. This follows industry security best practices to prevent credential compromise even if the database is exposed.
