# Despliegue Automatizado (CI/CD)

## Plataformas
- GitHub Pages: auto-deploy de `kyrbi-frontend/`.
- Vercel: deploy de frontend con headers de seguridad.
- Netlify: deploy de frontend y headers via `netlify.toml`.
- Render: backend Node.js con HTTPS provisto por la plataforma.

## Secrets requeridos
- `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
- `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID`
- `RENDER_DEPLOY_HOOK_URL`

## Workflows
- `.github/workflows/ci.yml`: pruebas y auditoría.
- `.github/workflows/deploy-gh-pages.yml`: GitHub Pages.
- `.github/workflows/deploy-vercel.yml`: Vercel.
- `.github/workflows/deploy-netlify.yml`: Netlify.
- `.github/workflows/deploy-render.yml`: Render.
- `.github/workflows/backup.yml`: backups diarios con artifacts.

## Variables de entorno
- `PORT`, `CORS_ORIGIN`, `FORCE_HTTPS`, `CSRF_ENABLED`
- Claves OAuth y JWT para auth.

## Pasos rápidos
1. Subir repo a GitHub.
2. Configurar secrets del repositorio.
3. Push a `main`/`master` para disparar CI/CD.
