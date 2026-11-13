CREATE TABLE bookings (
 id TEXT PRIMARY KEY NOT NULL,
 service TEXT NOT NULL,
 date TEXT NOT NULL,
 time TEXT NOT NULL,
 duration INTEGER NOT NULL,
 name TEXT NOT NULL,
 phone TEXT NOT NULL,
 hair_length TEXT NOT NULL,
 created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE occupied_slots (
 date TEXT NOT NULL,
 hour INTEGER NOT NULL,
 booking_id TEXT NOT NULL REFERENCES bookings(id),
 PRIMARY KEY(date, hour)
);
--> statement-breakpoint
CREATE TABLE admin_credentials (
 id INTEGER PRIMARY KEY NOT NULL CHECK(id=1),
 password_hash TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE admin_sessions (
 token_hash TEXT PRIMARY KEY NOT NULL,
 expires_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE rate_limits (
 key TEXT PRIMARY KEY NOT NULL,
 count INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX bookings_date_idx ON bookings(date, time);
