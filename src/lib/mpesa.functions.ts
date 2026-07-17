// M-Pesa Daraja STK Push — TanStack server function
// Ported from the Django MPESA_API repo to Cloudflare Worker runtime (fetch-based).
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const stkInputSchema = z.object({
  orderId: z.string().uuid(),
  phone: z.string().min(9).max(15),
  amount: z.number().int().positive().max(150000),
});

// Safaricom's public sandbox test credentials.
const SANDBOX_SHORTCODE = "174379";
const SANDBOX_PASSKEY =
  "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919";

// Force sandbox mode unless BOTH production shortcode and passkey are provided
// AND MPESA_ENV is explicitly "production".
const prodShortcode = process.env.MPESA_SHORTCODE;
const prodPasskey = process.env.MPESA_PASSKEY;
const hasProdCreds = Boolean(prodShortcode && prodPasskey);
const MPESA_ENV: "sandbox" | "production" =
  process.env.MPESA_ENV === "production" && hasProdCreds
    ? "production"
    : "sandbox";
const HOST =
  MPESA_ENV === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";
const EFFECTIVE_SHORTCODE =
  MPESA_ENV === "production" ? (prodShortcode as string) : SANDBOX_SHORTCODE;
const EFFECTIVE_PASSKEY =
  MPESA_ENV === "production" ? (prodPasskey as string) : SANDBOX_PASSKEY;


function normalizePhone(input: string): string {
  console.log("Normalizing phone input:", input);
  const digits = input.replace(/\D+/g, "");
  console.log("Digits only:", digits);
  
  // Safaricom numbers must start with 254, followed by 7 or 1, then 9 digits
  let msisdn = digits;
  
  if (msisdn.startsWith("254")) {
    // Already in correct format, just ensure it's 12 digits (254 + 9 digits)
    if (msisdn.length === 12) {
      console.log("Phone already correct format:", msisdn);
      return msisdn;
    }
  }
  
  if (msisdn.startsWith("0") && msisdn.length === 10) {
    // Format: 07XXXXXXXX → 2547XXXXXXXX
    msisdn = "254" + msisdn.slice(1);
    console.log("Converted 0-prefixed to 254:", msisdn);
    return msisdn;
  }
  
  if ((msisdn.startsWith("7") || msisdn.startsWith("1")) && msisdn.length === 9) {
    // Format: 7XXXXXXXX → 2547XXXXXXXX
    msisdn = "254" + msisdn;
    console.log("Converted 7/1-prefixed to 254:", msisdn);
    return msisdn;
  }
  
  console.warn("Phone number might be invalid, returning as-is:", msisdn);
  return msisdn;
}

