import crypto from 'crypto';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`[Shopify] Missing required env var: ${name}`);
  return value;
}

/** Accepts either a bare numeric variant id ("54230108504428") or a full
 *  "gid://shopify/ProductVariant/..." and normalises to the gid form the Admin API wants.
 *  Returns undefined for an unset/blank env var so callers can fall back. */
function toVariantGid(raw?: string): string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  return value.startsWith('gid://') ? value : `gid://shopify/ProductVariant/${value}`;
}

// Must match the scopes the app was released with in the Dev Dashboard — asking for a scope
// the app doesn't declare makes Shopify reject the whole authorize request.
// read_own_subscription_contracts / write_own_subscription_contracts are deliberately absent:
// this Shopify org isn't granted them ("invalid scopes" at app creation, and the dashboard's
// scope picker returns no match for "subscription"). Add them back here and to the app version
// together, once Shopify enables them for the org.
export const SHOPIFY_SCOPES = 'write_draft_orders,read_draft_orders,read_orders,read_products,write_products,read_purchase_options,write_purchase_options,read_publications,write_publications,unauthenticated_write_checkouts,unauthenticated_read_checkouts,unauthenticated_read_product_listings,unauthenticated_read_selling_plans';

export function getAuthorizeUrl(redirectUri: string, state: string): string {
  const shop = requireEnv('SHOPIFY_SHOP_DOMAIN');
  const clientId = requireEnv('SHOPIFY_CLIENT_ID');
  const params = new URLSearchParams({
    client_id: clientId,
    scope: SHOPIFY_SCOPES,
    redirect_uri: redirectUri,
    state,
  });
  return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
}

/** Verifies the HMAC Shopify attaches to OAuth callback query params. */
export function verifyOAuthHmac(searchParams: URLSearchParams): boolean {
  const secret = requireEnv('SHOPIFY_CLIENT_SECRET');
  const hmac = searchParams.get('hmac');
  if (!hmac) return false;

  const pairs: string[] = [];
  searchParams.forEach((value, key) => {
    if (key === 'hmac' || key === 'signature') return;
    pairs.push(`${key}=${value}`);
  });
  pairs.sort();
  const message = pairs.join('&');

  const digest = crypto.createHmac('sha256', secret).update(message).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmac));
}

export async function exchangeCodeForToken(code: string): Promise<{ access_token: string; scope: string }> {
  const shop = requireEnv('SHOPIFY_SHOP_DOMAIN');
  const clientId = requireEnv('SHOPIFY_CLIENT_ID');
  const clientSecret = requireEnv('SHOPIFY_CLIENT_SECRET');

  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[Shopify] Token exchange failed: ${res.status} ${text}`);
  }

  return res.json();
}

interface AdminGraphQLResult<T> {
  ok: boolean;
  data?: T;
  errors?: any[];
}

export async function adminGraphQL<T = any>(query: string, variables?: Record<string, any>): Promise<AdminGraphQLResult<T>> {
  const shop = requireEnv('SHOPIFY_SHOP_DOMAIN');
  const apiVersion = process.env.SHOPIFY_API_VERSION || '2026-01';
  const accessToken = requireEnv('SHOPIFY_ACCESS_TOKEN');

  const res = await fetch(`https://${shop}/admin/api/${apiVersion}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();
  if (!res.ok || json.errors) {
    return { ok: false, data: json.data, errors: json.errors || [{ message: `HTTP ${res.status}` }] };
  }
  return { ok: true, data: json.data };
}

export interface DraftOrderAddress {
  firstName?: string;
  lastName?: string;
  address1?: string;
  city?: string;
  /** Two-letter region code (e.g. "VA") — Shopify's MailingAddressInput field is provinceCode, not province. */
  provinceCode?: string;
  zip?: string;
  /** Two-letter country code (e.g. "US") — Shopify's MailingAddressInput field is countryCode, not country. */
  countryCode?: string;
  phone?: string;
}

export interface CreateDraftOrderParams {
  title: string;
  amountUSD: number;
  customerEmail?: string;
  note?: string;
  localOrderId: string;
  billingAddress?: DraftOrderAddress;
}

