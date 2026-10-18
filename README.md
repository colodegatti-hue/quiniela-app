# Quiniela Argentina — Colo Apps

App (PWA) para ver los resultados de la Quiniela y controlar jugadas.

## Carpetas
- `shared/` — reglas de premios (las usan la app y el servidor). Pruebas: `cd shared && npm test`
- `backend/` — servidor (Render): busca los resultados en la Lotería de la Ciudad, con quinieleando.com.ar de respaldo, y los guarda en Neon. Pruebas: `cd backend && npm install && npm test`
- `frontend/` — la app (Vercel): resultados, mis jugadas y cómo se juega. Pruebas: `cd frontend && npm install && npm test`

## Publicación
- Render: servicio web, carpeta raíz `backend`, `npm install` / `npm start`. Variables: ver `backend/.env.example`.
- Vercel: proyecto con carpeta raíz `frontend` (Vite). Variable `VITE_API_URL` con la dirección de Render.