async function getAccessToken(consumerKey: string, consumerSecret: string) {
  const basic = btoa(`${consumerKey}:${consumerSecret}`);
  const url = `${HOST}/oauth/v1/generate?grant_type=client_credentials`;
  console.log("[MPESA] OAuth token request →", url);
  const res = await fetch(url, {
    headers: { Authorization: `Basic ${basic}` },
  });
  const text = await res.text();
  console.log("[MPESA] OAuth response", res.status, text.slice(0, 400));
  if (!res.ok) {
    throw new Error(`Daraja OAuth failed [${res.status}]: ${text.slice(0, 300)}`);
  }
  let data: { access_token?: string };
  try {
    data = JSON.parse(text) as { access_token?: string };
  } catch {
    throw new Error(`Daraja OAuth returned non-JSON: ${text.slice(0, 300)}`);
  }
  if (!data.access_token) {
    throw new Error(`Daraja OAuth missing access_token: ${text.slice(0, 300)}`);
  }
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
    console.log("STK Push initiation started with data:", { ...data, phone: "***" });

    const { orderId, phone, amount } = data;
    const consumerKey = process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    const shortcode = process.env.MPESA_SHORTCODE;
    const passkey = process.env.MPESA_PASSKEY;
    
    // Check if we have valid credentials
    const hasValidCredentials = consumerKey && consumerSecret && shortcode && passkey && consumerKey !== "YOUR_CONSUMER_KEY_HERE" && consumerSecret !== "YOUR_CONSUMER_SECRET_HERE";
    
    if (!hasValidCredentials) {
      console.log("M-Pesa credentials not configured, skipping STK push");
      // Even without credentials, let's create a pending/processing payment record
      const msisdn = normalizePhone(phone);
      await context.supabase.from("payments").insert({
        order_id: orderId,
        customer_id: context.userId,
        amount_kes: amount,
        phone: msisdn,
        status: "pending" as any,
      });



      await context.supabase
        .from("orders")
        .update({
          payment_status: "pending" as any,
          status: "payment_pending",
        })
        .eq("id", orderId);

      return {
        message: "M-Pesa not configured yet, but order is pending payment",
      };
    }

    // Ensure the order belongs to this user
    const { data: order, error: orderErr } = await context.supabase
      .from("orders")
      .select("id, customer_id, fare_kes, order_number")
      .eq("id", orderId)
      .maybeSingle();
    if (orderErr) {
      console.error("Error fetching order:", orderErr);
      throw orderErr;
    }
    if (!order || order.customer_id !== context.userId) {
      console.error("Order not found or unauthorized");
      throw new Error("Order not found");
    }
    console.log("Order found:", { orderId: order.id, orderNumber: order.order_number });

    const msisdn = normalizePhone(phone);
    console.log("Normalized phone number:", msisdn);

    const timestamp = buildTimestamp();
    console.log("Generated timestamp:", timestamp);

    const password = btoa(`${shortcode}${passkey}${timestamp}`);
    console.log("Generated password (masked):", password.slice(0, 5) + "..." + password.slice(-5));

    const token = await getAccessToken(consumerKey, consumerSecret);
    console.log("Access token obtained (masked):", token.slice(0, 10) + "...");

    // Callback URL — derive from the incoming request so Safaricom hits the
    // actual published/preview host (sandbox rejects example.com).
    const forwardedHost = getRequestHeader("x-forwarded-host");
    const host = forwardedHost || getRequestHeader("host");
    const proto = getRequestHeader("x-forwarded-proto") || "https";
    const derivedOrigin = host ? `${proto}://${host}` : null;
    const origin =
      process.env.LOVABLE_PUBLIC_URL ||
      process.env.PUBLIC_BASE_URL ||
      derivedOrigin ||
      "https://nairo-swift-ride.lovable.app";
    const callbackSecret = process.env.MPESA_CALLBACK_SECRET || "";
    const callbackUrl = callbackSecret
      ? `${origin}/api/public/mpesa/callback?token=${encodeURIComponent(callbackSecret)}`
      : `${origin}/api/public/mpesa/callback`;
    console.log("Callback URL (secret masked):", `${origin}/api/public/mpesa/callback`);

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

    const rawText = await stkRes.text();
    console.log("[MPESA] STK push response status:", stkRes.status, "body:", rawText.slice(0, 800));

    let stkJson: {
      MerchantRequestID?: string;
      CheckoutRequestID?: string;
      ResponseCode?: string;
      ResponseDescription?: string;
      errorCode?: string;
      errorMessage?: string;
      requestId?: string;
    } = {};
    try {
      stkJson = JSON.parse(rawText);
    } catch {
      throw new Error(
        `Daraja STK push returned non-JSON [${stkRes.status}]: ${rawText.slice(0, 300)}`
      );
    }

    if (!stkRes.ok || stkJson.ResponseCode !== "0") {
      const parts = [
        stkJson.errorMessage,
        stkJson.errorCode ? `code=${stkJson.errorCode}` : null,
        stkJson.ResponseDescription,
        stkJson.requestId ? `requestId=${stkJson.requestId}` : null,
      ].filter(Boolean);
      const message = parts.length
        ? parts.join(" | ")
        : `STK push failed [${stkRes.status}]: ${rawText.slice(0, 200)}`;
      console.error("[MPESA] STK push failed:", message);
      throw new Error(`M-Pesa: ${message}`);
    }

    // Record the pending/processing payment attempt.
    // Create a new payment row per STK push (so retries create fresh checkout IDs).
    await context.supabase.from("payments").insert({
      order_id: orderId,
      customer_id: context.userId,
      amount_kes: amount,
      phone: msisdn,
      checkout_request_id: stkJson.CheckoutRequestID ?? null,
      merchant_request_id: stkJson.MerchantRequestID ?? null,
      status: "pending",

    });
    console.log("Payment record inserted");

    await context.supabase
      .from("orders")
      .update({
        payment_status: "pending",
        mpesa_checkout_request_id: stkJson.CheckoutRequestID ?? null,
        status: "payment_pending",
      })
      .eq("id", orderId);
    console.log("Order status updated to payment_pending");


    return {
      checkoutRequestId: stkJson.CheckoutRequestID,
      merchantRequestId: stkJson.MerchantRequestID,
      message: stkJson.ResponseDescription ?? "STK push sent. Check your phone.",
    };
  });

export const checkMpesaConfig = createServerFn({ method: "GET" })
  .handler(async () => {
    const consumerKey = process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    const shortcode = process.env.MPESA_SHORTCODE;
    const passkey = process.env.MPESA_PASSKEY;
    
    const isConfigured = 
      consumerKey && consumerSecret && shortcode && passkey && 
      consumerKey !== "YOUR_CONSUMER_KEY_HERE" && 
      consumerSecret !== "YOUR_CONSUMER_SECRET_HERE";
    
    return {
      isConfigured,
      env: process.env.MPESA_ENV || "sandbox",
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
