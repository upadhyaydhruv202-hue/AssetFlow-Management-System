import prisma from '../config/database.js';
import { ApiError, successResponse, paginatedResponse, parsePagination, buildPagination } from '../utils/apiResponse.js';
import { logActivity } from '../utils/activityLogger.js';

export const getDepartments = async (req, res, next) => {
  try {
    const { page, limit, skip, sortBy, sortOrder } = parsePagination(req.query);
    const { search, status } = req.query;

    const where = {
      deletedAt: null,
      ...(status && { status }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [departments, total] = await Promise.all([
      prisma.department.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          departmentHead: { select: { id: true, firstName: true, lastName: true } },
          parent: { select: { id: true, name: true } },
          _count: { select: { employees: true } },
        },
      }),
      prisma.department.count({ where }),
    ]);

    return paginatedResponse(res, departments, buildPagination(total, page, limit));
  } catch (error) {
    next(error);
  }
};

export const getDepartment = async (req, res, next) => {
  try {
    const department = await prisma.department.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: {
        departmentHead: true,
        parent: true,
        children: true,
        employees: { include: { user: { select: { email: true, role: true } } } },
      },
    });
    if (!department) throw new ApiError(404, 'Department not found');
    return successResponse(res, department);
  } catch (error) {
    next(error);
  }
};

export const createDepartment = async (req, res, next) => {
  try {
    const { name, code, description, parentId, departmentHeadId, status } = req.body;

    const department = await prisma.department.create({
      data: { name, code, description, parentId, departmentHeadId, status },
      include: { departmentHead: true, parent: true },
    });

    await logActivity(req.user.id, 'CREATE', 'Department', department.id, req.body, req.ip);
    return successResponse(res, department, 'Department created', 201);
  } catch (error) {
    next(error);
  }
};

export const updateDepartment = async (req, res, next) => {
  try {
    const { name, code, description, parentId, departmentHeadId, status } = req.body;

    const department = await prisma.department.update({
      where: { id: req.params.id },
      data: { name, code, description, parentId, departmentHeadId, status },
      include: { departmentHead: true, parent: true },
    });

    await logActivity(req.user.id, 'UPDATE', 'Department', department.id, req.body, req.ip);
    return successResponse(res, department, 'Department updated');
  } catch (error) {
    next(error);
  }
};

export const deleteDepartment = async (req, res, next) => {
  try {
    await prisma.department.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date(), status: 'INACTIVE' },
    });
    await logActivity(req.user.id, 'DELETE', 'Department', req.params.id, null, req.ip);
    return successResponse(res, null, 'Department deactivated');
  } catch (error) {
    next(error);
  }
};

export const getAllDepartments = async (req, res, next) => {
  try {
    const departments = await prisma.department.findMany({
      where: { deletedAt: null, status: 'ACTIVE' },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });
    return successResponse(res, departments);
  } catch (error) {
    next(error);
  }
};
