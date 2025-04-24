/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
  // サーバーサイドのハンドル処理
  const response = await resolve(event);
  return response;
}
