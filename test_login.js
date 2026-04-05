async function testLogin() {
    try {
        const res = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: '1234567890',
                password: 'admin123'
            })
        });
        const data = await res.json();
        if (res.ok) {
            console.log('Login successful:', data);
        } else {
            console.log('Login failed with status:', res.status, data);
        }
    } catch (e) {
        console.log('Login connection failed:', e.message);
    }
}
testLogin();
