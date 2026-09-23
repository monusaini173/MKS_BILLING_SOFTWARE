const Expense = require('../models/Expense');

const getDateRange = (filter, startDate, endDate) => {
  const now = new Date();
  let start, end;

  switch (filter) {
    case 'today': {
      start = new Date();
      start.setHours(0, 0, 0, 0);
      end = new Date();
      end.setHours(23, 59, 59, 999);
      break;
    }
    case 'yesterday': {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      start = new Date(yesterday.setHours(0, 0, 0, 0));
      end = new Date(yesterday.setHours(23, 59, 59, 999));
      break;
    }
    case 'week': {
      start = new Date();
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      end = new Date();
      end.setHours(23, 59, 59, 999);
      break;
    }
    case 'month': {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    }
    case 'year': {
      start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      break;
    }
    case 'custom': {
      start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
      start.setHours(0, 0, 0, 0);
      end = endDate ? new Date(new Date(endDate).setHours(23, 59, 59, 999)) : new Date();
      break;
    }
    default: {
      // Return null to not restrict by date if filter is 'all' or empty
      return null;
    }
  }
  return { start, end };
};

const getExpenses = async (req, res) => {
  try {
    const { search, category, filter, startDate, endDate, page = 1, limit = 50 } = req.query;
    const shopId = req.shopId;
    const query = { shopId };

    if (category && category !== 'ALL') {
      query.category = category;
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { description: searchRegex },
        { paidTo: searchRegex },
        { reference: searchRegex }
      ];
    }

    if (filter && filter !== 'all') {
      const range = getDateRange(filter, startDate, endDate);
      if (range) {
        query.date = { $gte: range.start, $lte: range.end };
      }
    } else if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(new Date(startDate).setHours(0, 0, 0, 0));
      if (endDate) query.date.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Expense.countDocuments(query);
    const expenses = await Expense.find(query)
      .populate('createdBy', 'name role')
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Summary calculations (Today, Yesterday, Month, Filtered Period)
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

    const yesterdayStart = new Date(); yesterdayStart.setDate(yesterdayStart.getDate() - 1); yesterdayStart.setHours(0, 0, 0, 0);
    const yesterdayEnd = new Date(); yesterdayEnd.setDate(yesterdayEnd.getDate() - 1); yesterdayEnd.setHours(23, 59, 59, 999);

    const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1, 0, 0, 0, 0);
    const monthEnd = new Date(todayStart.getFullYear(), todayStart.getMonth() + 1, 0, 23, 59, 59, 999);

    const [todayAgg, yesterdayAgg, monthAgg, filteredAgg, categoryAgg] = await Promise.all([
      Expense.aggregate([
        { $match: { shopId, date: { $gte: todayStart, $lte: todayEnd } } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      Expense.aggregate([
        { $match: { shopId, date: { $gte: yesterdayStart, $lte: yesterdayEnd } } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      Expense.aggregate([
        { $match: { shopId, date: { $gte: monthStart, $lte: monthEnd } } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      Expense.aggregate([
        { $match: query },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      Expense.aggregate([
        { $match: query },
        { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { total: -1 } }
      ])
    ]);

    const summary = {
      todayTotal: todayAgg[0]?.total || 0,
      todayCount: todayAgg[0]?.count || 0,
      yesterdayTotal: yesterdayAgg[0]?.total || 0,
      yesterdayCount: yesterdayAgg[0]?.count || 0,
      monthTotal: monthAgg[0]?.total || 0,
      monthCount: monthAgg[0]?.count || 0,
      filteredTotal: filteredAgg[0]?.total || 0,
      filteredCount: filteredAgg[0]?.count || 0,
      byCategory: categoryAgg || []
    };

    res.json({
      success: true,
      data: expenses,
      summary,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createExpense = async (req, res) => {
  try {
    const { category, amount, description, paidTo, date, paymentMethod, reference } = req.body;
    
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'कृपया सही खर्च रकम (Amount) दर्ज करें।' });
    }

    const cat = category || 'OTHER';
    const desc = (description && description.trim()) ? description.trim() : cat;

    const expense = await Expense.create({
      shopId: req.shopId,
      createdBy: req.user._id,
      category: cat,
      amount: Number(amount),
      description: desc,
      paidTo: paidTo ? paidTo.trim() : '',
      date: date ? new Date(date) : new Date(),
      paymentMethod: paymentMethod || 'CASH',
      reference: reference ? reference.trim() : ''
    });

    const populated = await Expense.findById(expense._id).populate('createdBy', 'name role');

    res.status(201).json({ success: true, message: 'दुकान खर्च सफलतापूर्वक दर्ज हो गया (Expense recorded successfully)', data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


const updateExpense = async (req, res) => {
  try {
    const { category, amount, description, paidTo, date, paymentMethod, reference } = req.body;
    
    const updateData = {};
    if (category) updateData.category = category;
    if (amount !== undefined) updateData.amount = Number(amount);
    if (description) updateData.description = description.trim();
    if (paidTo !== undefined) updateData.paidTo = paidTo.trim();
    if (date) updateData.date = new Date(date);
    if (paymentMethod) updateData.paymentMethod = paymentMethod;
    if (reference !== undefined) updateData.reference = reference.trim();

    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, shopId: req.shopId },
      updateData,
      { new: true }
    ).populate('createdBy', 'name role');

    if (!expense) return res.status(404).json({ success: false, message: 'Expense record not found.' });
    res.json({ success: true, message: 'खर्च अपडेट हो गया (Expense updated)', data: expense });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findOneAndDelete({ _id: req.params.id, shopId: req.shopId });
    if (!expense) return res.status(404).json({ success: false, message: 'Expense record not found.' });
    res.json({ success: true, message: 'खर्च रिकॉर्ड डिलीट कर दिया गया (Expense deleted)' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getExpenses, createExpense, updateExpense, deleteExpense };

