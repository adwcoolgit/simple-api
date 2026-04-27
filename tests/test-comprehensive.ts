async function test() {
  console.log('=== COMPREHENSIVE API TESTS ===');
  
  // 1. Test invalid token
  console.log('\n1. Invalid token:');
  const invalid = await fetch('http://localhost:3000/api/users/current', {
    headers: { 'Authorization': 'Bearer invalid' }
  });
  console.log('Status:', invalid.status);
  console.log('Response:', await invalid.text());
  
  // 2. Test missing header
  console.log('\n2. Missing Authorization header:');
  const noAuth = await fetch('http://localhost:3000/api/users/current');
  console.log('Status:', noAuth.status);
  console.log('Response:', await noAuth.text());
  
  // 3. Test invalid header format
  console.log('\n3. Invalid header format:');
  const badHeader = await fetch('http://localhost:3000/api/users/current', {
    headers: { 'Authorization': 'InvalidFormat' }
  });
  console.log('Status:', badHeader.status);
  console.log('Response:', await badHeader.text());
  
  // 4. Test successful flow
  console.log('\n4. Valid login and current user:');
  const login = await fetch('http://localhost:3000/api/users/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test2026@example.com', password: 'password123' })
  });
  
  const loginData = await login.json() as any;
  console.log('Login status:', login.status);
  console.log('Login response:', loginData);
  
  if (loginData.data?.token) {
    const current = await fetch('http://localhost:3000/api/users/current', {
      headers: { 'Authorization': `Bearer ${loginData.data.token}` }
    });
    
    const currentData = await current.json() as any;
    console.log('Current user status:', current.status);
    console.log('Current user response:', currentData);
    
    // Check that password is not in response
    if (currentData.data && !('password' in currentData.data)) {
      console.log('✓ Password not leaked in response');
    } else {
      console.log('✗ Password leaked in response');
    }
  }
  
  // 5. Test GET /api/users (should not have passwords)
  console.log('\n5. GET /api/users (should not show passwords):');
  const allUsers = await fetch('http://localhost:3000/api/users');
  const usersData = await allUsers.json() as any;
  console.log('Users status:', allUsers.status);
  if (usersData.users && usersData.users.length > 0) {
    const firstUser = usersData.users[0];
    if ('password' in firstUser) {
      console.log('✗ Password leaked in /api/users');
    } else {
      console.log('✓ Password not leaked in /api/users');
    }
    console.log('Sample user:', firstUser);
  }
  
  console.log('\n=== TESTS COMPLETE ===');
}

test().catch(console.error);
