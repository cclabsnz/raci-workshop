# RACI Workshop — Salesforce Team Alignment

A real-time, collaborative RACI alignment tool for Salesforce teams. No login required — create a room, share the link, and everyone can assign RACI values together.

## How it works

1. **Create a room** — generates a 6-character room code
2. **Share the link** — others join by opening the URL with `?room=CODE`
3. **Assign RACI** — drag R/A/C/I chips or click to cycle, per role per activity
4. **Add activities** — anyone can add custom activities to any domain
5. **Compare** — see everyone's answers side-by-side with consensus percentages
6. **Heatmap** — visual overview of agreement across all participants
7. **Session ends** — all data is ephemeral, disappears when everyone disconnects

## Architecture

- **Frontend**: Static HTML hosted on GitHub Pages
- **Backend**: PartyKit (Cloudflare Workers) for ephemeral WebSocket rooms
- **Storage**: None — all state lives in memory on the PartyKit worker

## Setup

### 1. Deploy PartyKit backend

```bash
# Install dependencies
npm install

# Login to PartyKit (uses GitHub auth)
npx partykit login

# Deploy
npx partykit deploy
```

This gives you a URL like `raci-workshop.YOUR_USERNAME.partykit.dev`

### 2. Update the frontend

Edit `index.html` and update the `PARTYKIT_HOST` constant:

```js
const PARTYKIT_HOST = "raci-workshop.YOUR_USERNAME.partykit.dev";
```

### 3. Deploy frontend to GitHub Pages

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin git@github.com:gt2985/raci-workshop.git
git push -u origin main
```

Then enable GitHub Pages in repo settings (Settings → Pages → Source: main branch, root folder).

### 4. Access

- GitHub Pages: `https://gt2985.github.io/raci-workshop/`
- Direct room link: `https://gt2985.github.io/raci-workshop/?room=ABC123`

## Development

```bash
# Run PartyKit locally
npx partykit dev

# Open index.html and update PARTYKIT_HOST to localhost:1999
```

## Reference RACI

The tool includes 50 pre-defined activities across 5 domains, with reference answers for the Te Whatu Ora Salesforce team:

| Domain | Activities | Primary owner |
|--------|-----------|---------------|
| Architecture & design | 10 | SSA (Senior Solution Architect) |
| Delivery governance & programme | 12 | PA (Principal Advisor — SF Delivery) |
| Platform operations | 8 | PM (Platform Manager) |
| DevOps & engineering | 8 | DOL (DevOps Lead) |
| Team delivery & people | 10 | PTL (Platform Technical Lead) |

## Roles

- **SSA** — Senior Solution Architect (architecture & design authority)
- **PA** — Principal Advisor, Salesforce Delivery (delivery outcomes & governance)
- **PM** — Salesforce Platform Manager (org health & operations)
- **DOL** — Salesforce DevOps Lead (CI/CD, automation, release engineering)
- **PTL** — Platform Technical Lead (team delivery, mentoring, sprint execution)
