# Expensly — Frontend

This is the React 19 + Vite frontend for [Expensly](https://github.com/lakshya324/expensly).

For full documentation including setup instructions, architecture, and API reference, see the **[root README](../README.md)** and the **[docs/](../docs/)** folder.

## Quick Start

```bash
cd frontend
cp .env.example .env
# Set VITE_API_URL=http://localhost:3000/api in .env
npm install
npm run dev
```

The app starts at `http://localhost:5173`.

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |

## Documentation

- [Architecture](../docs/architecture.md)
- [Frontend internals](../docs/frontend.md)
- [API reference](../docs/api-reference.md)
- [Features](../docs/features.md)
- [WebSockets](../docs/websockets.md)
```
