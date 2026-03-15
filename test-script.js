const http = require('http');

function req(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api' + path,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch(e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function randomStr() {
  return Math.random().toString(36).substring(7);
}

async function run() {
  try {
    const s1 = randomStr();
    
    // 1. Register User 1
    let r = await req('POST', '/auth/register', {
      name: 'Test User',
      email: `test_${s1}@example.com`,
      password: 'password123',
      department: 'CS',
      phone: '1234',
      security_question: 'What was the name of your first pet?',
      security_answer: 'buddy'
    });
    let token1 = r.data.data?.token || r.data.token;
    console.log('User 1 Token:', !!token1);

    // 2. Report Lost Item by User 1
    r = await req('POST', '/items', { title: 'Lost Keys ' + s1, type: 'lost', category: 'Personal', location: 'Library', date_lost: '2026-03-14' }, token1);
    const item1 = r.data.data || r.data;
    console.log('Item created:', !!item1);
    if (item1) console.log('   - Item ID:', item1.id);

    // 3. Register User 2
    const s2 = randomStr();
    r = await req('POST', '/auth/register', {
      name: 'Test User 2',
      email: `test2_${s2}@example.com`,
      password: 'password123',
      department: 'IT',
      phone: '5678',
      security_question: 'What city were you born in?',
      security_answer: 'pune'
    });
    let token2 = r.data.data?.token || r.data.token;
    
    // 4. Claim item by User 2
    r = await req('POST', '/claims', { item_id: item1.id, message: 'These are my keys...', contact: 'me@me.com' }, token2);
    console.log('Claim created:', r.status === 201);
    r = await req('GET', '/claims/user', null, token2);
    console.log('My Claims count for User 2:', r.data.data?.length);

    // 5. Register Admin
    // We can just use the seeder admin account admin@university.edu / admin123
    r = await req('POST', '/auth/login', { email: 'admin@university.edu', password: 'admin123' });
    let tokenAdmin = r.data.data?.token || r.data.token;
    console.log('Admin Token:', !!tokenAdmin);

    // 6. Test Admin Items mapping
    r = await req('GET', '/admin/items', null, tokenAdmin);
    console.log('Admin Items count:', r.data.data?.length);
    if (r.data.data?.length > 0) {
      const dbItem = r.data.data.find(i => i.id === item1.id);
      console.log('   - Item found in Admin list:', !!dbItem);
      console.log('   - Item Pending Claims Count:', dbItem?.pending_claims);
    }

    // 7. Check My Items for User 1
    r = await req('GET', '/items/my', null, token1);
    console.log('My Items count for User 1:', r.data.data?.length);

    // 8. Test Admin Delete Item
    r = await req('DELETE', `/admin/items/${item1.id}`, null, tokenAdmin);
    console.log('Admin Delete Item status:', r.status === 200 || r.status === 204);

    r = await req('GET', `/items/${item1.id}`);
    console.log('Item Should be gone (404/Null):', r.status === 404 || !r.data);

    console.log('Done!');
  } catch(e) {
    console.error(e);
  }
}
run();
