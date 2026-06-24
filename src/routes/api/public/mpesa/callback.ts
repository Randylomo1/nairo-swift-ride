import { createFileRoute } from "@tanstack/react-router";

// Safaricom Daraja calls this after the customer responds to the STK prompt.
// Use service role to update payments + orders (RLS-bypass write).
export const Route = createFileRoute("/api/public/mpesa/callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            Body?: {
              stkCallback?: {
                MerchantRequestID?: string;
                CheckoutRequestID?: string;
                ResultCode?: number;
                ResultDesc?: string;
                CallbackMetadata?: { Item?: Array<{ Name: string; Value?: string | number }> };
              };
            };
          };
          const cb = body?.Body?.stkCallback;
          if (!cb?.CheckoutRequestID) {
            return new Response(JSON.stringify({ ok: false }), { status: 400 });
          }
          const checkoutId = cb.CheckoutRequestID;
          const success = cb.ResultCode === 0;
          let receipt: string | undefined;
          if (cb.CallbackMetadata?.Item) {
            const item = cb.CallbackMetadata.Item.find((i) => i.Name === "MpesaReceiptNumber");
            if (item?.Value) receipt = String(item.Value);
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const { data: payment } = await supabaseAdmin
            .from("payments")
            .update({
              status: success ? "success" : "failed",
              mpesa_receipt: receipt ?? null,
              result_desc: cb.ResultDesc ?? null,
            })
            .eq("checkout_request_id", checkoutId)
            .select("order_id")
            .maybeSingle();

          if (payment?.order_id) {
            await supabaseAdmin
              .from("orders")
              .update({
                payment_status: success ? "success" : "failed",
                mpesa_receipt: receipt ?? null,
                status: success ? "paid" : "created",
              })
              .eq("id", payment.order_id);
          }

          return new Response(
            JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }),
            { headers: { "Content-Type": "application/json" } }
          );
        } catch (err) {
          console.error("M-Pesa callback error", err);
          return new Response(JSON.stringify({ ResultCode: 1, ResultDesc: "Error" }), {
            status: 200,
          });
        }
      },
      GET: async () =>
        new Response("M-Pesa callback endpoint", { headers: { "Content-Type": "text/plain" } }),
    },
  },
});
