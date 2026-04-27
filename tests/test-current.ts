async function test() {
  // Test login first
  const login = await fetch('http://localhost:3000/api/users/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test2026@example.com', password: 'password123' })
  });
  
  const loginData = await login.json() as any;
  console.log('Login status:', login.status);
  console.log('Login response:', loginData);
  
  if (loginData.data?.token) {
    // Test current user with token
    const current = await fetch('http://localhost:3000/api/users/current', {
      headers: { 'Authorization': `Bearer ${loginData.data.token}` }
    });
    
    const currentData = await current.json() as any;
    console.log('Current user status:', current.status);
    console.log('Current user response:', currentData);
  }
}

test().catch(console.error);
