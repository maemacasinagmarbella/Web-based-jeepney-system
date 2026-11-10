## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.

# Public Transport & Vehicle Rental System

A modern full-stack web application designed for booking rentals, tracking driver locations in real-time, and managing passenger/driver profiles. Built with **React**, **Vite**, and **Supabase**.

---

## 👥 Project Team

- **Mae Marbella**
- **Jenny Rose Macasinag**
- **Mary Ann Armario**

---

## 🚀 Key Features

- **Authentication & Role-Based Profiles:** Automatic profile creation on signup for Passengers, Drivers, and Admins via database triggers.
- **Real-Time GPS Location Tracking:** Realtime driver updates powered by Supabase replication.
- **Rental Request Management:** Lifecycle tracking for rental bookings from `pending` to `accepted`, `completed`, or `cancelled`.
- **Row-Level Security (RLS):** Database policies ensuring strict access control between users, drivers, passengers, and administrators.

---

## 🛠️ Tech Stack

- **Frontend:** React, Vite, JavaScript (ES6+), CSS3
- **Backend & Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth (Email/Password)
- **Realtime:** Supabase Realtime Channels

---

## 🏁 Getting Started

### Prerequisites

Make sure you have Node.js (version 18 or higher) installed on your system.

### 1. Installation

Clone the repository and install the project dependencies:

```bash
# Clone the repository
git clone <your-repository-url>

# Navigate into the project directory
cd <project-folder-name>

# Install dependencies
npm install
```
