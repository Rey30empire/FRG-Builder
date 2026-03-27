# Estado de unificacion

## Regla principal

La unica app que se sigue desarrollando es la raiz de este repo: `FRG Builder`.

## Fuera del scope del repo productivo

- `Builder-FRG-LLC/`
- `Builder_Rey30/`
- `Rey30_BuildingConnecting/`

Esas carpetas quedan como respaldo local y no forman parte del push del repo canonico.

## Scope productivo actual

- `src/`
- `prisma/`
- `public/`
- `docs/`
- `scripts/`
- `clean_and_start.bat`

## Decision de arquitectura

- Una sola app Next.js.
- Una sola base Prisma.
- Un solo flujo principal:
  `PDF -> analisis -> takeoff -> estimate -> proposal -> envio -> follow-up -> promocion`.

## Siguiente regla operativa

Cualquier mejora nueva debe entrar en la raiz y no en los proyectos legacy.
