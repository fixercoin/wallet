export const onRequest = async ({request}) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin':'*',
        'Access-Control-Allow-Methods':'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers':'Content-Type,Authorization'
      }
    });
  }
  return new Response(JSON.stringify({message: 'ping'}), {
    status:200,
    headers: {
      'Content-Type':'application/json',
      'Access-Control-Allow-Origin':'*'
    }
  });
};
