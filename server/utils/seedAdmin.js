const User = require('../models/User');
const Shop = require('../models/Shop');
const ShopType = require('../models/ShopType');

const seedSuperAdmin = async () => {
  try {
    const adminEmail = 'owner@mksbilling.com';
    let adminUser = await User.findOne({ email: adminEmail });

    // Also check if any super admin exists
    const superAdminExists = await User.findOne({ role: 'SUPER_ADMIN' });

    if (!adminUser && !superAdminExists) {
      // Find or create a master platform shop
      let platformShop = await Shop.findOne({ name: 'MKS Platform Master' });
      if (!platformShop) {
        platformShop = await Shop.create({
          name: 'MKS Platform Master',
          shopType: 'KIRANA',
          ownerName: 'MKS Platform Owner',
          mobile: '9876543210',
          email: adminEmail,
          subscriptionPlan: 'ENTERPRISE_YEARLY',
          subscriptionExpiry: new Date('2099-12-31'),
          planAmount: 0,
          isActive: true
        });
      }

      adminUser = await User.create({
        name: 'MKS Platform Owner',
        email: adminEmail,
        password: 'admin123',
        role: 'SUPER_ADMIN',
        shopId: platformShop._id,
        mobile: '9876543210',
        isActive: true
      });
      console.log('✅ Default Super Admin created: owner@mksbilling.com / admin123');
    } else if (adminUser && adminUser.role !== 'SUPER_ADMIN') {
      adminUser.role = 'SUPER_ADMIN';
      await adminUser.save();
      console.log('✅ Updated owner@mksbilling.com to SUPER_ADMIN role.');
    }
  } catch (error) {
    console.error('Error seeding Super Admin:', error.message);
  }
};

module.exports = seedSuperAdmin;
