# Private correspondence record

A password-gated, single-page record, built with React + Vite and deployed to GitHub Pages.

**This repository is public. Nothing readable is in it.** The record and every attached
document are committed only as AES-256-GCM ciphertext (`site/public/data.enc`,
`site/public/att/*.enc`). The key is derived from the access password with PBKDF2-SHA256
(310,000 iterations); the password carries 80 bits of CSPRNG entropy. The JavaScript bundle
contains no names, no email text and no documents, and CI refuses to deploy if it ever does.

## Layout

| Path | Committed | Contents |
|---|---|---|
| `site/` | yes | The app, the encrypt script, and the ciphertext |
| `.github/workflows/deploy.yml` | yes | Build + Pages deploy; needs no secrets |
| `derived/` | **no** | Extraction and curation script (headings, meetings, plan list) |
| `private/` | **no** | Plaintext `content.json`, attachment bytes, `password.txt` (mode 600) |
| source mail export | **no** | Read-only input |

## Updating

```sh
cd site
npm run data      # rebuild ../private/content.json from the mail export, then re-encrypt
npm run rotate    # issue a fresh password and re-encrypt everything
npm run build     # produce dist/ locally (optional; CI does this)
```

Commit `site/public/` and push to `main`; the workflow deploys it. The password is never
printed — read it from `private/password.txt`.

### Limits

Anyone with the password can share it, and anyone who downloads the ciphertext keeps a copy
they can decrypt later if they learn the password. Rotate it if it circulates further than
intended. A Pages URL is public — the encryption, not the URL, is the protection.
