# Guia de Infraestructura: Next.js + Supabase + Prisma + Socket.IO en Google Cloud Run

Esta guia replica paso a paso la infraestructura de esta aplicacion para construir una nueva app con las mismas bases tecnologicas y llevarla a produccion en Google Cloud Run.

---

## Stack Tecnologico

| Capa | Tecnologia |
|---|---|
| Framework | Next.js 15 (React 19, TypeScript) |
| Estilos | Tailwind CSS v4 + shadcn/ui (Radix UI) |
| Autenticacion | Supabase Auth (Google OAuth, SSR) |
| Base de datos | PostgreSQL via Supabase + Prisma ORM |
| Tiempo real | Socket.IO (custom server) |
| Estado global | Zustand |
| Formularios | React Hook Form + Zod |
| Tablas / Queries | TanStack Table + TanStack Query |
| Contenedor | Docker multi-stage (Node 20 Alpine) |
| CI/CD | Google Cloud Build |
| Hosting | Google Cloud Run (northamerica-south1) |
| Registry | Google Artifact Registry |

---

## Parte 1: Crear el Proyecto

### 1.1 Inicializar Next.js

```bash
npx create-next-app@latest mi-nueva-app --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd mi-nueva-app
```

### 1.2 Instalar dependencias del stack

```bash
# ORM y base de datos
npm install @prisma/client prisma

# Supabase (auth SSR)
npm install @supabase/supabase-js @supabase/ssr

# Formularios y validacion
npm install react-hook-form @hookform/resolvers zod

# Estado global
npm install zustand

# Tablas y queries
npm install @tanstack/react-table @tanstack/react-query

# Socket.IO (servidor custom)
npm install socket.io socket.io-client

# Utilidades
npm install dotenv tsx uuid date-fns axios

# shadcn/ui (instalar componentes individualmente segun necesidad)
npx shadcn@latest init
```

```bash
# Dev dependencies
npm install -D nodemon ts-node tsconfig-paths @types/node @types/react @types/react-dom
```

---

## Parte 2: Configurar Next.js para Docker y Produccion

### 2.1 `next.config.mjs`

El punto mas importante es `output: 'standalone'`. Esto genera una carpeta `.next/standalone` autocontenida, necesaria para que el Dockerfile funcione correctamente.

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  output: 'standalone', // CRITICO para Docker
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: '*.googleusercontent.com' },
    ],
  },
  experimental: {
    allowedDevOrigins: ['localhost:8080', '0.0.0.0:8080', '127.0.0.1:8080'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
```

---

## Parte 3: Servidor Custom con Socket.IO

Next.js por defecto no soporta WebSockets. Se usa un servidor HTTP personalizado que envuelve Next.js y agrega Socket.IO.

### 3.1 `tsconfig.server.json` (en la raiz del proyecto)

Este tsconfig es exclusivo para compilar el servidor, con `module: commonjs` para compatibilidad con Node.js.

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node",
    "noEmit": false
  },
  "include": [
    "server.ts",
    "src/lib/socket.ts"
  ]
}
```

### 3.2 `server.ts` (en la raiz del proyecto)

```typescript
import { config } from 'dotenv';
import { resolve } from 'path';

// Cargar .env.local solo en desarrollo
if (process.env.NODE_ENV !== 'production') {
  config({ path: resolve(process.cwd(), '.env.local') });
}

import { setupSocket } from '@/lib/socket';
import { createServer } from 'http';
import { Server } from 'socket.io';
import next from 'next';

const dev = process.env.NODE_ENV !== 'production';
const currentPort = process.env.PORT ? parseInt(process.env.PORT) : 8080;
const hostname = '0.0.0.0';

async function createCustomServer() {
  try {
    const nextApp = next({
      dev,
      dir: process.cwd(),
      conf: dev ? undefined : { distDir: './.next' }
    });

    await nextApp.prepare();
    const handle = nextApp.getRequestHandler();

    const server = createServer((req, res) => {
      if (req.url?.startsWith('/api/socketio')) return;
      handle(req, res);
    });

    const allowedOriginsEnv = process.env.SOCKETIO_CORS_ORIGINS || '*';
    const allowedOrigins = allowedOriginsEnv === '*'
      ? '*'
      : allowedOriginsEnv.split(',').map(v => v.trim()).filter(Boolean);

    const io = new Server(server, {
      path: '/api/socketio',
      cors: { origin: allowedOrigins, methods: ['GET', 'POST'] }
    });

    setupSocket(io);

    server.listen(currentPort, hostname, () => {
      console.log(`> Ready on http://${hostname}:${currentPort}`);
    });

    const shutdown = () => {
      server.close(() => process.exit(0));
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (err) {
    console.error('Server startup FATAL error:', err);
    setTimeout(() => process.exit(1), 1000);
  }
}

