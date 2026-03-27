# FRG Builder: unificacion y plan al 100%

## Proyecto canonico

La app canonica es esta raiz: `FRG Builder`.

Los proyectos `Builder-FRG-LLC` y `Builder_Rey30` quedan como referencia historica hasta que se archive su contenido util. No deben seguir evolucionando por separado.

## Que se tomo de cada proyecto

### FRG Builder
- Base principal de Next.js con modulos de `estimate`, `agent`, `learn`, `boost` y `admin`.
- APIs ya encaminadas para proyectos, documentos, estimados, leads, campanas y chat.
- Modelo Prisma orientado al flujo real del negocio.

### Builder-FRG-LLC
- Direccion de backend mas seria para aprendizaje, CRM y configuracion.
- Idea de seed, tablas base y enfoque de plataforma operable.
- Referencia para fortalecer onboarding de datos y pipeline comercial.

### Builder_Rey30
- Mejor punto de partida visual para `dashboard`.
- Mejor experiencia de entrada para navegar el producto como una sola plataforma.

## Estado despues de esta unificacion

- `dashboard` ya existe como modulo nativo en la raiz.
- La raiz ya tiene `learning` API propia.
- El usuario por defecto y el seed inicial ya existen para que las APIs no dependan de datos fantasmas.
- El upload de documentos ya guarda archivos fisicamente en `public/uploads/documents`.
- El build de produccion ya no depende de `cp`, asi que es compatible con Windows.

## Objetivo productivo final

La app debe poder operar como un sistema completo para contratistas:

1. Recibir planos y PDFs.
2. Analizar alcance y partidas.
3. Hacer takeoff y estimaciones reales.
4. Generar proposal y mandarla.
5. Dar seguimiento comercial.
6. Lanzar acciones de promocion y captacion.

## Plan de implementacion al 100%

### Fase 1: base operable
- Confirmar `prisma generate`, `prisma db push` y `npm run db:seed` como flujo oficial.
- Archivar o mover a `legacy/` los proyectos anidados cuando ya no se necesiten como referencia.
- Agregar auth real o al menos perfil multiusuario simple en lugar de depender siempre de `default-user`.

### Fase 2: intake de PDF
- Reemplazar el analisis mock de documentos por pipeline real: upload, OCR, clasificacion por trade, paginas relevantes y metadatos.
- Guardar resultados por documento y por pagina, no solo en un JSON general.
- Crear vista de revision para aprobar o corregir clasificacion antes del takeoff.
- Soportar addendas, specs, RFI y versiones de documentos.

### Fase 3: estimate engine real
- Conectar `EstimateModule` a datos reales y quitar los mocks locales.
- Agregar libreria de precios: labor, materiales, equipo, overhead, profit y contingencia.
- Permitir versionado de estimados, comparacion entre versiones y exclusiones por proyecto.
- Agregar formulas reales por trade: concreto, framing, drywall, roofing, demo, pintura y TI comercial.
- Registrar supuestos, desperdicio, rendimiento por crew y factores de riesgo.
- Guardar breakdown por:
  - materiales
  - mano de obra
  - equipo
  - subcontratos
  - overhead
  - profit
  - contingencia
- Permitir cambiar perfil de estimacion:
  - subcontractor
  - general contractor
  - owner estimate
  - educational
- Conectar costos a tablas reales de rates y dejar override por proyecto.

### Fase 4: proposal y envio
- Generar proposal PDF real con branding de FRG, scope, inclusiones, exclusiones, schedule y terminos.
- Guardar estado de envio: draft, sent, viewed, approved, rejected.
- Integrar email real para mandar estimate/proposal desde la app y registrar follow-up.
- Permitir adjuntar proposal, estimate breakdown y anexos de respaldo.
- Crear plantillas por tipo de cliente: residencial, comercial y TI.

### Fase 5: CRM y marketing/promocion
- Convertir `BoostModule` a CRUD real para leads, campanas, templates y secuencias.
- Crear pipeline por etapas con proximos follow-ups, notas y actividad.
- Agregar generacion de copy por canal: email, LinkedIn, Facebook y outreach comercial.
- Crear promociones por vertical:
  - ADU
  - remodelacion
  - tenant improvement
  - concrete/foundation
  - framing packages
- Medir resultados reales:
  - sent
  - opened
  - replied
  - booked calls
  - proposals sent
  - jobs won
- Crear secuencias automáticas:
  - lead nuevo
  - proposal enviada
  - proposal sin respuesta
  - cliente ganado
  - reactivacion de cliente viejo

### Fase 6: learn
- Conectar `LearnModule` a la API nueva para reemplazar mocks.
- Separar lessons, exercises, calculators y code references.
- Registrar progreso, score, tiempo invertido y recomendaciones por categoria.

### Fase 7: agent core
- Mejorar el router de skills para usar contexto de proyecto, documentos y estimados existentes.
- Guardar conversaciones por modulo y por proyecto.
- Agregar acciones seguras: crear estimate draft, generar follow-up, resumir PDFs y explicar takeoff.

### Fase 8: admin y operaciones
- Reemplazar data mock del admin por vistas reales de logs, skills, tools y configuracion.
- Agregar health checks, backups, exportacion y trazabilidad de eventos.
- Definir permisos reales por rol para lectura, escritura, exportacion y acciones conectadas.

### Fase 9: QA, seguridad y release
- Agregar pruebas de APIs criticas: projects, documents, estimates, learning, leads y campaigns.
- Validar flujo completo: PDF -> takeoff -> estimate -> proposal -> send -> follow-up.
- Preparar deploy y entorno productivo con storage, correo y backups reales.
- Crear monitoreo de errores, logs de actividad y eventos comerciales.
- Validar permisos por rol antes de exponer acciones de envio o exportacion.

## Orden recomendado de ejecucion

1. PDF intake real.
2. Estimate engine sin mocks.
3. Proposal PDF y envio.
4. CRM y follow-up.
5. Promocion y campanas.
6. Learn conectado a data real.
7. Admin, pruebas y deploy.

## Desglose por entregables

### Entregable A: estimacion real
- OCR + parser de documentos.
- Libreria de costos.
- Takeoff persistente.
- Breakdown real por rubro.
- Versiones de estimate.

### Entregable B: proposal y envio
- Proposal PDF con branding.
- Historial de envios.
- Estados comerciales.
- Seguimiento automatico.

### Entregable C: promocion
- CRM usable.
- Campanas y secuencias.
- Templates de contenido.
- Dashboard de conversion.

### Entregable D: produccion
- Deploy estable.
- Storage externo.
- Email real.
- Logs, backups y monitoreo.
- Roles y permisos.

## Criterio de terminado

Se considera al 100% cuando un usuario pueda:

1. Crear proyecto.
2. Subir PDF.
3. Analizar planos.
4. Generar takeoff.
5. Crear estimate.
6. Generar proposal PDF.
7. Enviar el estimado al cliente.
8. Hacer seguimiento desde CRM.
9. Lanzar una campana o secuencia comercial.
10. Medir conversion y retorno comercial desde el mismo sistema.
