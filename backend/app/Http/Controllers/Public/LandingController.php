<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Validator;

class LandingController extends Controller
{
    public function contact(Request $request)
    {
        $v = Validator::make($request->all(), [
            'name'    => 'required|string|max:100',
            'email'   => 'required|email|max:150',
            'phone'   => 'nullable|string|max:20',
            'outlets' => 'nullable|string|max:50',
            'type'    => 'nullable|string|max:50',
            'message' => 'nullable|string|max:2000',
        ]);

        if ($v->fails()) {
            return response()->json(['status' => false, 'errors' => $v->errors()], 422);
        }

        $data = $v->validated();

        Mail::send([], [], function ($m) use ($data) {
            $m->to('hirehimanshuragi@gmail.com')
              ->replyTo($data['email'], $data['name'])
              ->subject('New Contact — Magic Management Website')
              ->html($this->contactHtml($data));
        });

        return response()->json(['status' => true, 'message' => 'Message sent successfully.']);
    }

    public function bookDemo(Request $request)
    {
        $v = Validator::make($request->all(), [
            'name'  => 'required|string|max:100',
            'email' => 'required|email|max:150',
            'phone' => 'required|string|max:20',
            'date'  => 'required|string|max:50',
            'slot'  => 'required|string|max:20',
            'page'  => 'nullable|string|max:50',
        ]);

        if ($v->fails()) {
            return response()->json(['status' => false, 'errors' => $v->errors()], 422);
        }

        $data = $v->validated();

        Mail::send([], [], function ($m) use ($data) {
            $m->to('hirehimanshuragi@gmail.com')
              ->replyTo($data['email'], $data['name'])
              ->subject('Demo Booking — ' . $data['date'] . ' ' . $data['slot'])
              ->html($this->bookingHtml($data));
        });

        // Send confirmation to the customer
        Mail::send([], [], function ($m) use ($data) {
            $m->to($data['email'], $data['name'])
              ->from('hirehimanshuragi@gmail.com', 'Magic Management')
              ->subject('Your demo is confirmed — ' . $data['date'] . ' at ' . $data['slot'])
              ->html($this->confirmationHtml($data));
        });

        return response()->json(['status' => true, 'message' => 'Demo booked successfully.']);
    }

    private function contactHtml(array $d): string
    {
        $outlets = $d['outlets'] ?? '—';
        $type    = $d['type']    ?? '—';
        $message = nl2br(htmlspecialchars($d['message'] ?? ''));
        $name    = htmlspecialchars($d['name']);
        $email   = htmlspecialchars($d['email']);
        $phone   = htmlspecialchars($d['phone'] ?? '—');

        return <<<HTML
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;padding:32px;border-radius:12px">
          <div style="background:linear-gradient(135deg,#F97316,#EF4444);padding:24px;border-radius:8px;margin-bottom:24px">
            <h1 style="color:white;margin:0;font-size:20px">New Contact Form Submission</h1>
            <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:13px">Magic Management Website</p>
          </div>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px;width:130px">Name</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;font-weight:600;color:#1e293b">{$name}</td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px">Email</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#1e293b"><a href="mailto:{$email}" style="color:#F97316">{$email}</a></td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px">Phone</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#1e293b">{$phone}</td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px">Property Type</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#1e293b">{$type}</td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px">Outlets</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#1e293b">{$outlets}</td></tr>
            <tr><td style="padding:10px 0;color:#64748b;font-size:13px;vertical-align:top">Message</td><td style="padding:10px 0;color:#1e293b;line-height:1.6">{$message}</td></tr>
          </table>
        </div>
        HTML;
    }

    private function bookingHtml(array $d): string
    {
        $name  = htmlspecialchars($d['name']);
        $email = htmlspecialchars($d['email']);
        $phone = htmlspecialchars($d['phone']);
        $date  = htmlspecialchars($d['date']);
        $slot  = htmlspecialchars($d['slot']);
        $page  = htmlspecialchars($d['page'] ?? 'Main');

        return <<<HTML
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;padding:32px;border-radius:12px">
          <div style="background:linear-gradient(135deg,#F97316,#EF4444);padding:24px;border-radius:8px;margin-bottom:24px">
            <h1 style="color:white;margin:0;font-size:20px">New Demo Booking</h1>
            <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:13px">Magic Management — {$page} page</p>
          </div>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px;width:130px">Name</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;font-weight:600;color:#1e293b">{$name}</td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px">Email</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#1e293b"><a href="mailto:{$email}" style="color:#F97316">{$email}</a></td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px">Phone</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#1e293b"><a href="tel:{$phone}" style="color:#F97316">{$phone}</a></td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px">Date</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;font-weight:600;color:#1e293b">{$date}</td></tr>
            <tr><td style="padding:10px 0;color:#64748b;font-size:13px">Time</td><td style="padding:10px 0;font-weight:600;color:#1e293b">{$slot}</td></tr>
          </table>
        </div>
        HTML;
    }

    private function confirmationHtml(array $d): string
    {
        $name = htmlspecialchars($d['name']);
        $date = htmlspecialchars($d['date']);
        $slot = htmlspecialchars($d['slot']);

        return <<<HTML
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;padding:32px;border-radius:12px">
          <div style="background:linear-gradient(135deg,#F97316,#EF4444);padding:24px;border-radius:8px;margin-bottom:24px">
            <h1 style="color:white;margin:0;font-size:20px">Your demo is confirmed!</h1>
            <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:13px">Magic Management</p>
          </div>
          <p style="color:#1e293b;font-size:15px">Hi {$name},</p>
          <p style="color:#475569;line-height:1.7">Your demo has been booked. Here are your details:</p>
          <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:20px 0">
            <p style="margin:0 0 8px;color:#64748b;font-size:13px">DATE &amp; TIME</p>
            <p style="margin:0;font-size:20px;font-weight:700;color:#1e293b">{$date} &nbsp;·&nbsp; {$slot}</p>
          </div>
          <p style="color:#475569;line-height:1.7">Our team will call you at the scheduled time. If you need to reschedule, just reply to this email.</p>
          <p style="color:#475569">— Team Magic Management</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
          <p style="color:#94a3b8;font-size:12px;margin:0">Magic Management · hello@magicmanagement.in · +91 93014 20919</p>
        </div>
        HTML;
    }
}
