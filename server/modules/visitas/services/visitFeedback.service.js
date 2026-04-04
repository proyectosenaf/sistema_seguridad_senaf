import VisitFeedback from "../models/VisitFeedback.js";

function toObjectId(mongoose, value) {
  try {
    return new mongoose.Types.ObjectId(value);
  } catch {
    return null;
  }
}

export async function getFeedbackMetrics({
  mongoose,
  from,
  to,
  hostName,
  areaName,
} = {}) {
  const match = {};

  if (from || to) {
    match.answeredAt = {};
    if (from) match.answeredAt.$gte = new Date(`${from}T00:00:00.000Z`);
    if (to) match.answeredAt.$lte = new Date(`${to}T23:59:59.999Z`);
  }

  if (hostName) {
    match.hostName = { $regex: hostName, $options: "i" };
  }

  if (areaName) {
    match.areaName = { $regex: areaName, $options: "i" };
  }

  const [summary] = await VisitFeedback.aggregate([
    { $match: match },
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              totalResponses: { $sum: 1 },
              averageRating: { $avg: "$rating" },
              commentedCount: {
                $sum: {
                  $cond: [
                    { $gt: [{ $strLenCP: { $ifNull: ["$comment", ""] } }, 0] },
                    1,
                    0,
                  ],
                },
              },
              acceptedCount: {
                $sum: {
                  $cond: [{ $gte: ["$rating", 4] }, 1, 0],
                },
              },
            },
          },
        ],
        distribution: [
          {
            $group: {
              _id: "$rating",
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ],
        recommendation: [
          {
            $group: {
              _id: "$wouldRecommend",
              count: { $sum: 1 },
            },
          },
        ],
        byMonth: [
          {
            $group: {
              _id: {
                year: { $year: "$answeredAt" },
                month: { $month: "$answeredAt" },
              },
              count: { $sum: 1 },
              averageRating: { $avg: "$rating" },
            },
          },
          {
            $sort: {
              "_id.year": 1,
              "_id.month": 1,
            },
          },
        ],
      },
    },
  ]);

  const totals = summary?.totals?.[0] || {
    totalResponses: 0,
    averageRating: 0,
    commentedCount: 0,
    acceptedCount: 0,
  };

  const distributionMap = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const item of summary?.distribution || []) {
    distributionMap[item._id] = item.count;
  }

  const recommendationMap = { yes: 0, maybe: 0, no: 0 };
  for (const item of summary?.recommendation || []) {
    if (item._id && recommendationMap[item._id] !== undefined) {
      recommendationMap[item._id] = item.count;
    }
  }

  const totalResponses = totals.totalResponses || 0;
  const acceptanceRate = totalResponses
    ? Math.round((totals.acceptedCount / totalResponses) * 100)
    : 0;

  return {
    totalResponses,
    averageRating: Number((totals.averageRating || 0).toFixed(2)),
    commentedCount: totals.commentedCount || 0,
    acceptedCount: totals.acceptedCount || 0,
    acceptanceRate,
    distribution: distributionMap,
    recommendation: recommendationMap,
    byMonth: (summary?.byMonth || []).map((item) => ({
      year: item._id.year,
      month: item._id.month,
      count: item.count,
      averageRating: Number((item.averageRating || 0).toFixed(2)),
    })),
  };
}