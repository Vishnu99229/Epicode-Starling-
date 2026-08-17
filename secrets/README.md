# secrets/

Holds local-only credentials such as `vishnu_test.pem` and any mTLS certs.

Never commit files from this directory. They are gitignored (including `*.pem` / `*.key`).
Copy secrets here for local use; production injection is via env / secret manager later.
