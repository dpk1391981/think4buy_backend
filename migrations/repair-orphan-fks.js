/**
 * Repair every orphan foreign-key row that blocks TypeORM `synchronize`.
 * ---------------------------------------------------------------------------
 * Symptom: the backend never finishes booting —
 *
 *   ERROR [TypeOrmModule] Unable to connect to the database. Retrying (N)...
 *   QueryFailedError: Cannot add or update a child row: a foreign key
 *   constraint fails (..., CONSTRAINT FK_xxx FOREIGN KEY (col) REFERENCES ...)
 *
 * Cause: `synchronize` is on whenever NODE_ENV !== 'production' (app.module.ts).
 * It tries to add the FKs the entities declare, and MySQL refuses any FK whose
 * table already holds rows pointing at a parent row that no longer exists.
 * Those parents were hard-deleted while the table had no FK, so nothing
 * cascaded. Each boot fails on the FIRST such table, so fixing them one at a
 * time costs one restart per table — this repairs all of them in one pass.
 *
 * The repair per relation is taken from the entity's own `onDelete`, so it does
 * what the schema always intended:
 *
 *   CASCADE   → delete the orphan rows (they could not have survived the parent)
 *   SET NULL  → null the column, keeping the row (e.g. payment_transactions:
 *               a deleted user must not take the payment record with them)
 *   otherwise → null it if the column is nullable, else report and skip, since
 *               deleting is not obviously correct and needs a human decision
 *
 * Usage — dry run first, it writes nothing and just reports:
 *
 *   node migrations/repair-orphan-fks.js
 *   node migrations/repair-orphan-fks.js --apply
 *
 * Safe to re-run: a second pass finds nothing.
 */

require('reflect-metadata');
const path = require('path');
const { DataSource } = require('typeorm');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const APPLY = process.argv.includes('--apply');

// synchronize stays OFF here — connecting is the thing that currently fails,
// and this script has to get in before that runs to clean up after it.
const ds = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'realestate_db',
  entities: [path.join(__dirname, '..', 'dist', '**', '*.entity.js')],
  synchronize: false,
  logging: false,
  charset: 'utf8mb4',
});

const q = (id) => `\`${id.replace(/`/g, '')}\``;

(async () => {
  await ds.initialize();
  console.log(
    `Connected to ${process.env.DB_NAME || 'realestate_db'} — ` +
      `${ds.entityMetadatas.length} entities loaded`,
  );
  console.log(APPLY ? 'MODE: APPLY (writes)\n' : 'MODE: dry run (no writes)\n');

  // Every owning side of a many-to-one / one-to-one carries the join column,
  // which is the column a FK gets created on.
  const relations = [];
  for (const meta of ds.entityMetadatas) {
    for (const rel of meta.relations) {
      if (!rel.isManyToOne && !rel.isOneToOneOwner) continue;
      for (const jc of rel.joinColumns) {
        if (!jc.referencedColumn) continue;
        relations.push({
          childTable: meta.tableName,
          childCol: jc.databaseName,
          parentTable: rel.inverseEntityMetadata.tableName,
          parentCol: jc.referencedColumn.databaseName,
          onDelete: (rel.onDelete || '').toUpperCase(),
          nullable: jc.isNullable,
          label: `${meta.tableName}.${jc.databaseName} -> ${rel.inverseEntityMetadata.tableName}.${jc.referencedColumn.databaseName}`,
        });
      }
    }
  }

  const existingTables = new Set(
    (
      await ds.query(
        'SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()',
      )
    ).map((r) => r.t),
  );

  let totalOrphans = 0;
  const repaired = [];
  const skipped = [];

  for (const r of relations) {
    // A table the entity declares but that has never been created yet has no
    // rows to be wrong, and synchronize will build it clean.
    if (!existingTables.has(r.childTable) || !existingTables.has(r.parentTable)) continue;

    let rows;
    try {
      rows = await ds.query(
        `SELECT COUNT(*) AS n FROM ${q(r.childTable)} c
           LEFT JOIN ${q(r.parentTable)} p ON p.${q(r.parentCol)} = c.${q(r.childCol)}
          WHERE c.${q(r.childCol)} IS NOT NULL AND p.${q(r.parentCol)} IS NULL`,
      );
    } catch (err) {
      // A column the entity declares but the table lacks yet — synchronize will
      // add it empty, so there is nothing to repair.
      skipped.push({ ...r, reason: `could not check: ${err.message}` });
      continue;
    }

    const n = Number(rows[0].n);
    if (!n) continue;

    totalOrphans += n;

    // CASCADE means the row was only ever meant to live as long as its parent.
    // Anything else keeps the row and drops the dangling pointer, which is the
    // conservative choice — never delete a record the schema did not say to.
    const useDelete = r.onDelete === 'CASCADE';
    const canNull = r.onDelete === 'SET NULL' || r.nullable;

    if (!useDelete && !canNull) {
      console.log(
        `  SKIP  ${r.label}\n        ${n} orphan row(s), onDelete=${r.onDelete || 'default'}, NOT NULL` +
          `\n        Needs a human decision: cannot null it and deleting is not implied.`,
      );
      skipped.push({ ...r, count: n, reason: 'NOT NULL and no CASCADE' });
      continue;
    }

    const action = useDelete ? 'DELETE' : 'SET NULL';
    console.log(`  ${action.padEnd(8)} ${r.label} — ${n} orphan row(s) [onDelete=${r.onDelete || 'default'}]`);

    if (APPLY) {
      const sql = useDelete
        ? `DELETE c FROM ${q(r.childTable)} c
             LEFT JOIN ${q(r.parentTable)} p ON p.${q(r.parentCol)} = c.${q(r.childCol)}
            WHERE c.${q(r.childCol)} IS NOT NULL AND p.${q(r.parentCol)} IS NULL`
        : `UPDATE ${q(r.childTable)} c
             LEFT JOIN ${q(r.parentTable)} p ON p.${q(r.parentCol)} = c.${q(r.childCol)}
              SET c.${q(r.childCol)} = NULL
            WHERE c.${q(r.childCol)} IS NOT NULL AND p.${q(r.parentCol)} IS NULL`;
      await ds.query(sql);
    }
    repaired.push({ ...r, count: n, action });
  }

  console.log('\n──────────────────────────────────────────────');
  if (!totalOrphans) {
    console.log('No orphan rows found. Nothing blocks the FKs.');
  } else {
    console.log(`${totalOrphans} orphan row(s) across ${repaired.length + skipped.filter((s) => s.count).length} relation(s)`);
    if (APPLY) {
      console.log(`Repaired ${repaired.length} relation(s).`);
    } else {
      console.log('Dry run — nothing was written. Re-run with --apply to repair.');
    }
    const blocking = skipped.filter((s) => s.count);
    if (blocking.length) {
      console.log(`\n${blocking.length} relation(s) still need a manual decision:`);
      for (const s of blocking) console.log(`  - ${s.label} (${s.count} rows): ${s.reason}`);
    }
  }

  await ds.destroy();
})().catch((err) => {
  console.error('\nFailed:', err.message);
  process.exit(1);
});
