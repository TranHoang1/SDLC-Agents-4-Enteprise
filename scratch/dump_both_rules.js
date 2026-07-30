const user = 'SSA@TGB';
const pass = 'pega123!';
const fs = require('fs');
const path = require('path');

const insKeyCheckout = 'RULE-OBJ-ACTIVITY RULE- POSTACTIONCHECKOUT #20180713T132148.320 GMT';
const insKeyCheckin = 'RULE-OBJ-ACTIVITY RULE- POSTACTIONCHECKIN #20181119T214445.006 GMT';

(async () => {
  try {
    // Fetch Checkout Rule
    const urlOut = 'https://9ucseukj.pegaacademy.net/prweb/api/HRAppsV2Service/V1/rules/' + encodeURIComponent(insKeyCheckout);
    const resOut = await fetch(urlOut, { headers: { 'Authorization': 'Basic ' + Buffer.from(user + ':' + pass).toString('base64'), 'Accept': 'application/json' } });
    const textOut = await resOut.text();
    fs.writeFileSync(path.join(__dirname, 'PostActionCheckOut_Rule.json'), textOut, 'utf8');
    console.log('Saved PostActionCheckOut_Rule.json (Size:', textOut.length, 'bytes)');

    // Fetch CheckIn Rule
    const urlIn = 'https://9ucseukj.pegaacademy.net/prweb/api/HRAppsV2Service/V1/rules/' + encodeURIComponent(insKeyCheckin);
    const resIn = await fetch(urlIn, { headers: { 'Authorization': 'Basic ' + Buffer.from(user + ':' + pass).toString('base64'), 'Accept': 'application/json' } });
    const textIn = await resIn.text();
    fs.writeFileSync(path.join(__dirname, 'PostActionCheckIn_Rule.json'), textIn, 'utf8');
    console.log('Saved PostActionCheckIn_Rule.json (Size:', textIn.length, 'bytes)');

  } catch (e) {
    console.log('Error:', e.message);
  }
})();
