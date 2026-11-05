CREATE TABLE `vessels` (
	`mmsi` integer PRIMARY KEY NOT NULL,
	`imo` integer,
	`call_sign` text,
	`name` text,
	`ship_type` integer,
	`length` integer,
	`beam` integer,
	`draught` real,
	`destination` text,
	`eta` integer,
	`first_seen` integer NOT NULL,
	`last_seen` integer NOT NULL,
	`updated_at` integer NOT NULL
);

CREATE INDEX `vessels_imo_idx` ON `vessels` (`imo`);

CREATE INDEX `vessels_name_idx` ON `vessels` (`name`);