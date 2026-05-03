exports.handler = async (event) => {
  const MAKE_URL = 'https://hook.eu1.make.com/r9flw5xs4wwp18hp9jno6wr1rsqohhvs';
  
  const res = await fetch(MAKE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: event.body
  });

  return {
    statusCode: 200,
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ ok: true })
  };
};
