const user = 'SSA@TGB';
const pass = 'pega123!';
const insKey = 'RULE-OBJ-ACTIVITY RULE- POSTACTIONCHECKOUT #20180713T132148.320 GMT';

(async () => {
  try {
    const directApiUrl = 'https://9ucseukj.pegaacademy.net/prweb/api/HRAppsV2Service/V1/rules/' + encodeURIComponent(insKey);
    console.log('Calling Direct API URL:', directApiUrl);

    const res = await fetch(directApiUrl, {
      headers: { 
        'Authorization': 'Basic ' + Buffer.from(user + ':' + pass).toString('base64'),
        'Accept': 'application/json'
      }
    });
    
    console.log('HTTP Status Code:', res.status);
    const text = await res.text();
    console.log('Response Length:', text.length);
    console.log('Response Body:\n', text.substring(0, 1500));

  } catch (e) {
    console.log('Error:', e.message);
  }
})();
