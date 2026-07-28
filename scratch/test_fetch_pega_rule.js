const https = require('https');

const insKey = "RULE-OBJ-ACTIVITY RULE- POSTACTIONCHECKOUT #20180713T132148.320 GMT";
const encodedInsKey = encodeURIComponent(insKey);
const baseUrl = "https://9ucseukj.pegaacademy.net/prweb/api/HRAppsV2Service/V1/rules/";
const url = baseUrl + encodedInsKey;

console.log("Calling URL:", url);

const options = {
    headers: {
        'Accept': 'application/json',
        'Authorization': 'Basic ' + Buffer.from('SSA@TGB:pega123!').toString('base64') // or standard admin creds if needed
    }
};

https.get(url, options, (res) => {
    console.log("Response Status Code:", res.statusCode);
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        console.log("Response Length:", data.length);
        console.log("Response Preview:", data.substring(0, 500));
    });
}).on('error', (e) => {
    console.error("Error:", e.message);
});
