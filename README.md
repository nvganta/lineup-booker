# Lineup Booker

Lineup Booker helps independent restaurants and small venues suggest a **headliner**, **local opener**, and **nearby neighborhoods to promote** from Qloo taste signals — for the [Qloo Agentic Hackathon](https://qloo.devpost.com/).

Describe your venue, address, and what regulars love. The app geocodes your address, maps copy to Qloo tags, discovers live-music artists near your pin, picks an opener with local signal, and lists neighborhoods within ~5 km (same city only).

Powered by Qloo taste data.

## Setup

```bash
npm install
# set QLOO_API_KEY in .env.local (see .env.example)
npm run dev
```

| Variable | Description |
|----------|-------------|
| `QLOO_API_KEY` | Required for live results (server-only) |
| `QLOO_API_BASE` | Defaults to `https://hackathon.api.qloo.com` |

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
