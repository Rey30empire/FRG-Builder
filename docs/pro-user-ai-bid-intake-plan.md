# FRG Builder Pro Plan

## Objetivo

Llevar FRG Builder a un flujo profesional donde cada usuario pueda:

1. Registrarse y crear su workspace.
2. Configurar desde frontend sus propias API keys de AI.
3. Activar OpenAI, Claude o Gemini por cuenta y por toggle.
4. Recibir oportunidades tipo BuildingConnected.
5. Cargar descripcion, direccion, mapa, imagenes y PDFs.
6. Dejar que el sistema seleccione el set de planos correcto.
7. Ejecutar takeoff, estimate y proposal con pipeline manual o agentico.
8. Revisar antes de enviar o dejar que el sistema avance segun permisos.

## Principios de arquitectura

- Toda configuracion de AI debe ser por usuario, no solo global.
- Las API keys del usuario no deben guardarse en texto plano.
- El frontend debe permitir configurar, probar, activar y desactivar providers.
- El pipeline debe soportar dos modos:
  - manual
  - assisted/agentic
- Cada salida importante debe dejarse en estado de revision antes de enviar, salvo que el usuario quite el review gate.
- El intake del bid debe vivir como una capa formal del proyecto, no solo como campos sueltos.

## Bloque A: AI por usuario con frontend real

### Meta

Cada usuario administra sus providers desde la app:

- OpenAI
- Claude
- Gemini

y elige:

- provider principal
- toggles on/off
- modelo por provider
- auto-fallback

### Implementacion

#### A1. Vault de credenciales por usuario

Crear una capa nueva para secretos de usuario:

- `UserSecret` o `ApiCredential`
- `userId`
- `provider`
- `encryptedKey`
- `lastValidatedAt`
- `status`
- `label`

La key debe guardarse cifrada con una master key del servidor:

- `APP_ENCRYPTION_KEY`

No debe exponerse nunca de regreso al frontend.

#### A2. Settings API por usuario

Rutas nuevas o ampliadas:

- `GET /api/ai/settings`
- `PUT /api/ai/settings`
- `POST /api/ai/providers/validate`
- `DELETE /api/ai/providers/:provider`

Cada usuario debe poder:

- guardar su key
- validar su key
- activar provider
- desactivar provider
- cambiar modelo
- marcar provider principal

#### A3. Frontend de AI settings

Crear una vista real dentro del app con:

- input seguro para API key
- boton `Validate`
- toggle `Enabled`
- selector de modelo
- badge `Valid / Missing / Failed`
- selector de provider principal

#### A4. Runtime del agent

El runtime del chat debe resolver providers asi:

1. provider principal del usuario si esta habilitado y la key valida
2. fallback del usuario
3. provider global del sistema solo si el plan o politica lo permite

### Criterio de terminado

- Un usuario entra a la app.
- Pega su `OPENAI_API_KEY`.
- La valida desde frontend.
- Activa OpenAI.
- El chat, el estimate agent y el orchestrator ya funcionan con su propia cuenta.

## Bloque B: Registro y onboarding profesional

### Meta

Que un usuario nuevo entre sin ayuda manual y deje lista su cuenta para usar:

- correo
- sender profile
- AI provider
- company profile
- trade focus

### Implementacion

#### B1. Registro

Mantener:

- `register`
- `login`
- `session`

y agregar onboarding inicial:

- nombre
- company name
- phone
- default trade package
- zona de trabajo
- sender profile

#### B2. Wizard inicial

Pasos del wizard:

1. perfil
2. company/sender
3. AI setup
4. estimate defaults
5. first project intake

### Criterio de terminado

- El usuario puede registrarse.
- Configura su sender y su OpenAI key desde la app.
- Sale del onboarding con su workspace listo.

## Bloque C: Bid Intake tipo BuildingConnected

### Meta

Modelar una oportunidad de bid de forma profesional antes del takeoff.

### Datos que debe guardar

- `opportunityName`
- `client`
- `clientEmail`
- `estimatorContact`
- `dueDate`
- `jobWalkDate`
- `rfiDueDate`
- `projectSize`
- `location`
- `address`
- `lat/lng`
- `scopePackage`
- `description`
- `tradeSpecificInstructions`
- `bidFormRequired`
- `attachments`
- `source`
- `externalUrl`
- `status`

### Implementacion

#### C1. Modelo de oportunidad

Crear `BidOpportunity` o enriquecer `ProjectMemory` con un bloque estructurado de intake.

#### C2. Frontend tipo tablero

Vista estilo bid board:

