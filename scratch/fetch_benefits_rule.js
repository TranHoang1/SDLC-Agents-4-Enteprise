const user = 'SSA@TGB';
const pass = 'pega123!';
const baseApiUrl = 'https://9ucseukj.pegaacademy.net/prweb/api/HRAppsV2Service/V1';
const authHeader = 'Basic ' + Buffer.from(user + ':' + pass).toString('base64');

const insKey = "RULE-OBJ-CASETYPE TGB-HRAPPS-WORK-BENEFITSENROLLMENT";

(async () => {
  console.log(`Fetching rule for insKey: ${insKey}`);
  try {
    const res = await fetch(`${baseApiUrl}/rules/${encodeURIComponent(insKey)}`, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json'
      }
    });
    console.log(`Status: ${res.status}`);
    const text = await res.text();
    console.log(`Response length: ${text.length} bytes`);
    console.log(text.substring(0, 3000));
  } catch (e) {
    console.error("Error:", e.message);
  }
})();
