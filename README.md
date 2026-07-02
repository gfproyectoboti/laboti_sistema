
# 📋 **Documentación Técnica - Gestor Financiero Automatizado**

**Versión:** 1.0.0  
**Última actualización:** Junio 2026  
**Estado:** Listo para producción

> [!NOTE]
> **Guías rápidas y manuales del proyecto:**
> * 📘 **[Manual de Despliegue y Puesta en Producción](MANUAL_DESPLIEGUE_PRODUCCION.md)**: Instrucciones paso a paso de infraestructura, configuración SSL, backups cron, Docker y despliegue en Vercel.
> * 🎯 **[Manual Funcional y Valor de Negocio](MANUAL_FUNCIONAL.md)**: Explicación de las reglas de negocio (distribución 60/30/10), control de saldos, egresos y control de asistencia.

## 📑 Tabla de Contenidos

1. [Descripción General](#descripción-general)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Tecnologías Utilizadas](#tecnologías-utilizadas)
4. [Estructura del Proyecto](#estructura-del-proyecto)
5. [Guía de Instalación](#guía-de-instalación)
6. [Configuración de Producción](#configuración-de-producción)
7. [Base de Datos](#base-de-datos)
8. [API REST](#api-rest)
9. [Autenticación y Seguridad](#autenticación-y-seguridad)
10. [Despliegue en Producción](#despliegue-en-producción)
11. [Monitoreo y Mantenimiento](#monitoreo-y-mantenimiento)

---

## 📌 **Descripción General**

**Gestor Financiero Automatizado** es una aplicación web full-stack diseñada para:
- 💰 Gestionar saldos en banco y efectivo
- 📊 Registrar ingresos/egresos diarios
- 👥 Administrar proveedores y pagos
- 📈 Generar reportes financieros
- 👤 Control de roles y permisos de empleados
- ⏰ Registro de asistencia y nómina

---

## 🏗️ **Arquitectura del Sistema**

```
┌─────────────────────────────────────────────┐
│  CLIENTE (Browser - React 19 + Tailwind)    │
└──────────────────┬──────────────────────────┘
                   │ HTTPS
                   ▼
┌─────────────────────────────────────────────┐
│  PROXY INVERSO (Nginx 1.25-alpine)          │
│  - SSL/TLS Termination                      │
│  - Rate Limiting                            │
│  - Compresión GZIP                          │
└──────────────────┬──────────────────────────┘
                   │
    ┌──────────────┼──────────────┐
    ▼              ▼              ▼
┌─────────┐  ┌──────────┐  ┌─────────────┐
│Frontend │  │  API     │  │ PostgreSQL  │
│(Nginx)  │  │(Express) │  │ Database    │
│:80      │  │:3000     │  │ :5432       │
└─────────┘  └──────────┘  └─────────────┘
```

---

## 🛠️ **Tecnologías Utilizadas**

### Backend
- **Node.js** 20+
- **Express** 5.2.1 (Framework web)
- **Prisma** 5.22.0 (ORM)
- **PostgreSQL** 16 (Base de datos)
- **JWT** 9.0.3 (Autenticación)
- **bcrypt** 6.0.0 (Hash de contraseñas)
- **Winston** 3.11.0 (Logging)
- **Helmet** 8.1.0 (Seguridad)

### Frontend
- **React** 19.2.5
- **Vite** 8.0.10 (Bundler)
- **Tailwind CSS** 4.3.0
- **Radix UI** (Componentes accesibles)
- **Axios** 1.16.1 (Cliente HTTP)

### DevOps
- **Docker** 24+
- **Docker Compose** 2.20+
- **Nginx** 1.25-alpine
- **Certbot** (Let's Encrypt)

---

## 🚀 **Instalación Local (Desarrollo)**

### 1. Clonar el repositorio

```bash
git clone https://github.com/max9lh/ecommerce-project.git
cd ecommerce-project
git checkout documentacion_tecnica
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
nano .env
```

**Variables críticas:**
```env
POSTGRES_DB=gestor_financiero
POSTGRES_USER=gestor_user
POSTGRES_PASSWORD=contraseña_aqui
JWT_SECRET=clave_jwt_aqui
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

### 3. Levantar stack

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# En background
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

### 4. Verificar servicios

```bash
# API
curl http://localhost:3000/api/health

# Frontend
http://localhost:5173

# Proxy
http://localhost:8080
```

---

## 🗄️ **Modelo de Datos (Prisma)**

```prisma
enum Role {
  ADMIN
  EMPLOYEE
}

model User {
  id                 Int      @id @default(autoincrement())
  username           String   @unique
  password_hash      String
  role               Role     @default(EMPLOYEE)
  pct_merchandise    Decimal  @default(0.60)
  pct_fixed_expenses Decimal  @default(0.30)
  pct_savings        Decimal  @default(0.10)
  created_at         DateTime @default(now())
  deleted_at         DateTime?
  
  accounts           Account[]
  expenses           Expense[]
  providers          Provider[]
  employeePermission EmployeePermission?
}

model Account {
  id       Int      @id @default(autoincrement())
  user_id  Int
  name     String   @db.VarChar(20)
  balance  Decimal  @default(0.00)
  user     User     @relation(fields: [user_id])
}

model Provider {
  id                Int      @id @default(autoincrement())
  user_id           Int
  name              String   @db.VarChar(100)
  payment_condition String   // "Contado" | "Crédito"
  credit_days       Int      @default(0)
  user              User     @relation(fields: [user_id])
  expenses          Expense[]
}

model Expense {
  id              Int       @id @default(autoincrement())
  user_id         Int
  provider_id     Int
  account_id      Int
  budget_category String    // "Mercadería", "Gastos Fijos", "Ahorro"
  amount          Decimal
  status          String    @default("Pagado")
  due_date        DateTime?
  created_at      DateTime  @default(now())
  paid_at         DateTime?
}

model EmployeePermission {
  id                  Int      @id @default(autoincrement())
  user_id             Int      @unique
  canRegisterClosures Boolean  @default(false)
  canRegisterExpenses Boolean  @default(false)
  canPayExpenses      Boolean  @default(false)
  canManageProviders  Boolean  @default(false)
  user                User     @relation(fields: [user_id])
}
```

---

## 🚢 **Despliegue y Puesta en Producción**

Para garantizar un entorno seguro y automatizado, se ha redactado una guía completa paso a paso con las mejores prácticas en el archivo independiente **[Manual de Despliegue y Guía Técnica de Producción](MANUAL_DESPLIEGUE_PRODUCCION.md)**.

Este manual detalla:
- 🐳 **Estrategia Docker**: Segmentación de subredes internas (`backend_network` y `frontend_network`).
- 🔐 **SSL Real**: Configuración automatizada y renovación con Certbot y Let's Encrypt.
- 🛡️ **Hardening**: Cabeceras de seguridad HTTP, rate limiting en Nginx y Express, y ejecución con usuario no-root en Docker.
- 💾 **Respaldos**: Script bash cron automatizado para `pg_dump` con rotación diaria y retención de 30 días.
- ⚙️ **Monitoreo y Mantenimiento**: Comandos para análisis de consumo y resolución de problemas comunes.

Recomendamos revisar y seguir la guía paso a paso del manual antes de levantar el stack en su servidor VPS.

---
```

**Última actualización:** Junio 2026  
**Versión:** 1.1.1
