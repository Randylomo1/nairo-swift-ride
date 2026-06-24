// M-Pesa Daraja STK Push — TanStack server function
// Ported from the Django MPESA_API repo to Cloudflare Worker runtime (fetch-based).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const stkInputSchema = z.object({
  orderId: z.string().uuid(),
  phone: z.string().min(9).max(15),
  amount: z.number().int().positive().max(150000),
});

const env = "sandbox"; // change to "production" when going live

const HOST =
  env === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";

function normalizePhone(input: string): string {
  const digits = input.replace(/\D+/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return "254" + digits.slice(1);
  if (digits.startsWith("7") || digits.startsWith("1")) return "254" + digits;
  return digits;
}

async function getAccessToken(consumerKey: string, consumerSecret: string) {
  const basic = btoa(`${consumerKey}:${consumerSecret}`);
  const res = await fetch(`${HOST}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${basic}` },
  });
  if (!res.ok) throw new Error(`Daraja token failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

function buildTimestamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

export const initiateStkPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => stkInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { orderId, phone, amount } = data;
    const consumerKey = process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    const shortcode = process.env.MPESA_SHORTCODE;
    const passkey = process.env.MPESA_PASSKEY;
    if (!consumerKey || !consumerSecret || !shortcode || !passkey) {
      throw new Error("M-Pesa credentials are not configured");
    }

    // Ensure the order belongs to this user
    const { data: order, error: orderErr } = await context.supabase
      .from("orders")
      .select("id, customer_id, fare_kes, order_number")
      .eq("id", orderId)
      .maybeSingle();
    if (orderErr) throw orderErr;
    if (!order || order.customer_id !== context.userId) throw new Error("Order not found");

    const msisdn = normalizePhone(phone);
    const timestamp = buildTimestamp();
    const password = btoa(`${shortcode}${passkey}${timestamp}`);

    const token = await getAccessToken(consumerKey, consumerSecret);

    // Callback URL — public TSS route handles Daraja's callback
    const origin =
      process.env.LOVABLE_PUBLIC_URL ||
      process.env.PUBLIC_BASE_URL ||
      "https://example.com";
    const callbackUrl = `${origin}/api/public/mpesa/callback`;

    const stkRes = await fetch(`${HOST}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: amount,
        PartyA: msisdn,
        PartyB: shortcode,
        PhoneNumber: msisdn,
        CallBackURL: callbackUrl,
        AccountReference: order.order_number,
        TransactionDesc: `Urban Courier ${order.order_number}`,
      }),
    });

    const stkJson = (await stkRes.json()) as {
      MerchantRequestID?: string;
      CheckoutRequestID?: string;
      ResponseCode?: string;
      ResponseDescription?: string;
      errorMessage?: string;
    };

    if (!stkRes.ok || stkJson.ResponseCode !== "0") {
      const message = stkJson.errorMessage || stkJson.ResponseDescription || "STK push failed";
      throw new Error(message);
    }

    // Record the pending payment
    await context.supabase.from("payments").insert({
      order_id: orderId,
      customer_id: context.userId,
      amount_kes: amount,
      phone: msisdn,
      checkout_request_id: stkJson.CheckoutRequestID ?? null,
      merchant_request_id: stkJson.MerchantRequestID ?? null,
      status: "pending",
    });

    await context.supabase
      .from("orders")
      .update({
        payment_status: "pending",
        mpesa_checkout_request_id: stkJson.CheckoutRequestID ?? null,
        status: "payment_pending",
      })
      .eq("id", orderId);

    return {
      checkoutRequestId: stkJson.CheckoutRequestID,
      merchantRequestId: stkJson.MerchantRequestID,
      message: stkJson.ResponseDescription ?? "STK push sent. Check your phone.",
    };
  });

export const checkPaymentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ orderId: z.string().uuid() }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { data: order } = await context.supabase
      .from("orders")
      .select("id, payment_status, mpesa_receipt, status")
      .eq("id", data.orderId)
      .eq("customer_id", context.userId)
      .maybeSingle();
    return order;
  });
