import { NextRequest, NextResponse } from 'next/server';
import { verifyOAuthHmac, exchangeCodeForToken, registerOrdersPaidWebhook } from '@/app/lib/shopify';

// Admin-only diagnostic endpoint: completes the Shopify OAuth handshake and
// displays the resulting access token so it can be copied into .env manually,
// matching how every other gateway's credentials are stored in this project.
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get('code');
  const shop = searchParams.get('shop');
  const state = searchParams.get('state');
  const cookieState = req.cookies.get('shopify_oauth_state')?.value;

  if (!code || !shop) {
    return NextResponse.json({ error: 'Missing code or shop param' }, { status: 400 });
  }

  if (!verifyOAuthHmac(searchParams)) {
    return NextResponse.json({ error: 'Invalid HMAC — request did not come from Shopify' }, { status: 401 });
  }

  if (cookieState && state !== cookieState) {
    return NextResponse.json({ error: 'State mismatch — possible CSRF' }, { status: 401 });
  }

  try {
    const { access_token, scope } = await exchangeCodeForToken(code);

    // Subscribe to ORDERS_PAID straight away, with the token just issued — it is not in the
    // environment yet, so adminGraphQL has to be told which token to use. Without this the
    // app installs fine and takes payments, but nothing ever reports a completed payment
    // back, leaving every admindata record stuck at pending.
    const webhook = await registerOrdersPaidWebhook(
      `${req.nextUrl.origin}/api/shopify/webhook`,
      access_token
    );
    const webhookStatus = webhook.alreadyRegistered
      ? 'already registered'
      : webhook.ok
      ? 'registered'
      : `FAILED — ${webhook.message ?? 'unknown error'}`;
    if (!webhook.ok) {
      console.error('[Shopify OAuth Callback] ORDERS_PAID webhook registration failed:', webhook.message);
    }

    return new NextResponse(
      `<!doctype html><html><body style="font-family:monospace;padding:40px;max-width:700px">
        <h2>Shopify app installed</h2>
        <p>Copy this into SHOPIFY_ACCESS_TOKEN in .env, then delete/rotate this token if this page was ever exposed publicly.</p>
        <p><strong>Shop:</strong> ${shop}</p>
        <p><strong>Scopes granted:</strong> ${scope}</p>
        <p><strong>orders/paid webhook:</strong> ${webhookStatus}</p>
        <textarea style="width:100%;height:60px" readonly>${access_token}</textarea>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  } catch (err: any) {
    console.error('[Shopify OAuth Callback] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
