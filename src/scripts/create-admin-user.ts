import { getAdmin } from '@/lib/firebase-admin';

async function createAdminUser() {
  const { auth, db } = await getAdmin();
  
  // Replace with the actual UID from Firebase Auth
  const adminUid = 'REPLACE_WITH_ADMIN_USER_UID';
  const adminEmail = 'admin@example.com'; // Replace with actual email
  
  try {
    await db.collection('users').doc(adminUid).set({
      role: 'owner',
      email: adminEmail,
      createdAt: new Date(),
      updatedAt: new Date()
    }, { merge: true });
    
    console.log('✅ Admin user created successfully');
    console.log(`UID: ${adminUid}`);
    console.log(`Email: ${adminEmail}`);
    console.log(`Role: owner`);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  }
}

createAdminUser();