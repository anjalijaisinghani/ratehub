# RateHub — Store Rating Platform

A full-stack web application where users rate registered stores from 1 to 5.
One login serves three roles: **System Administrator**, **Normal User** and **Store Owner**.

> Built for the FullStack Intern Coding Challenge.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite), React Router, Axios, SweetAlert2 |
| Backend | Node.js, Express.js |
| Database | MySQL / MariaDB |
| Auth | JWT + bcryptjs password hashing |
| Validation | express-validator (backend) + matching checks (frontend) |

## Features

**Everyone**
- Landing page with Login / Sign Up
- Single login for all roles, role-based redirect
- Update password after login
- Logout, dark / light theme

**System Administrator**
- Dashboard: total users, total stores, total ratings
- Add users (normal, admin, store owner) and add stores
- Users list (Name, Email, Address, Role) and stores list (Name, Email, Address, Rating)
- Filters on Name, Email, Address, Role; sorting on every table
- User details (store owners also show their rating)

**Normal User**
- Sign up, log in
- View all stores, search by name and address
- See overall rating and own rating; submit and modify a rating (1 to 5)

**Store Owner**
- Dashboard with the store's average rating
- List of users who rated the store (sortable)

## Validation Rules

| Field | Rule |
|---|---|
| Name | 20 to 60 characters |
| Address | Max 400 characters |
| Password | 8 to 16 characters, at least 1 uppercase and 1 special character |
| Email | Standard email format |
| Rating | Whole number 1 to 5 |

## Project Structure

```
fullstack-store-rating/
├── backend/
│   ├── src/
│   │   ├── config/db.js
│   │   ├── controllers/      (auth, admin, store, owner)
│   │   ├── middleware/auth.js (JWT + role checks)
│   │   ├── routes/
│   │   ├── utils/validators.js
│   │   └── server.js
│   ├── schema.sql
│   ├── seed.js
│   └── .env.example
└── frontend/
    ├── public/               (logos)
    └── src/
        ├── api/              (axios, auth context)
        ├── components/
        ├── pages/
        ├── utils/
        └── App.jsx
```

## Setup

### Prerequisites
Node.js 18+, MySQL or MariaDB (XAMPP works), Git.

### 1. Clone
```
git clone https://github.com/anjalijaisinghani/ratehub.git
cd ratehub
```

### 2. Database
Start MySQL, then import the schema (from the `backend` folder):
```
mysql -u root -p < schema.sql
```
(or open `backend/schema.sql` in MySQL Workbench and run it).

### 3. Backend
```
cd backend
npm install
```
Copy `.env.example` to `.env` and set your MySQL password and a JWT secret. Then create the default admin and start the server:
```
npm run seed
npm run dev
```
API runs at `http://localhost:5000`.

### 4. Frontend
In a second terminal:
```
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173`.

## Default Admin Login

| Email | Password |
|---|---|
| admin@example.com | Admin@123 |

Store Owners and extra users are created by the admin (Add User). Normal users can sign up themselves.

## API Documentation

All protected routes need the header `Authorization: Bearer <token>`.

### Auth
| Method | URL | Access | Body |
|---|---|---|---|
| POST | `/api/auth/signup` | Public | name, email, address, password |
| POST | `/api/auth/login` | Public | email, password |
| PUT | `/api/auth/change-password` | Any logged-in user | currentPassword, newPassword |

### Admin (role ADMIN)
| Method | URL | Purpose |
|---|---|---|
| GET | `/api/admin/dashboard` | Totals of users, stores, ratings |
| POST | `/api/admin/users` | Add user (name, email, address, password, role) |
| POST | `/api/admin/stores` | Add store (name, email, address, ownerId) |
| GET | `/api/admin/users` | List users. Query: name, email, address, role, sortBy, order |
| GET | `/api/admin/users/:id` | User details (rating included for owners) |
| GET | `/api/admin/stores` | List stores. Query: name, email, address, sortBy, order |

### Normal User (role USER)
| Method | URL | Purpose |
|---|---|---|
| GET | `/api/stores` | Stores with overall and own rating. Query: name, address, sortBy, order |
| POST | `/api/stores/:storeId/rating` | Submit or modify rating. Body: `{ "rating": 1-5 }` |

### Store Owner (role OWNER)
| Method | URL | Purpose |
|---|---|---|
| GET | `/api/owner/dashboard` | Store average rating and list of raters. Query: sortBy, order |

## Database Design

- **users** (id, name, email UNIQUE, password_hash, address, role ENUM ADMIN/USER/OWNER)
- **stores** (id, name, email, address, owner_id → users.id)
- **ratings** (id, user_id → users.id, store_id → stores.id, rating CHECK 1..5, UNIQUE(user_id, store_id))

Average ratings are calculated with `AVG()` on demand, so they are never stale.

## Security Notes
- Passwords are hashed with bcrypt, never stored or returned in plain text
- JWT checked on every protected route, with role-based authorization
- All SQL uses parameterized queries; sort columns are whitelisted
- Owners can only see their own store's data (id comes from the token)
- Validation is enforced on both frontend and backend

## Screenshots

### Landing Page
![Landing Page](screenshots/01-landing.png)

### Login
![Login](screenshots/02-login.png)

### Signup
![Signup](screenshots/03-signup.png)

### Admin Dashboard
![Admin Dashboard](screenshots/04-admin-dashboard.png)

### Admin Users
![Admin Users](screenshots/05-admin-users.png)

### Admin Stores
![Admin Stores](screenshots/06-admin-stores.png)

### Add User
![Add User](screenshots/07-add-user.png)

### Add Store
![Add Store](screenshots/08-add-store.png)

### User Stores & Rating
![User Stores](screenshots/09-user-stores.png)

### Owner Dashboard
![Owner Dashboard](screenshots/10-owner-dashboard.png)

### Change Password
![Change Password](screenshots/11-change-password.png)

### Dark Mode
![Dark Mode](screenshots/12-dark-mode.png)

## Future Improvements
Pagination, refresh tokens, email verification, store images and reviews with comments, automated tests.
