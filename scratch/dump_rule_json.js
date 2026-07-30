const user = 'SSA@TGB';
const pass = 'pega123!';
const insKey = 'RULE-OBJ-ACTIVITY RULE- POSTACTIONCHECKIN #20181119T214445.006 GMT';
const fs = require('fs');
const path = require('path');

(async () => {
  try {
    const directApiUrl = 'https://9ucseukj.pegaacademy.net/prweb/api/HRAppsV2Service/V1/rules/' + encodeURIComponent(insKey);
    console.log('Fetching full Rule JSON from:', directApiUrl);

    const res = await fetch(directApiUrl, {
      headers: { 
        'Authorization': 'Basic ' + Buffer.from(user + ':' + pass).toString('base64'),
        'Accept': 'application/json'
      }
    });
    
    const text = await res.text();
    const savePath = path.join(__dirname, 'PostActionCheckIn_Rule.json');
    fs.writeFileSync(savePath, text, 'utf8');
    console.log('Successfully saved full JSON to:', savePath, 'Size:', text.length, 'bytes');

  } catch (e) {
    console.log('Error:', e.message);
  }
})();