createCustomServer();
```

### 3.3 `src/lib/socket.ts`

```typescript
import { Server } from 'socket.io';

export const setupSocket = (io: Server) => {
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('message', (msg: { text: string; senderId: string }) => {
      socket.emit('message', {
        text: `Echo: ${msg.text}`,
        senderId: 'system',
        timestamp: new Date().toISOString(),
      });
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });

    socket.emit('message', {
      text: 'Welcome!',
      senderId: 'system',
      timestamp: new Date().toISOString(),
    });
  });
};
```

### 3.4 Scripts en `package.json`

```json
{
  "scripts": {
    "dev": "nodemon --exec \"npx ts-node -r tsconfig-paths/register --project tsconfig.server.json server.ts\" --watch server.ts --watch src --ext ts,tsx,js,jsx",
    "dev:win": "set NODE_ENV=development && npx tsx server.ts",
    "build": "next build && prisma generate",
    "start": "NODE_ENV=production tsx server.ts",
    "postinstall": "prisma generate"
  }
}
```

---

## Parte 4: Configurar Prisma (ORM)

### 4.1 Inicializar Prisma

```bash
npx prisma init
```

Esto crea `prisma/schema.prisma` y agrega `DATABASE_URL` en `.env`.

### 4.2 `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Define tus modelos aqui segun tu dominio
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("users")
}
```

### 4.3 `src/lib/db.ts` (singleton de PrismaClient)

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
```

### 4.4 Comandos utiles de Prisma

```bash
# Crear y aplicar migracion en desarrollo
npx prisma migrate dev --name init

# Aplicar migraciones en produccion (sin interactividad)
npx prisma migrate deploy

# Actualizar schema sin migracion (prototipado rapido)
npx prisma db push

# Generar cliente
npx prisma generate

# Explorar datos
npx prisma studio
```

---

## Parte 5: Configurar Supabase (Autenticacion)

### 5.1 Crear proyecto en Supabase

1. Ir a [supabase.com](https://supabase.com) y crear un nuevo proyecto.
2. Obtener `Project URL` y `anon/public key` desde **Settings > API**.
3. Para Google OAuth: **Authentication > Providers > Google** y configurar credenciales de Google Cloud Console.

### 5.2 `src/lib/supabase/client.ts` (uso en el navegador)

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'
  return createBrowserClient(supabaseUrl, supabaseKey)
}
```

### 5.3 `src/lib/supabase/server.ts` (uso en Server Components y API Routes)

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {}
      },
    },
  })
}
```

### 5.4 `src/lib/supabase/middleware.ts`

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() { return request.cookies.getAll() },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()

  // Redirigir a /login si no hay sesion activa
  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/auth') &&
    !request.nextUrl.pathname.startsWith('/_next') &&
    !request.nextUrl.pathname.startsWith('/api/health')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // OPCIONAL: Restriccion de dominio de email
  // if (user && user.email && !user.email.endsWith('@tuempresa.com')) {
  //   await supabase.auth.signOut()
  //   const url = request.nextUrl.clone()
  //   url.pathname = '/login'
  //   return NextResponse.redirect(url)
  // }

  return supabaseResponse
}
```

### 5.5 `src/middleware.ts`

```typescript
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

