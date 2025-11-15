async function testHealth() {
  try {
    const response = await fetch('http://localhost:3000/api/search/health');
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ Health check passed!');
      console.log(data);
    } else {
      console.log('❌ Health check failed');
    }
  } catch (error) {
    console.error('❌ Cannot connect to server:', error.message);
  }
}

testHealth();