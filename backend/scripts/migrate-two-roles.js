import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateApprovalMatrixSteps() {
  const matrices = await prisma.approvalMatrix.findMany();
  for (const matrix of matrices) {
    const steps = Array.isArray(matrix.steps) ? matrix.steps : [];
    const updated = steps.map((step) => {
      if (step?.role === 'ASSET_MANAGER' || step?.role === 'DEPARTMENT_HEAD') {
        return { ...step, role: 'ADMIN' };
      }
      return step;
    });
    const changed = JSON.stringify(updated) !== JSON.stringify(steps);
    if (changed) {
      await prisma.approvalMatrix.update({
        where: { id: matrix.id },
        data: { steps: updated },
      });
    }
  }
}

async function migrateUserRoles() {
  return prisma.$executeRawUnsafe(`
    UPDATE users
    SET role = 'ADMIN'
    WHERE role::text IN ('ASSET_MANAGER', 'DEPARTMENT_HEAD')
  `);
}

async function shrinkUserRoleEnum() {
  const enumState = await prisma.$queryRawUnsafe(`
    SELECT
      EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'UserRole'
      ) AS has_new,
      EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'UserRole_old'
      ) AS has_old,
      EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'UserRole' AND e.enumlabel = 'ASSET_MANAGER'
      ) AS has_legacy_values
  `);

  const { has_new, has_old, has_legacy_values } = enumState[0];

  if (has_new && !has_old && !has_legacy_values) {
    console.log('UserRole enum already migrated.');
    return;
  }

  if (!has_old && has_legacy_values) {
    await prisma.$executeRawUnsafe(`ALTER TYPE "UserRole" RENAME TO "UserRole_old"`);
    await prisma.$executeRawUnsafe(`CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'EMPLOYEE')`);
  } else if (!has_new) {
    await prisma.$executeRawUnsafe(`CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'EMPLOYEE')`);
  }

  await prisma.$executeRawUnsafe(`ALTER TABLE users ALTER COLUMN role DROP DEFAULT`);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE users
    ALTER COLUMN role TYPE "UserRole"
    USING role::text::"UserRole"
  `);
  await prisma.$executeRawUnsafe(`ALTER TABLE users ALTER COLUMN role SET DEFAULT 'EMPLOYEE'::"UserRole"`);

  await prisma.$executeRawUnsafe(`
    UPDATE daily_ai_summaries
    SET role = 'ADMIN'
    WHERE role::text IN ('ASSET_MANAGER', 'DEPARTMENT_HEAD')
  `).catch(() => {});

  const dailyAiHasRole = await prisma.$queryRawUnsafe(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'daily_ai_summaries' AND column_name = 'role'
    ) AS exists
  `);

  if (dailyAiHasRole[0].exists) {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE daily_ai_summaries
      ALTER COLUMN role TYPE "UserRole"
      USING role::text::"UserRole"
    `).catch(() => {});
  }

  if (has_old || (await prisma.$queryRawUnsafe(`SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole_old') AS exists`))[0].exists) {
    await prisma.$executeRawUnsafe(`DROP TYPE "UserRole_old"`);
  }
}

async function main() {
  console.log('Migrating legacy roles to Admin + Employee only...\n');

  const updatedUsers = await migrateUserRoles();
  console.log(`Updated ${updatedUsers} user(s) to ADMIN.`);

  await migrateApprovalMatrixSteps();
  console.log('Updated approval matrix steps to use ADMIN.');

  await shrinkUserRoleEnum();
  console.log('Shrunk UserRole enum to ADMIN, EMPLOYEE.\n');
  console.log('Migration complete. Run: npm run db:generate && npm run db:seed');
}

main()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