### 5.6 `src/app/auth/callback/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'
      let response: NextResponse

      if (isLocalEnv) {
        response = NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        response = NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        response = NextResponse.redirect(`${origin}${next}`)
      }

      response.headers.set('Cache-Control', 'no-store, max-age=0')
      return response
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
```

Ademas debes ir a Supabase > **Authentication > URL Configuration** y agregar:
- Site URL: `https://tu-servicio.run.app`
- Redirect URLs: `https://tu-servicio.run.app/auth/callback`

---

## Parte 6: Health Check

### `src/app/api/health/route.ts`

Cloud Run usa este endpoint para verificar que el contenedor esta vivo.

```typescript
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected'
    })
  } catch {
    return NextResponse.json(
      { status: 'unhealthy', database: 'disconnected' },
      { status: 503 }
    )
  }
}
```

---

## Parte 7: Variables de Entorno

### `.env.local` (desarrollo, NO commitear)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Base de datos (Supabase connection string)
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxxxxxxxxxxx.supabase.co:5432/postgres

# Webhooks u otros secretos
GOOGLE_CHAT_WEBHOOK_URL=https://chat.googleapis.com/v1/spaces/.../messages?key=...
```

### Regla critica de Next.js con variables publicas

- Las variables `NEXT_PUBLIC_*` se incrustan en el bundle del cliente **en tiempo de build**, no en runtime.
- Por eso el `Dockerfile` las recibe como `ARG` y las escribe en `.env.production` antes de ejecutar `npm run build`.
- Las variables de servidor (como `DATABASE_URL`) solo se necesitan en runtime.

---

## Parte 8: Dockerfile Multi-Stage

```dockerfile
# Etapa 1: Instalar dependencias
FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm install

# Etapa 2: Build de la aplicacion
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Variables NEXT_PUBLIC_* deben inyectarse en BUILD TIME
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}

# Generar Prisma Client
RUN npx prisma generate

# Escribir .env.production para que Next.js incruste las variables en el bundle
RUN echo "NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL" > .env.production && \
    echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY" >> .env.production

RUN npm run build

# Etapa 3: Imagen de produccion (minima)
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Archivos necesarios para el custom server
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json

RUN mkdir -p /app/data
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 8080
ENV PORT 8080
ENV HOSTNAME "0.0.0.0"