- `Undecided`
- `Accepted`
- `Submitted`
- `Won`
- `Archived`

#### C3. Opportunity detail

Pantalla con:

- overview
- files
- map
- notes
- bid form
- internal use
- AI actions

### Criterio de terminado

- El usuario puede cargar una oportunidad con todos los metadatos del bid.
- Esa oportunidad ya queda lista para pasar al pipeline de estimate.

## Bloque D: Ingestion de documentos y seleccion inteligente del set

### Meta

Cuando lleguen muchos PDFs, el sistema debe encontrar:

- planos utiles
- specs relevantes
- addenda
- bid forms
- scopes por trade

### Implementacion

#### D1. Clasificacion documental

Por documento y por pagina:

- trade
- category
- sheet number
- discipline
- confidence

#### D2. Ranking de relevancia

Crear score de relevancia para el trade activo:

- coincide con scope package
- coincide con descripcion del proyecto
- coincide con keywords del bid
- es plan/spec/addenda
- contiene cantidades o detalles medibles

#### D3. Resultado de seleccion

El sistema debe producir:

- `selectedForTakeoff`
- `selectedForProposalContext`
- `requiresHumanReview`

### Criterio de terminado

- Si suben 20 PDFs, el sistema identifica automaticamente cuales usar para el takeoff del paquete correcto.

## Bloque E: Takeoff y estimate pro

### Meta

Generar estimados serios y auditables.

### Implementacion

#### E1. Takeoff workspace

Debe mostrar:

- documentos elegidos
- partidas detectadas
- cantidades
- fuente por hoja/pagina
- confidence por item

#### E2. Estimate engine

Debe calcular:

- materiales
- mano de obra
- equipo
- overhead
- profit
- contingency
- duration
- weather factor
- risk factor

#### E3. Pricing por zona

Agregar capa de pricing por:

- ciudad
- estado
- mercado
- tipo de obra

#### E4. Revision humana

Todo estimate generado por AI debe permitir:

- aceptar item
- editar item
- eliminar item
- agregar item manual

### Criterio de terminado

- El usuario puede hacer un estimate completo desde el intake del bid y revisar item por item antes de enviarlo.

## Bloque F: Proposal y bid form

### Meta

Entregar una propuesta profesional y, si el bid lo exige, llenar el bid form.

### Implementacion

- proposal editable
- branded PDF
- bid form assistant
- attachments
- review status
- send tracking

### Criterio de terminado

- Desde una oportunidad aceptada se genera proposal PDF y paquete listo para submit.

## Bloque G: Agentes y orquestador profesional

### Meta

Tener agentes especializados que colaboren sobre el mismo proyecto.

### Agentes iniciales

- `document-control-agent`
- `scope-selection-agent`
- `takeoff-agent`
- `estimator-agent`
- `proposal-agent`
- `follow-up-agent`

### Reglas

- cada agente con toggle
- permisos por nivel
- herramientas permitidas por agente
- review gate por agente
- logs por ejecucion

### Flujo

El usuario puede:

- hacerlo manual desde modulos
- pedirlo por chat
- lanzar pipeline completo

Ejemplo:

`Analiza este bid package, elige los planos correctos, genera el estimate y dejalo en revision`

### Criterio de terminado

- El chat puede delegar el trabajo entre agentes y dejar entregables revisables dentro del app.

## Bloque H: Seguridad, billing y uso

### Meta

Hacer sostenible el uso de AI por usuario.

### Implementacion

- cifrado de API keys
- rate limiting por usuario
- usage logs por provider/model
- costo aproximado por generacion
- cuotas por plan
- billing por uso si aplica

### Criterio de terminado

- Se puede saber que usuario uso que provider, cuanto genero y si supero sus limites.

## Orden recomendado

1. Vault de API keys por usuario
2. Frontend de AI settings por usuario
3. Onboarding/wizard
4. Bid intake profesional
5. Seleccion inteligente de documentos
6. Takeoff workspace pro
7. Estimate engine por zona/mercado
8. Proposal y bid form
9. Orquestador multiagente
10. Billing, quotas y observabilidad

## Criterio final de producto

Se considera listo a nivel pro cuando un usuario nuevo pueda:

1. registrarse
2. configurar su sender
3. pegar su OpenAI key
4. activarla desde frontend
5. crear o importar una oportunidad de bid
6. subir PDFs, imagenes y descripcion
7. dejar que el sistema elija el set correcto
8. generar takeoff y estimate
9. revisar la propuesta
10. enviar o someter el bid desde la misma plataforma
