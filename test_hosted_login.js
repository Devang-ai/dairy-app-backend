const axios = require('axios');

async function testHostedLogin() {
    const url = 'https://dairy-app-backend-ls9c.onrender.com/api/auth/login';
    console.log('>>> Testing Hosted Login at:', url);
    
    try {
        const res = await axios.post(url, {
            username: '1234567890',
            password: 'admin123'
        });
        console.log('SUCCESS: Login works!', res.data);
    } catch (error) {
        if (error.response) {
            console.log('FAILED: Backend returned an error:', error.response.status, error.response.data);
        } else {
            console.log('FAILED: Connection error:', error.message);
        }
    }
}

testHostedLogin();
