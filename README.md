# Lineup Booker

Lineup Booker helps independent restaurants and small venues suggest a **headliner**, **local opener**, and **nearby neighborhoods to promote** from Qloo taste signals — for the [Qloo Agentic Hackathon](https://qloo.devpost.com/).

Describe your venue, address, and what regulars love. The app geocodes your address, maps copy to Qloo tags, discovers live-music artists near your pin, picks an opener with local signal, and lists neighborhoods within about 5 km (same city only).

Powered by Qloo taste data.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

| Variable | Description |
|----------|-------------|
| `QLOO_API_KEY` | Required for live Qloo results (server-only) |
| `QLOO_API_BASE` | Defaults to `https://hackathon.api.qloo.com` |
| `AGENT_MODEL` | Primary model for the lineup agent (Vercel AI Gateway) |
| `AGENT_FALLBACK_MODELS` | Comma-separated fallback model ids if the primary is unavailable |

### Agent and Vercel AI Gateway

The scout agent runs through the [Vercel AI Gateway](https://vercel.com/docs/ai-gateway). On Vercel, authentication uses the deployment OIDC token automatically. Locally, set `AI_GATEWAY_API_KEY` in `.env.local` (or the provider keys your gateway route expects).

## Probe (debug)

Prints JSON audits for neighbourhood filtering and opener selection (never prints the API key):

```bash
QLOO_API_KEY=... npm run probe -- \
  --address "2509 Main St, Vancouver, BC" \
  --concept "Natural wine and small plates cafe-bar" \
  --regulars "Indie folk and vinyl nights"
```

## License

MIT — Copyright Naveen Sai Ganta.
