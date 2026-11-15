# Cómo publicar M.I.Y.H. en Netlify

El proyecto ya trae `netlify.toml`: Netlify instala, descarga los datos de la NASA y compila solo.
No hay que configurar nada a mano. Requiere Node 22 (ya está fijado en `netlify.toml`).

## Antes de publicar (2 minutos, en tu Mac)

```bash
cd "Nasa-Space-App-challange-2026"
npm run typecheck   # debe terminar sin errores
npm test            # pruebas del planificador, salud y datos
npm run build       # compila igual que Netlify
```

## Opción A · Desde GitHub (recomendada: se vuelve a publicar con cada push)

1. Sube los cambios a tu fork:
   ```bash
   git add -A
   git commit -m "Simulador topográfico, fuentes ampliadas y pulido final"
   git push fork feature/intelligent-mission-control
   ```
2. En https://app.netlify.com → **Add new site → Import an existing project → GitHub**.
3. Elige `josetiky/Nasa-Space-App-challange-2026` y la rama `feature/intelligent-mission-control`.
4. Deja los campos de compilación como aparecen (los toma de `netlify.toml`) y pulsa **Deploy**.
5. Opcional: en **Site configuration → Environment variables** agrega `NASA_API_KEY`
   (gratis en https://api.nasa.gov). Sin ella se usa `DEMO_KEY`, que tiene límite de consultas.

Si el sitio ya existe en Netlify y está conectado al repositorio, basta con el paso 1.

## Opción B · Desde la terminal (sin GitHub)

```bash
npm install -g netlify-cli
netlify login
netlify init              # solo la primera vez: crea o enlaza el sitio
netlify deploy --build --prod
```

## Después de publicar, revisa

- `/#inicio`: el botón **Explora nuestro simulador topográfico de Marte** abre la ventana con Unity.
- `/#misiones`: botón **Simulador topográfico** junto a "Explorar terreno 3D".
- `/#recursos`: la tarjeta 01 es el simulador y **Fuentes y créditos** muestra las 24 fuentes.
- `/#marswalk` y `/#simulacion`: el mapa de Gale carga y la caminata corre.

## El simulador topográfico

Vive en su propio sitio: https://harmonious-heliotrope-ea417f.netlify.app/
M.I.Y.H. solo lo muestra dentro de una ventana. Para cambiar la dirección, edita `TOPO_SIM_URL`
en `src/components/trek/marswalk/resourcesTab.tsx`. Si renombras o borras ese sitio en Netlify,
el botón dejará de funcionar.

## Otra plataforma

Solo Netlify está probado. El servidor usa Nitro, así que en teoría Vercel o Cloudflare funcionan
cambiando `NITRO_PRESET` (`vercel`, `cloudflare-pages`), pero eso no se ha verificado.
