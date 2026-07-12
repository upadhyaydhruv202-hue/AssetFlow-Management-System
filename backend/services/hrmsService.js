import prisma from '../config/database.js';

export const syncEmployees = async (externalEmployees = []) => {
  const results = { synced: 0, created: 0, updated: 0, errors: [] };
  for (const ext of externalEmployees) {
    try {
      const existing = await prisma.user.findUnique({ where: { email: ext.email } });
      if (existing?.employee) {
        await prisma.employee.update({
          where: { id: existing.employee.id },
          data: { firstName: ext.firstName, lastName: ext.lastName, phone: ext.phone },
        });
        results.updated++;
      } else {
        results.errors.push({ email: ext.email, message: 'User not found - create via signup first' });
      }
      results.synced++;
    } catch (e) {
      results.errors.push({ email: ext.email, message: e.message });
    }
  }
  return results;
};

export const syncDepartments = async (externalDepartments = []) => {
  const results = { synced: 0, created: 0, updated: 0, errors: [] };
  for (const ext of externalDepartments) {
    try {
      const existing = await prisma.department.findFirst({ where: { code: ext.code } });
      if (existing) {
        await prisma.department.update({
          where: { id: existing.id },
          data: { name: ext.name, description: ext.description },
        });
        results.updated++;
      } else {
        await prisma.department.create({ data: { name: ext.name, code: ext.code, description: ext.description } });
        results.created++;
      }
      results.synced++;
    } catch (e) {
      results.errors.push({ code: ext.code, message: e.message });
    }
  }
  return results;
};

export const syncRoles = async (roleMappings = []) => {
  const results = { synced: 0, updated: 0, errors: [] };
  for (const mapping of roleMappings) {
    try {
      const user = await prisma.user.findUnique({ where: { email: mapping.email } });
      if (!user) {
        results.errors.push({ email: mapping.email, message: 'User not found' });
        continue;
      }
      await prisma.user.update({ where: { id: user.id }, data: { role: mapping.role } });
      results.updated++;
      results.synced++;
    } catch (e) {
      results.errors.push({ email: mapping.email, message: e.message });
    }
  }
  return results;
};

export const getHrmsStatus = () => ({
  status: 'ready',
  endpoints: {
    employeeSync: 'POST /api/enterprise/hrms/employees/sync',
    departmentSync: 'POST /api/enterprise/hrms/departments/sync',
    roleSync: 'POST /api/enterprise/hrms/roles/sync',
  },
  message: 'HRMS integration endpoints ready for external system connection',
});
