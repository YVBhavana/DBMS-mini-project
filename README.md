# WarrantIQ – Digital Warranty & Product Service Management

A Next.js application for managing registered products, warranties, service requests, and role-based access. PostgreSQL stores relational business records; MongoDB stores flexible service activity notes.

## Technology stack

- **Frontend:** Next.js App Router, React, Tailwind CSS
- **Backend:** Next.js Route Handlers (`app/api/**/route.ts`)
- **Relational database:** PostgreSQL (`pg` connection pool)
- **NoSQL database:** MongoDB (`mongodb` driver)
- **Authentication:** bcrypt password verification, signed JWT in an HTTP-only cookie
- **Roles:** `admin`, `technician`, `customer`

## Data flow to explain in review

1. A user interacts with a Next.js page (for example, the Admin Dashboard).
2. The page calls a route handler with `fetch()`.
3. The route handler validates the `warranty_session` JWT using `getSession()` and checks the user's role.
4. Relational operations use parameterized PostgreSQL queries through `lib/db.ts` and `pool.query()`.
5. Activity-note operations use the MongoDB driver through `lib/mongodb.ts` and the `service_activity` collection.
6. The API returns JSON; React updates the visible page. Refreshing the relevant list reads the persisted database records again.

### PostgreSQL examples in the current application

- `GET /api/admin`: reads user accounts from `app_users` (admin only).
- `GET /api/products`: joins `purchase_items`, `products`, and `warranties`.
- `GET /api/services`: joins service, product, purchase, customer, and technician data.
- `PATCH /api/services`: updates `service_records.service_status`, diagnosis, and resolution (admin only).
- `GET/PATCH /api/technician`: reads assigned service requests and updates only requests assigned to the signed-in technician.
- `POST /api/auth/login`: verifies the password hash in `app_users` and issues the JWT cookie.

### MongoDB CRUD demonstration

The Admin Dashboard contains **MongoDB · Service Activity Notes**:

- **Create:** add a note against an existing service request (`POST /api/service-notes`).
- **Read:** load notes from the `service_activity` collection (`GET /api/service-notes`).
- **Update:** edit a note (`PATCH /api/service-notes`).
- **Delete:** remove a note (`DELETE /api/service-notes?id=...`).

Each document stores `serviceId`, `note`, `createdBy`, `authorRole`, `createdAt`, and `updatedAt`. The route creates an index on `{ serviceId: 1, createdAt: -1 }`. Admins can manage all notes. Technicians can access notes for their assigned services and edit/delete only notes they created. Customers cannot access this collection.

MongoDB is used here as a document database. **This implementation does not claim to provide vector search or embeddings.** If the instructor explicitly requires a vector database, configure MongoDB Atlas Vector Search (embedding model + vector index + similarity-search endpoint) as a separate feature.

## Setup

1. Install Node.js 20+ and PostgreSQL. Create the PostgreSQL database and apply the project's original relational schema/seed data (the uploaded source archive does not contain that base schema SQL file).
2. Create a MongoDB database (local MongoDB or MongoDB Atlas).
3. Copy `.env.example` to `.env.local` and fill in `DATABASE_URL`, `MONGODB_URI`, `MONGODB_DB`, and a strong `JWT_SECRET`.
4. Install and run:

```bash
npm install
npm run dev
```

5. Open `http://localhost:3000`. Sign in using an existing account from `app_users`.
6. Visit `/admin` with an admin account. The Admin Dashboard shows PostgreSQL records and the MongoDB activity-note CRUD panel.
7. Check `/api/health` to verify PostgreSQL and MongoDB connectivity.

## SQL advanced-features script

After applying the existing base PostgreSQL schema, run `database/advanced_features.sql` in pgAdmin or `psql`. It adds:

- `service_status_audit` with primary key, foreign key, self-referencing foreign key, check constraints, and index.
- An `AFTER UPDATE OF service_status` trigger that records status changes.
- `update_service_status(...)` stored procedure.
- `get_service_status(...)` SQL function.
- JOIN, nested `EXISTS`, correlated-subquery, aggregate CTE, and recursive-CTE examples.

The script relies on the existing `service_records`, `purchase_items`, `products`, `purchases`, `customers`, `app_users`, and `warranties` tables and their columns as referenced by the application. Test it against your actual base schema before the review. The recursive query's sample service ID (`1`) can be changed to an existing service ID.

## Review demonstration sequence

1. Sign in as admin and show users, products, and service requests loaded from PostgreSQL.
2. Change a service status in the admin UI. Show the `UPDATE service_records` query in `app/api/services/route.ts` and verify the row in PostgreSQL.
3. Run `SELECT * FROM service_status_audit WHERE service_id = <id> ORDER BY audit_id;` to show the trigger-generated audit history (after running the SQL script).
4. Add a service activity note in the MongoDB panel. Show the POST route and the inserted document in `warrantiq.service_activity`.
5. Edit and delete that note in the UI, then refresh MongoDB Compass to show the update/delete persisted.
6. Sign in as a technician and show that the technician API limits service records to that technician's assignments.
7. Open `database/advanced_features.sql` to explain the procedure, function, trigger, joins, nested query, correlated query, CTE, and recursive CTE.

## Important scope note

The uploaded repository contained the Next.js application and database connection modules, but did not contain the original PostgreSQL DDL/seed script. This update therefore adds an advanced-feature script based on the table/column relationships already used by the API code; it does not invent a replacement base schema.
