const user = 'SSA@TGB';
const pass = 'pega123!';
const pegaBase = 'https://9ucseukj.pegaacademy.net/prweb';
const authHeader = 'Basic ' + Buffer.from(user + ':' + pass).toString('base64');

(async () => {
  try {
    const res = await fetch(`${pegaBase}/api/v1/casetypes/TGB-HRApps-Work-BenefitsEnrollment`, {
      headers: { Authorization: authHeader }
    });
    console.log(`Casetype detail status: ${res.status}`);
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Error:", e.message);
  }
})();
