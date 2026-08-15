async function main() {
  const res = await fetch("http://127.0.0.1:48721/api/admin/database/tables", { headers: { "Cookie": "" } });
  console.log(res.status, await res.text().then(t => t.substring(0, 500)));
}
main();
