<?php

namespace App\Http\Controllers\Superadmin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Subscription;
use App\Models\Tenant;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Stripe\Stripe;
use Stripe\Customer;
use Stripe\Webhook;

class PaymentGatewayController extends Controller
{
    use ApiResponse;

    public function configureGateway(Request $request, Tenant $tenant): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'payment_gateway' => 'required|in:stripe,razorpay,manual',
        ]);

        if ($validator->fails()) {
            return $this->validationError($validator->errors());
        }

        $tenant->update(['payment_gateway' => $request->payment_gateway]);

        AuditLog::record('tenant.gateway_updated', $tenant, [], ['payment_gateway' => $request->payment_gateway]);

        return $this->success($tenant, 'Payment gateway configured');
    }

    public function stripeWebhook(Request $request): JsonResponse
    {
        $payload = $request->getContent();
        $sigHeader = $request->header('Stripe-Signature');

        try {
            $event = Webhook::constructEvent(
                $payload,
                $sigHeader,
                config('services.stripe.webhook_secret')
            );
        } catch (\Exception $e) {
            return $this->error('Invalid webhook signature', 400);
        }

        match ($event->type) {
            'invoice.payment_succeeded' => $this->handleStripePaymentSucceeded($event->data->object),
            'invoice.payment_failed'    => $this->handleStripePaymentFailed($event->data->object),
            'customer.subscription.deleted' => $this->handleStripeSubscriptionCancelled($event->data->object),
            default => null,
        };

        return $this->success(null, 'Webhook received');
    }

    public function razorpayWebhook(Request $request): JsonResponse
    {
        $signature = $request->header('X-Razorpay-Signature');
        $payload   = $request->getContent();
        $secret    = config('services.razorpay.secret');

        $expectedSignature = hash_hmac('sha256', $payload, $secret);

        if (!hash_equals($expectedSignature, $signature)) {
            return $this->error('Invalid webhook signature', 400);
        }

        $event = $request->input('event');
        $data  = $request->input('payload.subscription.entity');

        if ($event === 'subscription.activated') {
            Subscription::where('gateway_subscription_id', $data['id'])
                ->update(['status' => 'active']);
        }

        if ($event === 'subscription.cancelled') {
            Subscription::where('gateway_subscription_id', $data['id'])
                ->update(['status' => 'cancelled', 'cancelled_at' => now()]);
        }

        return $this->success(null, 'Webhook received');
    }

    public function createStripeCustomer(Tenant $tenant): JsonResponse
    {
        Stripe::setApiKey(config('services.stripe.secret'));

        try {
            $customer = Customer::create([
                'name'  => $tenant->name,
                'email' => $tenant->email,
                'metadata' => ['tenant_id' => $tenant->id],
            ]);

            $subscription = $tenant->subscription;
            if ($subscription) {
                $subscription->update(['gateway_customer_id' => $customer->id]);
            }

            return $this->success(['customer_id' => $customer->id]);
        } catch (\Exception $e) {
            return $this->error('Stripe error: ' . $e->getMessage(), 500);
        }
    }

    private function handleStripePaymentSucceeded(object $invoice): void
    {
        Subscription::where('gateway_subscription_id', $invoice->subscription)
            ->update([
                'status'               => 'active',
                'current_period_end'   => now()->addMonth(),
            ]);
    }

    private function handleStripePaymentFailed(object $invoice): void
    {
        Subscription::where('gateway_subscription_id', $invoice->subscription)
            ->update(['status' => 'past_due']);
    }

    private function handleStripeSubscriptionCancelled(object $sub): void
    {
        Subscription::where('gateway_subscription_id', $sub->id)
            ->update(['status' => 'cancelled', 'cancelled_at' => now()]);
    }
}
