import prisma from '../config/database.js';
import { ApiError, successResponse, paginatedResponse, parsePagination, buildPagination } from '../utils/apiResponse.js';
import { logActivity } from '../utils/activityLogger.js';

export const getCategories = async (req, res, next) => {
  try {
    const { page, limit, skip, sortBy, sortOrder } = parsePagination(req.query);
    const { search } = req.query;

    const where = {
      deletedAt: null,
      ...(search && { name: { contains: search, mode: 'insensitive' } }),
    };

    const [categories, total] = await Promise.all([
      prisma.assetCategory.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: { _count: { select: { assets: true } } },
      }),
      prisma.assetCategory.count({ where }),
    ]);

    return paginatedResponse(res, categories, buildPagination(total, page, limit));
  } catch (error) {
    next(error);
  }
};

export const getCategory = async (req, res, next) => {
  try {
    const category = await prisma.assetCategory.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!category) throw new ApiError(404, 'Category not found');
    return successResponse(res, category);
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (req, res, next) => {
  try {
    const { name, description, customFields, warrantyPeriod } = req.body;

    const category = await prisma.assetCategory.create({
      data: { name, description, customFields, warrantyPeriod },
    });

    await logActivity(req.user.id, 'CREATE', 'AssetCategory', category.id, req.body, req.ip);
    return successResponse(res, category, 'Category created', 201);
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    const { name, description, customFields, warrantyPeriod, isActive } = req.body;

    const category = await prisma.assetCategory.update({
      where: { id: req.params.id },
      data: { name, description, customFields, warrantyPeriod, isActive },
    });

    await logActivity(req.user.id, 'UPDATE', 'AssetCategory', category.id, req.body, req.ip);
    return successResponse(res, category, 'Category updated');
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    await prisma.assetCategory.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date(), isActive: false },
    });
    await logActivity(req.user.id, 'DELETE', 'AssetCategory', req.params.id, null, req.ip);
    return successResponse(res, null, 'Category deactivated');
  } catch (error) {
    next(error);
  }
};

export const getAllCategories = async (req, res, next) => {
  try {
    const categories = await prisma.assetCategory.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { name: 'asc' },
    });
    return successResponse(res, categories);
  } catch (error) {
    next(error);
  }
};
