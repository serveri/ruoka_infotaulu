# Ruoka infotaulu

Simple display of campus restaurant menus for info screens.

## Requirements
- Node.js 18+

## Setup
- Install API deps: `cd api && npm install`
- Install frontend deps: `cd frontend && npm install`

## Run (development)
Open two terminals:
- API (Express proxy): `cd api && npm start` (http://localhost:3000)
- Frontend (Vite + Vue 3): `cd frontend && npm run dev` (http://localhost:5173)

## Build (frontend)
- `cd frontend && npm run build`
- Preview build: `npm run preview`

## Notes
- API proxies Compass Group menus under paths like `/tietoteknia`, `/antell`, `/snelmannia`, `/canthia`.
- CORS is configured for localhost dev ports.

## Database & Analytics
- Menus are automatically saved to SQLite database (`api/data/menus.db`) for later analysis
- Only saves menus when actual lunch items exist
- Cache expires after 1 hour, then fetches fresh data
- Database uses ~3-5 MB per year of data

### View stored data:
- All menus: http://localhost:3000/analytics/all
- Statistics: http://localhost:3000/analytics/stats
