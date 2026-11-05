import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** Slow-changing vessel identity and voyage data. Positions live in the R2 tiles. */
export const vessels = sqliteTable(
  'vessels',
  {
    mmsi: integer('mmsi').primaryKey(),
    imo: integer('imo'),
    callSign: text('call_sign'),
    name: text('name'),
    shipType: integer('ship_type'),
    length: integer('length'),
    beam: integer('beam'),
    draught: real('draught'),
    destination: text('destination'),
    /** Epoch seconds. */
    eta: integer('eta'),
    firstSeen: integer('first_seen').notNull(),
    lastSeen: integer('last_seen').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [index('vessels_imo_idx').on(table.imo), index('vessels_name_idx').on(table.name)],
);

export type VesselRow = typeof vessels.$inferSelect;
export type NewVesselRow = typeof vessels.$inferInsert;
