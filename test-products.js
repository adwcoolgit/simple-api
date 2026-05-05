// Test script for products API
async function testProductsAPI() {
  const baseURL = 'http://localhost:3000';

  // Login to get token
  console.log('🔐 Logging in...');
  const loginResponse = await fetch(`${baseURL}/api/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test@example.com',
      password: 'password123'
    })
  });

  if (!loginResponse.ok) {
    console.log('❌ Login failed:', await loginResponse.text());
    return;
  }

  const loginData = await loginResponse.json();
  const token = loginData.data.token;
  console.log('✅ Got token:', token.substring(0, 20) + '...');

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // Test 1: Create product
  console.log('\n📝 Test 1: Creating product...');
  const createResponse = await fetch(`${baseURL}/api/products`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      plu_name: 'Indomie Goreng',
      description: 'Mie instan rasa goreng',
      department_id: 2,
      is_active: true
    })
  });

  if (!createResponse.ok) {
    console.log('❌ Create failed:', await createResponse.text());
    return;
  }

  const createData = await createResponse.json();
  const pluNo = createData.data.pluNo;
  console.log('✅ Product created with PLU:', pluNo);

  // Test 2: Get all products
  console.log('\n📋 Test 2: Getting all products...');
  const getAllResponse = await fetch(`${baseURL}/api/products`, {
    headers: authHeaders
  });

  if (!getAllResponse.ok) {
    console.log('❌ Get all failed:', await getAllResponse.text());
  } else {
    const getAllData = await getAllResponse.json();
    console.log('✅ Got', getAllData.data.length, 'products, total:', getAllData.meta.total);
  }

  // Test 3: Get product by PLU
  console.log('\n🔍 Test 3: Getting product by PLU...');
  const getByPluResponse = await fetch(`${baseURL}/api/products/${pluNo}`, {
    headers: authHeaders
  });

  if (!getByPluResponse.ok) {
    console.log('❌ Get by PLU failed:', await getByPluResponse.text());
  } else {
    const getByPluData = await getByPluResponse.json();
    console.log('✅ Got product:', getByPluData.data.pluName);
  }

  // Test 4: Update product
  console.log('\n✏️ Test 4: Updating product...');
  const updateResponse = await fetch(`${baseURL}/api/products/${pluNo}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({
      plu_name: 'Indomie Goreng Special',
      description: 'Edisi terbaru'
    })
  });

  if (!updateResponse.ok) {
    console.log('❌ Update failed:', await updateResponse.text());
  } else {
    const updateData = await updateResponse.json();
    console.log('✅ Updated to:', updateData.data.pluName);
  }

  // Test 5: Filter products
  console.log('\n🔎 Test 5: Filtering active products...');
  const filterResponse = await fetch(`${baseURL}/api/products?is_active=true`, {
    headers: authHeaders
  });

  if (!filterResponse.ok) {
    console.log('❌ Filter failed:', await filterResponse.text());
  } else {
    const filterData = await filterResponse.json();
    console.log('✅ Filtered products:', filterData.data.length);
  }

  // Test 6: Delete product (soft delete)
  console.log('\n🗑️ Test 6: Soft deleting product...');
  const deleteResponse = await fetch(`${baseURL}/api/products/${pluNo}`, {
    method: 'DELETE',
    headers: authHeaders
  });

  if (!deleteResponse.ok) {
    console.log('❌ Delete failed:', await deleteResponse.text());
  } else {
    console.log('✅ Product soft deleted');
  }

  // Test 7: Verify soft delete
  console.log('\n✅ Test 7: Verifying soft delete...');
  console.log('Fetching product with PLU:', pluNo);
  const verifyDeleteResponse = await fetch(`${baseURL}/api/products/${pluNo}`, {
    headers: authHeaders
  });

  console.log('Status:', verifyDeleteResponse.status);
  const responseText = await verifyDeleteResponse.text();
  console.log('Response:', responseText);

  if (verifyDeleteResponse.status === 404) {
    console.log('✅ Product correctly marked as deleted (not found)');
  } else {
    console.log('❌ Product still accessible after delete');
  }

  // Test 8: Check inactive filter includes deleted product
  console.log('\n🔍 Test 8: Checking inactive filter...');
  const inactiveResponse = await fetch(`${baseURL}/api/products?is_active=false`, {
    headers: authHeaders
  });

  if (!inactiveResponse.ok) {
    console.log('❌ Inactive filter failed:', await inactiveResponse.text());
  } else {
    const inactiveData = await inactiveResponse.json();
    console.log('✅ Found', inactiveData.data.length, 'inactive products');
  }

  console.log('\n🎉 All tests completed!');
}

testProductsAPI().catch(console.error);