# AssetFlow - Enterprise Asset & Resource Management System

A full-stack ERP platform for tracking, allocating, and maintaining organizational assets and shared resources.

## Tech Stack

- **Frontend:** React, Vite, Tailwind CSS, Recharts
- **Backend:** Node.js, Express.js
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Auth:** JWT with Refresh Tokens, RBAC

## Features

- Login/Signup (Employee-only signup, Admin assigns roles)
- Dashboard with KPIs and overdue alerts
- Organization Setup (Departments, Categories, Employees)
- Asset Registration & Directory with lifecycle states
- Allocation with conflict prevention & transfer workflow
- Resource Booking with overlap validation
- Maintenance approval workflow
- Audit cycles with discrepancy reports
- Reports & Analytics with charts
- Notifications & Activity Logs
- Dark/Light theme support

## Prerequisites

- Node.js 18+
- PostgreSQL 14+

## Setup

### 1. Database

Create a PostgreSQL database:

```sql
CREATE DATABASE assetflow;
```

### 2. Backend

```bash
cd backend
npm install
```

Update `backend/.env` with your PostgreSQL connection:

```
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/assetflow?schema=public"
```

Run migrations and seed:

```bash
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

Backend runs at `http://localhost:5000`

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`

## Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@assetflow.com | Admin@123 |
| Employee | employee@assetflow.com | Employee@123 |

## API Endpoints

- `POST /api/auth/signup` - Register (Employee only)
- `POST /api/auth/login` - Login
- `GET /api/dashboard` - Dashboard KPIs
- `CRUD /api/departments` - Department management
- `CRUD /api/categories` - Asset categories
- `CRUD /api/employees` - Employee directory
- `CRUD /api/assets` - Asset management
- `POST /api/allocations` - Allocate assets
- `POST /api/transfers` - Transfer requests
- `CRUD /api/bookings` - Resource bookings
- `CRUD /api/maintenance` - Maintenance workflow
- `CRUD /api/audits` - Audit cycles
- `GET /api/reports` - Analytics
- `GET /api/notifications` - Notifications
- `GET /api/activity` - Activity logs

## Project Structure

```
assetflow/
├── backend/          # Express API + Prisma
├── frontend/         # React SPA
└── README.md
```

## License

MIT

## Enterprise Extensions (v2.0)

### Authentication & Security
- Adaptive MFA (risk-based OTP via email)
- Magic link login (`/magic-login?token=...`)
- Passkey registration & login (browser-stored credential)
- Company domain restriction (Admin → Security Settings)
- Trusted device management
- Suspicious login detection & security events

### Dashboard
- AI daily summary, smart recommendations, asset health widget
- Role-based executive dashboard (Admin/Manager/Head/Employee)
- Critical alerts banner, live 30s auto-refresh

### Organization
- Drag-and-drop org tree, approval matrix builder
- CSV bulk import (employees, departments, assets, categories)
- Batch asset reassignment, HRMS sync API stubs

### Assets & Allocation
- RFID field, AI image recognition (simulated), digital twin API
- Dynamic health score, warranty timeline, immutable asset history
- AI allocation recommendations, digital signatures, custody timeline

### Bookings & Maintenance
- AI alternative suggestions, smart waitlist, QR check-in
- Google Calendar ICS export, no-show auto-release (cron)
- Predictive maintenance, IoT sensor dashboard (simulated)
- Spare parts inventory, MTTR analytics, SLA tracking

### Audit & Reports
- Blind audit mode, offline sync, QR verification, auto discrepancy reports
- AI business insights, forecasting, department benchmarking, cost prediction

### API Documentation
- Swagger: `backend/docs/swagger.json`
- Postman: `backend/docs/postman_collection.json`

### New API Routes (prefix `/api`)
- Auth: `/auth/mfa/verify`, `/auth/magic-link/*`, `/auth/passkey/*`, `/auth/devices`
- Enterprise: `/ai/*`, `/organization/*`, `/assets/:id/twin`, `/maintenance/predictive`, `/reports/insights`, etc.
