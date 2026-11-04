# Relational relationship map (derived from the application's SQL joins)

The uploaded source archive did not include the original base-schema DDL. The relationships below are the ones directly exercised by the API queries; verify exact PK/FK names and data types against the PostgreSQL database before presenting them as the full physical schema.

| Parent table | Child table | Join used by application | Relationship meaning |
|---|---|---|---|
| `app_users` | `customers` | `customers.user_id = app_users.user_id` | A customer profile belongs to an application user. |
| `app_users` | `technicians` | `technicians.user_id = app_users.user_id` | A technician profile belongs to an application user. |
| `customers` | `purchases` | `purchases.customer_id = customers.customer_id` | A customer can have purchases. |
| `purchases` | `purchase_items` | `purchase_items.purchase_id = purchases.purchase_id` | A purchase contains purchase items. |
| `products` | `purchase_items` | `purchase_items.product_id = products.product_id` | A product can appear in many purchase items. |
| `purchase_items` | `warranties` | `warranties.purchase_item_id = purchase_items.purchase_item_id` | A purchased item can have a warranty record. |
| `purchase_items` | `service_records` | `service_records.purchase_item_id = purchase_items.purchase_item_id` | A purchased item can have service requests. |
| `technicians` | `service_records` | `service_records.technician_id = technicians.technician_id` | A technician may be assigned service requests. |

## Constraints to identify in the base schema

For the review, open the actual PostgreSQL schema in pgAdmin and point out:

- **Primary keys:** the `*_id` identifiers used on each table.
- **Foreign keys:** the joins in the table above should be backed by FK constraints.
- **NOT NULL:** identifiers, required names/emails, and required relationship columns.
- **UNIQUE:** user email and product serial number are natural candidates; confirm they are actually declared UNIQUE in the live schema.
- **CHECK:** role and service-status domain restrictions, if declared in the base schema.

The additional `service_status_audit` table created by `advanced_features.sql` has explicit primary-key, foreign-key, self-referencing foreign-key, and check constraints. Do not claim an inferred constraint exists in the original database until you verify it in pgAdmin's Constraints panel or PostgreSQL catalog.