CMD ["npm", "run", "start"]
```

### `.dockerignore`

```
node_modules
.next
.git
.gitignore
README.md
.env
.env.*
.env.local
.env.production.local
.env.development.local
npm-debug.log*
dist
coverage
**/*.tsbuildinfo
Dockerfile*
docker-compose*.yml
.vercel
.DS_Store
dev.log
server.log
```

### Verificar localmente antes de subir

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="https://xxxx.supabase.co" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..." \
  -t mi-nueva-app:local .

docker run -p 8080:8080 \
  -e DATABASE_URL="postgresql://..." \
  mi-nueva-app:local
```

---

## Parte 9: Google Cloud Build (CI/CD)

### 9.1 Prerequisitos en Google Cloud

1. Habilitar APIs:
   - Cloud Build API
   - Cloud Run API
   - Artifact Registry API

```bash
gcloud services enable cloudbuild.googleapis.com run.googleapis.com artifactregistry.googleapis.com
```

2. Crear repositorio en Artifact Registry:

```bash
gcloud artifacts repositories create cloud-run-source-deploy \
  --repository-format=docker \
  --location=northamerica-south1 \
  --description="Repositorio de imagenes Docker"
```

3. Dar permisos al service account de Cloud Build:

```bash
PROJECT_ID=$(gcloud config get-value project)
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA}" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA}" \
  --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA}" \
  --role="roles/artifactregistry.writer"
```

### 9.2 `cloudbuild.yaml`

```yaml
steps:
  # Paso 1: Build de la imagen Docker con variables de build
  - name: 'gcr.io/cloud-builders/docker'
    entrypoint: 'sh'
    args:
      - '-c'
      - |
        docker build \
          --build-arg "NEXT_PUBLIC_SUPABASE_URL=${_NEXT_PUBLIC_SUPABASE_URL}" \
          --build-arg "NEXT_PUBLIC_SUPABASE_ANON_KEY=${_NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
          -t northamerica-south1-docker.pkg.dev/${PROJECT_ID}/cloud-run-source-deploy/MI-APP/MI-APP:${COMMIT_SHA} .

  # Paso 2: Push al Artifact Registry
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - 'northamerica-south1-docker.pkg.dev/$PROJECT_ID/cloud-run-source-deploy/MI-APP/MI-APP:$COMMIT_SHA'

  # Paso 3: Deploy en Cloud Run
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'MI-APP'
      - '--image'
      - 'northamerica-south1-docker.pkg.dev/$PROJECT_ID/cloud-run-source-deploy/MI-APP/MI-APP:$COMMIT_SHA'
      - '--region'
      - 'northamerica-south1'
      - '--platform'
      - 'managed'
      - '--allow-unauthenticated'
      - '--set-env-vars=DATABASE_URL=$_DATABASE_URL,NEXT_PUBLIC_SUPABASE_URL=$_NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY=$_NEXT_PUBLIC_SUPABASE_ANON_KEY'

# Variables del Trigger (se definen en la consola de Cloud Build)
substitutions:
  _NEXT_PUBLIC_SUPABASE_URL: ''
  _NEXT_PUBLIC_SUPABASE_ANON_KEY: ''
  _DATABASE_URL: ''

options:
  logging: CLOUD_LOGGING_ONLY
```

**Nota:** Reemplaza `MI-APP` por el nombre de tu servicio (ej: `mi-nueva-app`).

### 9.3 Configurar el Trigger en Cloud Build

1. Ir a **Cloud Build > Triggers > Create Trigger** en la consola de GCP.
2. Conectar el repositorio (GitHub, Bitbucket, etc.).
3. Configurar:
   - **Event:** Push to branch
   - **Branch:** `^main$`
   - **Config file:** `cloudbuild.yaml`
4. En **Substitution variables**, agregar:
   - `_NEXT_PUBLIC_SUPABASE_URL` = tu URL de Supabase
   - `_NEXT_PUBLIC_SUPABASE_ANON_KEY` = tu anon key de Supabase
   - `_DATABASE_URL` = connection string de PostgreSQL

---

## Parte 10: Google Cloud Run (Configuracion del Servicio)

### Variables de entorno en Cloud Run

Ademas de lo que se pasa por `cloudbuild.yaml`, puedes configurar variables directamente en el servicio:

```bash
gcloud run services update MI-APP \
  --region northamerica-south1 \
  --set-env-vars DATABASE_URL="postgresql://..." \
  --set-env-vars NEXT_PUBLIC_SUPABASE_URL="https://..." \
  --set-env-vars NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."
```

### Configuracion recomendada del servicio

En **Cloud Run > MI-APP > Edit & Deploy**:

| Parametro | Valor recomendado |
|---|---|
| CPU | 1 |
| Memory | 512 MiB - 1 GiB |
| Min instances | 0 (escala a cero) o 1 (sin cold start) |
| Max instances | 10 |
| Port | 8080 |
| Request timeout | 300s |
| Concurrency | 80 |

### Health check

Cloud Run verifica que el contenedor este listo llamando al puerto 8080. El endpoint `/api/health` sirve para verificaciones adicionales de la aplicacion desde monitoreo externo.

---

## Parte 11: Estructura de Carpetas Recomendada

```
mi-nueva-app/
├── prisma/
│   └── schema.prisma          # Modelos de BD
├── public/                    # Archivos estaticos
├── scripts/
│   ├── check-env.js           # Verificar variables de entorno
│   └── deploy.sh              # Script de deploy manual (opcional)
├── src/
│   ├── app/
│   │   ├── (authenticated)/   # Rutas protegidas (layout con auth)
│   │   │   └── layout.tsx
│   │   ├── api/
│   │   │   └── health/
│   │   │       └── route.ts   # Health check
│   │   ├── auth/
│   │   │   └── callback/
│   │   │       └── route.ts   # OAuth callback
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   ├── components/
│   │   └── ui/                # Componentes shadcn/ui
│   ├── lib/
│   │   ├── db.ts              # Singleton Prisma
│   │   ├── socket.ts          # Logica Socket.IO
│   │   └── supabase/
│   │       ├── client.ts      # Cliente browser
│   │       ├── server.ts      # Cliente server
│   │       └── middleware.ts  # Actualizacion de sesion
│   └── middleware.ts          # Middleware Next.js (auth guard)
├── .dockerignore
├── .env.local                 # Variables locales (NO commitear)
├── .gitignore
├── cloudbuild.yaml            # Pipeline CI/CD
├── Dockerfile
├── next.config.mjs
├── package.json
├── server.ts                  # Custom server (Next.js + Socket.IO)
├── tsconfig.json
└── tsconfig.server.json       # Tsconfig exclusivo para server.ts
```

---

## Parte 12: `.gitignore` recomendado

```gitignore
# Dependencias
node_modules/
.pnp
.pnp.js

# Build
.next/
out/
dist/
build/

# Variables de entorno (NUNCA commitear)
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
*.log

# OS
.DS_Store
Thumbs.db

# Editor
.vscode/
.idea/
*.swp
*.swo

# TypeScript
*.tsbuildinfo
next-env.d.ts

# Tests
coverage/

# Misc
.vercel
.turbo
```

---

## Parte 13: Flujo Completo de Desarrollo a Produccion

```
1. Escribes codigo en local
       |
2. git push origin main
       |
3. Cloud Build Trigger se activa automaticamente
       |
4. Cloud Build ejecuta cloudbuild.yaml:
   a. docker build (con NEXT_PUBLIC_* como ARG)
   b. docker push a Artifact Registry
   c. gcloud run deploy con variables de runtime
       |
5. Cloud Run reemplaza el contenedor anterior
       |
6. URL publica disponible en:
   https://MI-APP-xxxx-nn.a.run.app
```

---

## Parte 14: Checklist de Lanzamiento

Antes del primer deploy, verifica:

- [ ] Proyecto creado en GCP con billing habilitado
- [ ] APIs habilitadas: Cloud Build, Cloud Run, Artifact Registry
- [ ] Repositorio creado en Artifact Registry
- [ ] Permisos del service account de Cloud Build configurados
- [ ] Proyecto Supabase creado y Google OAuth habilitado
- [ ] Redirect URL de Supabase apunta a `https://MI-APP.run.app/auth/callback`
- [ ] Variables de entorno definidas en el Trigger de Cloud Build
- [ ] `next.config.mjs` tiene `output: 'standalone'`
- [ ] `Dockerfile` recibe `NEXT_PUBLIC_*` como `ARG` y escribe `.env.production` antes del build
- [ ] `cloudbuild.yaml` tiene el nombre correcto del servicio y la region
- [ ] Health check en `/api/health` responde con HTTP 200
- [ ] `.dockerignore` excluye `.env*` y `node_modules`

---

## Notas Importantes

**Por que las variables NEXT_PUBLIC_* van en el Dockerfile como ARG:**
Next.js incrusta estas variables en el bundle JavaScript del cliente durante el `npm run build`. Si no estan disponibles al momento del build, el cliente no las tendra. En Cloud Run estas variables estan en el Trigger como substitutions y llegan al Dockerfile como `--build-arg`.

**Por que hay dos tsconfig:**
`tsconfig.json` esta configurado para Next.js (bundler mode, noEmit). El servidor custom (`server.ts`) necesita `module: commonjs` para ser ejecutado directamente por Node.js, de ahi `tsconfig.server.json`.

**Por que standalone en next.config.mjs:**
Sin `output: 'standalone'`, Next.js genera una carpeta `.next` que depende de `node_modules` completo (~500MB+). Con standalone, genera solo los archivos necesarios (~50MB), ideal para contenedores.

**Por que el servidor escucha en `0.0.0.0` y puerto `8080`:**
Cloud Run inyecta la variable `PORT` (siempre 8080 internamente) y espera que el contenedor escuche en todas las interfaces (`0.0.0.0`), no solo en `localhost`.
