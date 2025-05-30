import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client();

export const ADMIN_USERID = ['117788837064634045256'];

export async function getUser(token: string): Promise<string> {
  const ticket = await client.verifyIdToken({
    idToken: token,
    audience: Deno.env.get("GOOGLE_CLIENT_ID"),
  });
  const payload = ticket.getPayload();
  if (payload === undefined) {
    throw TypeError('payload is undefined');
  }
  return payload['sub'];
}