// Representative product used so QuickBooks Enterprise edition purchases (any custom price)
// show a real image at checkout instead of the generic placeholder icon. Custom services
// (Payroll, Consulting, etc.) still fall back to a plain custom line item until they get
// their own mapped product/image.
// Store-specific: set SHOPIFY_ENTERPRISE_VARIANT_ID to the numeric variant id (or full gid)
// of this store's QuickBooks Enterprise variant. Left unset, draft orders still work — the
// line item just falls back to a plain custom item with the placeholder image.
// NOTE: every process.env read below happens inside a function, never at module scope.
// On OpenNext/Cloudflare Workers process.env isn't reliably populated until request-scoped
// context runs, so a top-level `const x = process.env.FOO` can capture undefined
// permanently on a cold isolate.
function enterpriseVariantId(): string | undefined {
  return toVariantGid(process.env.SHOPIFY_ENTERPRISE_VARIANT_ID);
}

// The currency the customer is billed in. This store's BASE currency is AUD, so without an
// explicit presentmentCurrencyCode every draft order would be raised in AUD and a 49.87
// amount would be charged as A$49.87, not US$49.87. USD is available as a presentment
// currency because the store has an active United States market; if that market is ever
// removed, Shopify rejects the draft order rather than silently billing the wrong currency.
function presentmentCurrency(): string {
  return (process.env.SHOPIFY_PRESENTMENT_CURRENCY || 'USD').toUpperCase();
}

// The Storefront Cart API has no presentmentCurrencyCode — it derives the currency from the
// buyer's market, which is chosen by country. This is the fallback when the customer gave no
// address, and must stay in step with presentmentCurrency()'s market.
function subscriptionBuyerCountry(): string {
  return (process.env.SHOPIFY_BUYER_COUNTRY || 'US').toUpperCase();
}

