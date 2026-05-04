👤 Author Krunal Sawarkar

Email: [krunalsawarkar2004@gmail.com]

# ShopSphere

ShopSphere is a portfolio-grade full-stack e-commerce platform built with a vanilla JavaScript frontend, Tailwind CSS, Node.js, Express, MongoDB, JWT authentication, and Stripe Checkout. It goes beyond a basic store UI and demonstrates real product thinking: customer journeys, admin operations, order lifecycle control, analytics, saved addresses, payment handling, and responsive design.

## Why This Project Stands Out

- Built as a complete commerce system, not just a landing page
- Includes both customer and admin workflows in one codebase
- Uses role-based authentication and protected backend routes
- Supports real order lifecycle management: placed, processing, shipped, delivered, cancelled
- Integrates Stripe Checkout as `Pay Online`
- Includes saved customer addresses, live-ish order sync, and operational analytics
- Designed with a recruiter-friendly code structure: separated frontend and backend, documented APIs, and maintainable modules

## What This Project Demonstrates

- Full-stack web development
- Product-focused feature design
- API design with protected business workflows
- Admin dashboard thinking and operational tooling
- Payment integration and order confirmation logic
- Responsive UI implementation for desktop and mobile
- Real-world portfolio presentation and engineering documentation

## Core Features

### Customer Experience

- Account signup and login
- Browse products by category
- Product details with pricing and related products
- Add to cart and buy now flow
- Checkout with saved address support
- `Pay Online` with Stripe Checkout
- Order history with visible status
- Cancel placed orders
- Favorites / wishlist-style interactions
- Live updates when order status changes in admin

### Admin Experience

- Admin login flow
- Admin dashboard with operational metrics
- Daily, weekly, monthly, and total revenue
- Category mix and low-stock insights
- Product create, update, and delete
- View customer orders with product and customer details
- Change order status
- Cancel orders when needed

### Engineering Features

- MongoDB persistence with Mongoose models
- JWT authentication and role-based access control
- Stripe Checkout session creation and confirmation
- Local fallback store support for safer development workflows
- Shared frontend modules for auth, API access, layout, favorites, and order sync
- Monorepo-style structure with separate frontend and backend folders

## Tech Stack

### Frontend

- HTML5
- Tailwind CSS
- Vanilla JavaScript
- Modular page-based client architecture

### Backend

- Node.js
- Express.js
- MongoDB + Mongoose
- JWT
- bcryptjs
- Stripe

## Architecture Snapshot

```text
frontend/
  public/
    *.html pages
    assets/js/modules
    assets/js/pages
  src/styles/

backend/
  src/
    config/
    controllers/
    data/
    middleware/
    models/
    routes/
    services/
    utils/
```

## Key Screens

- Home
- Shop
- Product Detail
- Cart
- Checkout
- Order Success
- Orders
- Profile
- Admin Dashboard
- Admin Login
- About / Services / Team / Contact

## API Coverage

- Authentication and role-aware session handling
- Product catalog and category discovery
- Customer cart and checkout flow
- Customer order history and cancellation
- Admin analytics and order-management actions
- Admin product-management CRUD operations

Note:

- Internal route details, environment secrets, and deployment-specific values are intentionally not fully documented here for safety
- Production credentials, database connection strings, and secret keys are never committed to this repository

## Local Setup

### 1. Install dependencies

```bash
npm install
npm run install:all
```

### 2. Configure environment

Create:

- `backend/.env`

Example values:

```env
PORT=5001
FRONTEND_ORIGIN=http://localhost:3000
MONGODB_URI=<your-private-mongodb-uri>
MONGODB_DB_NAME=<your-database-name>
JWT_SECRET=<your-private-jwt-secret>
STRIPE_SECRET_KEY=<your-private-stripe-secret>
STRIPE_CURRENCY=<preferred-currency>
ALLOW_LOCAL_FALLBACK=<true-or-false>
FORCE_LOCAL_STORE=<true-or-false>
```

### 3. Seed sample products

```bash
npm run seed
```

### 4. Run the app

```bash
npm start
```

App URLs:

- Frontend runs on a local development port
- Backend API runs on a separate local development port

Use your local environment configuration instead of copying public examples directly.

## Available Scripts

### Root

- `npm start` - start frontend and backend together
- `npm run start:frontend`
- `npm run start:backend`
- `npm run dev`
- `npm run seed`
- `npm run build:css`

### Backend

- `npm start`
- `npm run dev`
- `npm run seed`
- `npm run migrate:mongo`

### Frontend

- `npm start`
- `npm run build`
- `npm run dev`

## Engineering Notes

- Admin users are prevented from using customer purchase flows
- Customer and admin order views stay in sync through frontend order-sync handling and periodic refresh
- Cancelled orders are excluded from active revenue analytics
- Saved addresses are reusable during checkout
- Stripe checkout confirmation is validated server-side
- The project includes a local store fallback path for more resilient development

## Security Note

- No production secrets are stored in this repository
- Environment variables must be supplied locally through `backend/.env`
- Sensitive operational details are intentionally summarized in this README rather than exposed line by line
- If this project is deployed, secrets should be managed through a secure environment or hosting provider secret manager

## Recruiter Keywords

Full Stack Developer, Frontend Developer, Backend Developer, JavaScript Developer, Node.js, Express.js, MongoDB, Mongoose, REST API, Tailwind CSS, HTML, CSS, Vanilla JavaScript, JWT Authentication, Role-Based Access Control, Stripe Integration, E-commerce Platform, Admin Dashboard, Order Management, Product Management, Responsive Design, Mobile Responsive UI, Software Engineering Portfolio, CRUD Operations, API Security, Monorepo, Production-Style Documentation

## Tags

`full-stack` `ecommerce` `nodejs` `express` `mongodb` `mongoose` `javascript` `tailwindcss` `stripe` `jwt` `admin-dashboard` `responsive-design` `portfolio-project` `rest-api` `vanilla-js`

## Hashtags

#FullStackDeveloper #JavaScript #NodeJS #ExpressJS #MongoDB #Mongoose #TailwindCSS #Stripe #Ecommerce #AdminDashboard #PortfolioProject #WebDevelopment #SoftwareEngineer #FrontendDeveloper #BackendDeveloper

## Portfolio Positioning

If you are a recruiter, hiring manager, or interviewer, this project is meant to show more than UI polish. It demonstrates system thinking across product, engineering, and operations:

- customer journey design
- admin tooling
- secure backend workflows
- payment integration
- live order management
- responsive execution
- documentation quality


