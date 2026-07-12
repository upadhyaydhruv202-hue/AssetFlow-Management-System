import prisma from '../config/database.js';
import { hashPassword } from '../utils/password.js';
import { generateAssetTag, generateQRCode } from './qrService.js';
import { updateAssetHealth } from './assetHealthService.js';

const parseCSV = (content) => {
  const lines = content.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map((line, index) => {
    const values = line.match(/("([^"]|"")*"|[^,]*)/g)?.map((v) => v.trim().replace(/^"|"$/g, '').replace(/""/g, '"')) || [];
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i] || ''; });
    return { ...row, _row: index + 2 };
  });
  return { headers, rows };
};

export const importEmployees = async (csvContent, createdById) => {
  const { rows } = parseCSV(csvContent);
  const errors = [];
  let successCount = 0;

  for (const row of rows) {
    try {
      if (!row.email || !row.firstName || !row.lastName) {
        errors.push({ row: row._row, message: 'email, firstName, lastName required' });
        continue;
      }
      const existing = await prisma.user.findUnique({ where: { email: row.email } });
      if (existing) {
        errors.push({ row: row._row, message: `Email ${row.email} already exists` });
        continue;
      }
      let departmentId = null;
      if (row.departmentCode) {
        const dept = await prisma.department.findFirst({ where: { code: row.departmentCode } });
        departmentId = dept?.id || null;
      }
      await prisma.user.create({
        data: {
          email: row.email,
          password: await hashPassword(row.password || 'Employee@123'),
          role: 'EMPLOYEE',
          employee: { create: { firstName: row.firstName, lastName: row.lastName, phone: row.phone, departmentId } },
        },
      });
      successCount++;
    } catch (e) {
      errors.push({ row: row._row, message: e.message });
    }
  }

  return { totalRows: rows.length, successCount, errorCount: errors.length, errors };
};

export const importDepartments = async (csvContent) => {
  const { rows } = parseCSV(csvContent);
  const errors = [];
  let successCount = 0;

  for (const row of rows) {
    try {
      if (!row.name || !row.code) {
        errors.push({ row: row._row, message: 'name and code required' });
        continue;
      }
      await prisma.department.create({
        data: { name: row.name, code: row.code, description: row.description || null },
      });
      successCount++;
    } catch (e) {
      errors.push({ row: row._row, message: e.message });
    }
  }

  return { totalRows: rows.length, successCount, errorCount: errors.length, errors };
};

export const importCategories = async (csvContent) => {
  const { rows } = parseCSV(csvContent);
  const errors = [];
  let successCount = 0;

  for (const row of rows) {
    try {
      if (!row.name) {
        errors.push({ row: row._row, message: 'name required' });
        continue;
      }
      await prisma.assetCategory.create({
        data: { name: row.name, description: row.description, warrantyPeriod: row.warrantyPeriod ? parseInt(row.warrantyPeriod) : null },
      });
      successCount++;
    } catch (e) {
      errors.push({ row: row._row, message: e.message });
    }
  }

  return { totalRows: rows.length, successCount, errorCount: errors.length, errors };
};

export const importAssets = async (csvContent) => {
  const { rows } = parseCSV(csvContent);
  const errors = [];
  let successCount = 0;

  for (const row of rows) {
    try {
      if (!row.name || !row.categoryName) {
        errors.push({ row: row._row, message: 'name and categoryName required' });
        continue;
      }
      const category = await prisma.assetCategory.findFirst({ where: { name: row.categoryName } });
      if (!category) {
        errors.push({ row: row._row, message: `Category "${row.categoryName}" not found` });
        continue;
      }
      const assetTag = row.assetTag || await generateAssetTag(prisma);
      const qrCode = await generateQRCode(assetTag);
      const asset = await prisma.asset.create({
        data: {
          assetTag,
          name: row.name,
          serialNumber: row.serialNumber,
          categoryId: category.id,
          condition: row.condition || 'GOOD',
          location: row.location,
          isBookable: row.isBookable === 'true',
          qrCode,
          rfidIdentifier: row.rfidIdentifier || null,
          status: 'AVAILABLE',
        },
      });
      await updateAssetHealth(asset.id);
      successCount++;
    } catch (e) {
      errors.push({ row: row._row, message: e.message });
    }
  }

  return { totalRows: rows.length, successCount, errorCount: errors.length, errors };
};

export const batchReassignAssets = async (fromEmployeeId, toEmployeeId, performedById) => {
  const allocations = await prisma.allocation.findMany({
    where: { employeeId: fromEmployeeId, status: { in: ['ACTIVE', 'OVERDUE'] } },
    include: { asset: true },
  });

  const results = [];
  for (const alloc of allocations) {
    await prisma.allocation.update({
      where: { id: alloc.id },
      data: { status: 'RETURNED', actualReturnDate: new Date(), returnNotes: 'Batch reassignment' },
    });
    const newAlloc = await prisma.allocation.create({
      data: {
        assetId: alloc.assetId,
        employeeId: toEmployeeId,
        allocatedById: performedById,
        status: 'ACTIVE',
        expectedReturnDate: alloc.expectedReturnDate,
      },
    });
    results.push({ assetId: alloc.assetId, assetTag: alloc.asset.assetTag, newAllocationId: newAlloc.id });
  }
  return results;
};

export const runImportJob = async (entityType, csvContent, createdById) => {
  const handlers = {
    EMPLOYEES: importEmployees,
    DEPARTMENTS: importDepartments,
    CATEGORIES: importCategories,
    ASSETS: importAssets,
  };

  const job = await prisma.importJob.create({
    data: { entityType, fileName: `${entityType.toLowerCase()}_import.csv`, status: 'PROCESSING', createdById },
  });

  try {
    const result = await handlers[entityType](csvContent, createdById);
    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: 'COMPLETED',
        totalRows: result.totalRows,
        successCount: result.successCount,
        errorCount: result.errorCount,
        errors: result.errors,
        completedAt: new Date(),
      },
    });
    return { jobId: job.id, ...result };
  } catch (e) {
    await prisma.importJob.update({
      where: { id: job.id },
      data: { status: 'FAILED', errors: [{ message: e.message }], completedAt: new Date() },
    });
    throw e;
  }
};
