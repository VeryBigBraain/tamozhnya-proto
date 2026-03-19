Deploy on Render (free) - External Backend

1) Push this branch to GitHub.
2) Go to: https://dashboard.render.com → New → Web Service
3) Connect your repo and select folder: backend/
4) Settings:
- Environment: Node
- Build Command: (leave empty)
- Start Command: npm start
- Region: auto
- Instance Type: Free
- Env Vars (optional):
  - ALLOW_ORIGIN=https://<your-netlify-site>.netlify.app
5) Create Web Service and wait for URL like: https://tamozhnya-backend.onrender.com

Netlify redirects (after you get URL):
- /fsa-login → https://tamozhnya-backend.onrender.com/fsa-login
- /api/fsa/* → https://tamozhnya-backend.onrender.com/api/fsa/:splat

