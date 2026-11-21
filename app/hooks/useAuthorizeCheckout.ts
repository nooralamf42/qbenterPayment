import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export const useAuthorizeCheckout = () => {
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();
  const localOrderIdRef = useRef<string | null>(null);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (!event.data) return;

      if (event.data.source === 'authnet-complete') {
        const { transId, syncSuccess } = event.data;

        if (syncSuccess) {
          const popup = document.getElementById('authnet-popup-overlay');
          if (popup) popup.remove();
          router.push('/payment-success');
          return;
        }

        const orderId = localOrderIdRef.current;
        if (transId && orderId) {
          try {
            await fetch('/api/authorize/sync-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ transactionId: transId, localOrderId: orderId })
            });
          } catch (e) {
            console.error('[AuthNet] Fallback sync failed', e);
          }
        }

        const popup = document.getElementById('authnet-popup-overlay');
        if (popup) popup.remove();
        router.push('/payment-success');
        return;
      }

      if (event.data.source !== 'authnet-communicator') return;

      const qstr: string = event.data.qstr || '';
      const params = new URLSearchParams(qstr);
      const action = params.get('action');

      if (action === 'successfulSave' || action === 'transactResponse') {
        const popup = document.getElementById('authnet-popup-overlay');
        if (popup) popup.remove();
        router.push('/payment-success');
      } else if (action === 'cancel') {
        const popup = document.getElementById('authnet-popup-overlay');
        if (popup) popup.remove();
        setIsPending(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [router]);

  const checkout = async (checkoutData: {
    productPath?: string;
    quantity?: number;
    amountUSD?: number;
    firstName?: string;
    lastName?: string;
    email?: string;
    companyName?: string;
    ein?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
    agreedToTerms?: string;
    clientSignatureBase64?: string;
    planDetails?: string;
    linkToken?: string;
  }) => {
    setIsPending(true);

    try {
      const response = await fetch('/api/authorize/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkoutData)
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to initialize payment.');
      }

      const { token, localOrderId } = await response.json();
      localOrderIdRef.current = localOrderId || null;

      const existing = document.getElementById('authnet-popup-overlay');
      if (existing) existing.remove();

      const overlay = document.createElement('div');
      overlay.id = 'authnet-popup-overlay';
      overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(0,0,0,0.65); z-index: 99999;
        display: flex; align-items: center; justify-content: center;
        padding: 16px; box-sizing: border-box; backdrop-filter: blur(2px);
      `;

      const container = document.createElement('div');
      container.style.cssText = `
        position: relative; width: 100%; max-width: 580px; height: 680px; max-height: 95vh;
        background: #fff; border-radius: 12px; box-shadow: 0 25px 60px rgba(0,0,0,0.35);
        overflow: hidden; display: flex; flex-direction: column;
      `;

      const header = document.createElement('div');
      header.style.cssText = `
        display: flex; align-items: center; justify-content: space-between;
        padding: 14px 20px; border-bottom: 1px solid #e5e7eb; background: #f9fafb; flex-shrink: 0;
      `;
      header.innerHTML = `
        <span style="font-weight: 600; font-size: 15px; color: #111827;">Secure Checkout</span>
        <button id="authnet-close-btn" style="
          background: none; border: none; cursor: pointer; color: #6b7280; font-size: 20px; line-height: 1; padding: 2px 6px; border-radius: 4px;
        ">&times;</button>
      `;

      const iframe = document.createElement('iframe');
      iframe.name = 'load_payment';
      iframe.id = 'load_payment';
      iframe.style.cssText = `width: 100%; flex: 1; border: none;`;

      container.appendChild(header);
      container.appendChild(iframe);
      overlay.appendChild(container);
      document.body.appendChild(overlay);

      header.querySelector('#authnet-close-btn')?.addEventListener('click', () => {
        overlay.remove();
        setIsPending(false);
      });

      const isLive = process.env.NEXT_PUBLIC_AUTHORIZE_MODE === 'production';
      const actionUrl = isLive
        ? 'https://accept.authorize.net/payment/payment'
        : 'https://test.authorize.net/payment/payment';

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = actionUrl;
      form.target = 'load_payment';
      form.style.display = 'none';

      const tokenInput = document.createElement('input');
      tokenInput.type = 'hidden';
      tokenInput.name = 'token';
      tokenInput.value = token;
      form.appendChild(tokenInput);

      document.body.appendChild(form);
      form.submit();
      form.remove();

    } catch (err: any) {
      setIsPending(false);
      throw err;
    }
  };

  return { checkout, isPending };
};

