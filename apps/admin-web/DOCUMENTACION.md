# Documentación del Proyecto: Beleza Dojo Access System

Este documento detalla la arquitectura, funcionalidades, requisitos de instalación y guía de despliegue para el sistema de gestión y control de acceso de **Beleza Dojo**.

## 1. Descripción General

**Beleza Dojo Access** es una plataforma web integral diseñada para la administración de un dojo de artes marciales. Combina un **Panel de Administración** potente para la gestión de miembros, pagos y accesos, con una **Landing Page** pública moderna para atraer nuevos alumnos y mostrar información institucional.

### Componentes Principales
1.  **Landing Page Pública**:
    *   Información institucional (Historia, Dónde Estamos).
    *   Mapa interactivo de academias (Red Lotus Club).
    *   Grilla de horarios automática.
    *   Presentación de profesores.
    *   Formularios de contacto y redirección a WhatsApp/Instagram.
2.  **Panel de Administración (Privado)**:
    *   Dashboard con métricas en tiempo real (Miembros activos, vencimientos, ingresos).
    *   Gestión de Miembros (CRUD completo, fotos de perfil, asignación de clases).
    *   Control de Pagos (Historial, registro manual, estados de cuenta).
    *   **Control de Acceso QR**: Scanner integrado para validar el ingreso de alumnos verificando el estado de su cuota.
    *   Mapas de calor y métricas de asistencia.

---

## 2. Pila Tecnológica (Tech Stack)

El proyecto está construido con tecnologías modernas, optimizadas para rendimiento y escalabilidad:

*   **Framework**: [Next.js 16](https://nextjs.org/) (App Router).
*   **Lenguaje**: TypeScript.
*   **Base de Datos & Auth**: [Supabase](https://supabase.com/).
    *   PostgreSQL para datos.
    *   Supabase Auth para autenticación de administradores y usuarios.
    *   Supabase Storage para imágenes de perfil.
    *   Row Level Security (RLS) para seguridad de datos.
*   **Estilos**: [Tailwind CSS v4](https://tailwindcss.com/) + `tailwind-merge` + `clsx`.
*   **Componentes UI**:
    *   [Radix UI](https://www.radix-ui.com/) (Primitivos accesibles).
    *   [Lucide React](https://lucide.dev/) (Iconografía).
*   **Animaciones**: [Framer Motion](https://www.framer.com/motion/).
*   **Mapas**: Leaflet + React Leaflet (OpenStreetMap).
*   **Gráficos**: Recharts.
*   **Gestión de Estado/Data**: TanStack Query (React Query).
*   **Scanner QR**: `@yudiel/react-qr-scanner` / `html5-qrcode`.

---

## 3. Funcionalidades Detalladas

### A. Gestión de Miembros
*   **Alta Segura**: API dedicada (`/api/members/create`) que sincroniza automáticamente el usuario de Supabase Auth con el perfil de base de datos.
*   **Perfiles**: Carga de avatar, datos de contacto, contacto de emergencia.
*   **Membresías**: Tipos de plan (Mensual, Trimestral, Semestral, Anual). Cálculo automático de vencimientos.

### B. Control de Acceso
*   **QR Scanner**: El admin puede escanear el QR personal de un alumno.
*   **Validación Lógica**: El sistema verifica si la fecha actual es menor a `next_payment_due`.
    *   ✅ **Acceso Permitido**: Cuota al día.
    *   ❌ **Acceso Denegado**: Cuota vencida o usuario inactivo.
*   **Logs**: Registro histórico de cada intento de acceso.

### C. Dashboard & Métricas
*   KPIs en tiempo real (ingresos, miembros totales).
*   Lista de "Próximos Vencimientos" (para seguimiento de cobranza).
*   Actividad reciente de pagos.

---

## 4. Requisitos de Instalación

Para correr este proyecto localmente o en un servidor, necesitas:

### Prerrequisitos
*   **Node.js**: v18.17.0 o superior (Recomendado v20+).
*   **NPM** o **Bun**.

### Variables de Entorno (.env.local)
Crear un archivo `.env.local` en la raíz de `apps/admin-web/` con las siguientes credenciales de Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-clave-anonima-publica
SUPABASE_SERVICE_ROLE_KEY=tu-clave-service-role-super-secreta
```

> **IMPORTANTE**: La `SUPABASE_SERVICE_ROLE_KEY` es necesaria para la creación de usuarios desde el admin panel (bypassea RLS). Nunca la expongas en el cliente.

### Instalación y Ejecución

1.  **Instalar dependencias**:
    ```bash
    cd apps/admin-web
    npm install
    # o si estás en la raíz del monorepo
    npm install
    ```

2.  **Correr servidor de desarrollo**:
    ```bash
    npm run dev
    ```
    El sitio estará disponible en `http://localhost:3000`.

3.  **Construir para producción**:
    ```bash
    npm run build
    npm start
    ```

---

## 5. Estructura de Base de Datos (Supabase)

Tablas principales requeridas en PostgreSQL:

*   `profiles`: Datos del usuario (vinculado a `auth.users`).
*   `memberships`: Estado de la cuota del usuario.
*   `access_logs`: Historial de entradas.
*   `payments`: Registro de pagos.
*   `classes`: Tipos de clases disponibles.
*   `class_enrollments`: Relación N:N entre usuarios y clases.
*   `academies`: Sedes para el mapa.

*Nota: Asegurarse de tener configurados los Triggers y RLS Policies para permitir la lectura/escritura según el rol.*

---
**Documento generado para Beleza Dojo | Enero 2026**