/** Creates a draft order with a single custom-priced line item and returns its invoice URL. */
export async function createDraftOrderInvoice(params: CreateDraftOrderParams) {
  const mutation = `
    mutation draftOrderCreate($input: DraftOrderInput!) {
      draftOrderCreate(input: $input) {
        draftOrder {
          id
          name
          invoiceUrl
          totalPrice
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  // Falls back to a plain custom line item when this store has no mapped variant configured.
  const enterpriseVariant = enterpriseVariantId();
  const currency = presentmentCurrency();
  const isQuickBooksEdition =
    !!enterpriseVariant &&
    params.title?.toLowerCase().startsWith('quickbooks enterprise');

  const variables = {
    input: {
      email: params.customerEmail,
      presentmentCurrencyCode: currency,
      note: params.note,
      tags: ['qb-enterprise', `localOrderId:${params.localOrderId}`],
      // Surfaced as checkout.attributes in the Order Status page's "Additional scripts",
      // used to build the post-payment redirect back to our own success page.
      customAttributes: [{ key: 'localOrderId', value: params.localOrderId }],
      billingAddress: params.billingAddress,
      // Mirrored so Shopify's checkout "Delivery" step (which reads shippingAddress, not
      // billingAddress) is prefilled too, instead of showing up blank.
      shippingAddress: params.billingAddress,
      lineItems: [
        isQuickBooksEdition
          ? {
              variantId: enterpriseVariant,
              priceOverride: { amount: params.amountUSD.toFixed(2), currencyCode: currency },
              quantity: 1,
            }
          : {
              title: params.title,
              originalUnitPrice: params.amountUSD.toFixed(2),
              quantity: 1,
            },
      ],
    },
  };

  const result = await adminGraphQL<{
    draftOrderCreate: {
      draftOrder: { id: string; name: string; invoiceUrl: string; totalPrice: string } | null;
      userErrors: { field: string[]; message: string }[];
    };
  }>(mutation, variables);

  return result;
}

/** Looks up the real Order created from a completed draft order, by the localOrderId tag we set at creation. */
export async function findOrderByLocalOrderId(localOrderId: string) {
  const query = `
    query findOrder($search: String!) {
      orders(first: 1, query: $search) {
        edges {
          node {
            id
            name
            displayFinancialStatus
            totalPriceSet {
              shopMoney { amount currencyCode }
              # What the customer was actually charged. On this store shopMoney is AUD
              # (the shop's base currency) while the customer pays USD, so anything that
              # records "the amount paid" must read presentmentMoney, not shopMoney.
              presentmentMoney { amount currencyCode }
            }
            transactions(first: 5) {
              kind
              status
              paymentDetails {
                ... on CardPaymentDetails {
                  company
                  number
                }
              }
            }
          }
        }
      }
    }
  `;
  const result = await adminGraphQL<{
    orders: {
      edges: {
        node: {
          id: string;
          name: string;
          displayFinancialStatus: string;
          totalPriceSet: {
            shopMoney: { amount: string; currencyCode: string };
            presentmentMoney: { amount: string; currencyCode: string };
          };
          transactions: { kind: string; status: string; paymentDetails: { company?: string; number?: string } | null }[];
        };
      }[];
    };
  }>(query, { search: `tag:'localOrderId:${localOrderId}'` });

  return result;
}

/** Builds a "Visa ending in 4242" style label from Shopify's card payment details, matching other gateways. */
export function formatCardLabel(company?: string, maskedNumber?: string): string {
  const last4 = maskedNumber?.match(/(\d{4})\s*$/)?.[1];
  if (!last4) return 'Card on file';
  return `${company || 'Card'} ending in ${last4}`;
}

export async function registerOrdersPaidWebhook(callbackUrl: string) {
  const mutation = `
    mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
      webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
        webhookSubscription { id callbackUrl }
        userErrors { field message }
      }
    }
  `;
  return adminGraphQL(mutation, {
    topic: 'ORDERS_PAID',
    webhookSubscription: { callbackUrl, format: 'JSON' },
  });
}

// THIS app's own selling plan ("monthly-billing" / "Billed monthly"). Verified live against
// quickbooks-2030 on 2026-09-28: it is valid, and every contract it produces is owned by
// this app ("QB Enterprise Checkout"). An earlier note here claimed this id was stale — that
// was wrong. The real reason renewals never happened is that Shopify only auto-bills contracts
// owned by its own Subscriptions app; for a contract owned by this app, this app must start
// each renewal charge itself (see app/lib/shopifyRenewals.ts).
// Store-specific. Set SHOPIFY_PAYROLL_SELLING_PLAN_ID to this store's selling plan id, and
// SHOPIFY_PAYROLL_VARIANTS to a JSON object mapping each monthly tier price to its variant
// id, e.g. {"49.87":"54224799433068","98.78":"54224800579948"}. Both accept bare numeric
// ids or full gids. Until they're set, the subscription flow refuses rather than charging
// against the wrong product.
export function payrollSellingPlanId(): string | undefined {
  const raw = process.env.SHOPIFY_PAYROLL_SELLING_PLAN_ID?.trim();
  if (!raw) return undefined;
  return raw.startsWith('gid://') ? raw : `gid://shopify/SellingPlan/${raw}`;
}

export function payrollSubscriptionVariants(): Record<string, string> {
  const raw = process.env.SHOPIFY_PAYROLL_VARIANTS?.trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([tier, id]) => [tier, toVariantGid(id)])
        .filter(([, gid]) => !!gid) as [string, string][]
    );
  } catch {
    console.error('[Shopify] SHOPIFY_PAYROLL_VARIANTS is not valid JSON — ignoring it.');
    return {};
  }
}

export interface SubscriptionCheckoutParams {
  tier: string;
  localOrderId?: string;
  email?: string;
  address?: DraftOrderAddress;
}

/** Confirms this app's own selling plan is still attached to the variant, and returns its id.
 *  Returns null if it isn't, which the caller treats as a hard failure.
 *
 *  Deliberately does NOT just take "the first plan on the variant": the product can carry
 *  plans from more than one app (a second plan created in Shopify's own Subscriptions app
 *  sits on it too). A contract from a plan owned by another app is one this app never hears
 *  about and never bills, so silently picking whichever plan happens to be listed first
 *  could sell customers a subscription nobody renews. */
