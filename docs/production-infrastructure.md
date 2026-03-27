# Bloque 3: infraestructura productiva

## Lo que ya quedo implementado

- Storage abstracto con soporte local y S3-compatible en `src/lib/storage.ts`.
- Descarga segura de documentos por sesion en `src/app/api/documents/file/route.ts`.
- Analisis de PDF desacoplado del disco local; ahora puede leer desde storage durable.
- Scripts operativos:
  - `npm run infra:check`
  - `npm run ops:backup:local`
  - `npm run ops:cleanup:storage`

## Modo local

- `DATABASE_URL` puede seguir apuntando a SQLite.
- `STORAGE_DRIVER` puede quedarse en `local`.
- `npm run ops:backup:local` genera una copia timestamped de DB y uploads.

## Modo produccion esperado

### Base de datos

- Usar `DATABASE_URL` de Postgres administrado.
- Dejar de depender de `file:../db/custom.db`.
- Usar `npm run db:deploy` en despliegues cuando exista el flujo final de migraciones productivas.

### Storage

Variables esperadas:

- `STORAGE_DRIVER=s3`
- `STORAGE_REGION`
- `STORAGE_BUCKET`
- `STORAGE_ACCESS_KEY_ID`
- `STORAGE_SECRET_ACCESS_KEY`

Variables opcionales:

- `STORAGE_ENDPOINT`
- `STORAGE_PUBLIC_BASE_URL`
- `STORAGE_FORCE_PATH_STYLE`
- `STORAGE_PREFIX`
- `STORAGE_SIGNED_URL_TTL_SECONDS`

### Enforcement

- Si `FRG_REQUIRE_PROD_INFRA=true`, el chequeo de entorno ya falla cuando:
  - `DATABASE_URL` sigue siendo SQLite
  - `STORAGE_DRIVER` sigue en `local`
  - faltan variables criticas de storage S3

## Lo que todavia falta para cerrar el bloque 3 al 100%

- Migracion real a Postgres administrado.
- Estrategia final de migraciones productivas por ambiente.
- Bucket real enlazado en deployment.
- Backup remoto automatizado y politicas de retencion fuera del filesystem local.
