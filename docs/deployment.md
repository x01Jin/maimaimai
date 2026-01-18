# Deployment Guide

This project is set up to deploy a static build to **GitHub Pages**.

## Build & Deploy

- Build: `npm run build` (Vite builds the `dist/` folder)
- Preview the production build locally: `npm run preview`
- Deploy to GitHub Pages: `npm run deploy` (uses `gh-pages -d dist`)

Notes:

- The Vite `base` config is set to `/maimaimai/` in `vite.config.ts` and `package.json` includes a matching `homepage` entry. Keep them in sync to ensure assets resolve correctly on GitHub Pages.
- `gh-pages` publishes the `dist/` folder to the `gh-pages` branch.

## Verification

- After building, run `npx tsc --noEmit` to verify there are no TypeScript errors.
- Check the `dist/` build in a browser (use `npm run preview`) before deploying to confirm the site works as expected.

## Troubleshooting

- If assets appear missing on GitHub Pages, confirm the `base` path in `vite.config.ts` and the project's GitHub Pages repository/package `homepage` are aligned.
- Ensure `gh-pages` has permission to push to the branch (your local git credentials/CI setup).

If you need a different hosting target (Netlify, Vercel, etc.), a standard static build from `vite build` will work—configure the hosting provider to serve the build output at the repository root or a subpath as required.