export async function resolveSellingPlanIdForVariant(variantId: string): Promise<string | null> {
  const shop = requireEnv('SHOPIFY_SHOP_DOMAIN');
  const storefrontToken = requireEnv('SHOPIFY_STOREFRONT_ACCESS_TOKEN');
  const apiVersion = process.env.SHOPIFY_API_VERSION || '2026-01';

  const query = `
    query($id: ID!) {
      node(id: $id) {
        ... on ProductVariant {
          sellingPlanAllocations(first: 5) {
            edges { node { sellingPlan { id name } } }
          }
        }
      }
    }
  `;

  const res = await fetch(`https://${shop}/api/${apiVersion}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': storefrontToken,
    },
    body: JSON.stringify({ query, variables: { id: variantId } }),
  });

  const expectedPlanId = payrollSellingPlanId();
  if (!expectedPlanId) {
    console.error('[Shopify] SHOPIFY_PAYROLL_SELLING_PLAN_ID is not set — refusing to pick a plan.');
    return null;
  }

  const json = await res.json();
  const edges: { node?: { sellingPlan?: { id?: string } } }[] = json?.data?.node?.sellingPlanAllocations?.edges ?? [];
  const ours = edges.find((e) => e?.node?.sellingPlan?.id === expectedPlanId);
  if (!ours) {
    console.error('[Shopify] Our selling plan is not attached to variant', variantId, JSON.stringify(json));
    return null;
  }
  return expectedPlanId;
}

/** Creates a fresh Storefront API cart for a QuickBooks Payroll subscription tier and returns its checkout URL. */
export async function createSubscriptionCheckoutUrl(params: SubscriptionCheckoutParams): Promise<string | null> {
  const variantId = payrollSubscriptionVariants()[params.tier];
  if (!variantId) return null;

  const sellingPlanId = await resolveSellingPlanIdForVariant(variantId);
  if (!sellingPlanId) {
    // Do NOT fall back to checking out without a selling plan — that produces a normal
    // one-time order that looks fine right up until day 30, when nothing recharges it.
    return null;
  }

  const shop = requireEnv('SHOPIFY_SHOP_DOMAIN');
  const storefrontToken = requireEnv('SHOPIFY_STOREFRONT_ACCESS_TOKEN');
  const apiVersion = process.env.SHOPIFY_API_VERSION || '2026-01';

  const mutation = `
    mutation cartCreate($input: CartInput!) {
      cartCreate(input: $input) {
        cart { checkoutUrl }
        userErrors { field message }
      }
    }
  `;

  const res = await fetch(`https://${shop}/api/${apiVersion}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': storefrontToken,
    },
    body: JSON.stringify({
      query: mutation,
      variables: {
        input: {
          lines: [{ merchandiseId: variantId, quantity: 1, sellingPlanId }],
          // Cart attributes are carried through to the resulting Order's note_attributes,
          // which is how the orders/paid webhook ties the Shopify order back to our Mongo record.
          attributes: params.localOrderId ? [{ key: 'localOrderId', value: params.localOrderId }] : undefined,
          // countryCode picks the market, and therefore the currency, the cart is priced in.
          // This store's default market is Australia/AUD, so without it a subscription
          // checkout would be billed in AUD even though the tier figures are US dollars.
          buyerIdentity: {
            ...(params.email ? { email: params.email } : {}),
            countryCode: params.address?.countryCode || subscriptionBuyerCountry(),
          },
          // Prefills checkout's "Delivery" step — unlike Draft Orders, the Cart API has no
          // separate billing-address concept; this is the only address input it accepts.
          delivery: params.address ? {
            addresses: [{
              selected: true,
              address: {
                deliveryAddress: {
                  firstName: params.address.firstName,
                  lastName: params.address.lastName,
                  address1: params.address.address1,
                  city: params.address.city,
                  provinceCode: params.address.provinceCode,
                  zip: params.address.zip,
                  countryCode: params.address.countryCode || 'US',
                  phone: params.address.phone,
                },
              },
            }],
          } : undefined,
        },
      },
    }),
  });

  const json = await res.json();
  return json?.data?.cartCreate?.cart?.checkoutUrl ?? null;
}

/** Verifies the X-Shopify-Hmac-Sha256 header on inbound webhooks. */
export function verifyWebhookHmac(rawBody: string, hmacHeader: string | null): boolean {
  if (!hmacHeader) return false;
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET || process.env.SHOPIFY_CLIENT_SECRET;
  if (!secret) return false;

  const digest = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));
  } catch {
    return false;
  }
}
