import prisma from '../config/database.js';
import { ApiError, successResponse, paginatedResponse, parsePagination, buildPagination } from '../utils/apiResponse.js';
import { logActivity } from '../utils/activityLogger.js';
import { createNotification } from '../services/notificationService.js';

export const getEmployees = async (req, res, next) => {
  try {
    const { page, limit, skip, sortBy, sortOrder } = parsePagination(req.query);
    const { search, departmentId, role, status } = req.query;

    const where = {
      deletedAt: null,
      ...(departmentId && { departmentId }),
      ...(status && { status }),
      ...(role && { user: { role } }),
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { user: { email: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          user: { select: { id: true, email: true, role: true, status: true } },
          department: { select: { id: true, name: true, code: true } },
        },
      }),
      prisma.employee.count({ where }),
    ]);

    return paginatedResponse(res, employees, buildPagination(total, page, limit));
  } catch (error) {
    next(error);
  }
};

export const getEmployee = async (req, res, next) => {
  try {
    const employee = await prisma.employee.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: {
        user: { select: { id: true, email: true, role: true, status: true } },
        department: true,
      },
    });
    if (!employee) throw new ApiError(404, 'Employee not found');
    return successResponse(res, employee);
  } catch (error) {
    next(error);
  }
};

export const updateEmployee = async (req, res, next) => {
  try {
    const { firstName, lastName, phone, departmentId, status } = req.body;

    const employee = await prisma.employee.update({
      where: { id: req.params.id },
      data: { firstName, lastName, phone, departmentId, status },
      include: {
        user: { select: { id: true, email: true, role: true, status: true } },
        department: true,
      },
    });

    if (status) {
      await prisma.user.update({
        where: { id: employee.userId },
        data: { status },
      });
    }

    await logActivity(req.user.id, 'UPDATE', 'Employee', employee.id, req.body, req.ip);
    return successResponse(res, employee, 'Employee updated');
  } catch (error) {
    next(error);
  }
};

export const updateEmployeeRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    const allowedRoles = ['EMPLOYEE', 'ADMIN'];

    if (!allowedRoles.includes(role)) {
      throw new ApiError(400, 'Invalid role. Only Admin and Employee are supported.');
    }

    const employee = await prisma.employee.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });

    if (!employee) throw new ApiError(404, 'Employee not found');

    await prisma.user.update({
      where: { id: employee.userId },
      data: { role },
    });

    await createNotification(
      employee.userId,
      'GENERAL',
      'Role Updated',
      `Your role has been updated to ${role.replace('_', ' ')}`,
      '/profile'
    );

    await logActivity(req.user.id, 'UPDATE_ROLE', 'Employee', employee.id, { role }, req.ip);

    const updated = await prisma.employee.findUnique({
      where: { id: employee.id },
      include: {
        user: { select: { id: true, email: true, role: true, status: true } },
        department: true,
      },
    });

    return successResponse(res, updated, 'Employee role updated');
  } catch (error) {
    next(error);
  }
};

export const getAllEmployees = async (req, res, next) => {
  try {
    const employees = await prisma.employee.findMany({
      where: { deletedAt: null, status: 'ACTIVE' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        departmentId: true,
        department: { select: { name: true } },
      },
      orderBy: { firstName: 'asc' },
    });
    return successResponse(res, employees);
  } catch (error) {
    next(error);
  }
};
