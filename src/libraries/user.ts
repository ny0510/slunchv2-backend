import { OAuth2Client } from "google-auth-library"

const client = new OAuth2Client();

export const ADMIN_USERID = [""];

export async function getUser(token: string): Promise<string> {
  const ticket = await client.verifyIdToken({
    idToken: token,
    audience: process.env.GOOGLE_CLIENT_ID
  })
  const payload = ticket.getPayload();
  if (payload === undefined) {
    throw TypeError("payload is undefined")
  }
  return payload['sub']
}

