import { getDashboardStats, updateOverdueAllocations, updateBookingStatuses } from '../services/dashboardService.js';
import { successResponse } from '../utils/apiResponse.js';

export const getDashboard = async (req, res, next) => {
  try {
    await updateOverdueAllocations();
    await updateBookingStatuses();
    const stats = await getDashboardStats(req.user);
    return successResponse(res, stats);
  } catch (error) {
    next(error);
  }
};
