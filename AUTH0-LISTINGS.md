# Auth0 setup for ChatGPT listings

The `/mcp` endpoint is private and accepts only verified Auth0 users whose email is in `LISTING_ALLOWED_EMAILS`.

## Server environment

Add these values to `/opt/inkcredible-pens/.env`:

```dotenv
AUTH0_ISSUER_BASE_URL=https://YOUR-TENANT.us.auth0.com
AUTH0_AUDIENCE=https://inkcredible.kennedyshome.com/mcp
AUTH0_EMAIL_CLAIM=https://inkcredible.kennedyshome.com/email
AUTH0_EMAIL_VERIFIED_CLAIM=https://inkcredible.kennedyshome.com/email_verified
LISTING_ALLOWED_EMAILS=chadakennedy86@gmail.com,kelliekennedy81@gmail.com
PUBLIC_ORIGIN=https://inkcredible.kennedyshome.com
```

The Auth0 domain and audience are configuration, not passwords. Do not commit client secrets or passwords.

## Auth0 tenant

1. Create an Auth0 API with identifier `https://inkcredible.kennedyshome.com/mcp` and RS256 signing.
2. Create a Regular Web Application for ChatGPT. Configure the callback URL shown by ChatGPT when connecting the plugin.
3. Add a post-login Auth0 Action with the code below. This adds verified identity claims to the access token and denies every email except the two shop owners.

```js
exports.onExecutePostLogin = async (event, api) => {
  const allowed = new Set([
    'chadakennedy86@gmail.com',
    'kelliekennedy81@gmail.com',
  ])
  const email = String(event.user.email || '').trim().toLowerCase()
  if (!event.user.email_verified || !allowed.has(email)) {
    api.access.deny('This account is not approved for Inkcredible Pens listings.')
    return
  }
  api.accessToken.setCustomClaim('https://inkcredible.kennedyshome.com/email', email)
  api.accessToken.setCustomClaim(
    'https://inkcredible.kennedyshome.com/email_verified',
    true,
  )
}
```

Add the Action to the Login flow. Both owners then create/sign in to Auth0 with their own Google account.

## Deploy and connect

After pulling the commit on the server:

```bash
npm install
npm run build
sudo systemctl restart inkcredible
```

The active Caddy site for `inkcredible.kennedyshome.com` must reverse proxy `/mcp*` and
`/.well-known/oauth-protected-resource*` to `127.0.0.1:4242`. Merge the matching
handlers from `deploy/Caddyfile` into the active site block; do not replace a working
domain configuration with the repo sample blindly. Validate and reload Caddy after
merging.

In ChatGPT, enable Developer mode, create a plugin connection, and enter:

`https://inkcredible.kennedyshome.com/mcp`

Sign in separately as Chad and Kellie. A listing stays unpublished until `publish_listing` is called with explicit confirmation.
