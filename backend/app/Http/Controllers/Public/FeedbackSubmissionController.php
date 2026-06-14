<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Models\FeedbackQrCode;
use App\Models\FeedbackSubmission;
use App\Models\SystemSetting;
use App\Models\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FeedbackSubmissionController extends Controller
{
    private function suspendedResponse(Tenant $tenant): \Illuminate\Http\JsonResponse
    {
        $settings = SystemSetting::allAsMap();
        return response()->json([
            'status'      => false,
            'message'     => 'tenant_suspended',
            'tenant_name' => $tenant->name,
            'branding'    => [
                'brand_name'       => $settings['brand_name']       ?? null,
                'brand_logo_url'   => isset($settings['brand_logo']) ? asset('storage/' . $settings['brand_logo']) : null,
                'contact_phone'    => $settings['contact_phone']    ?? null,
                'contact_whatsapp' => $settings['contact_whatsapp'] ?? null,
                'contact_email'    => $settings['contact_email']    ?? null,
                'sales_tagline'    => $settings['sales_tagline']    ?? null,
            ],
        ], 410);
    }

    public function show(string $token): JsonResponse
    {
        $qr = FeedbackQrCode::where('qr_token', $token)->where('is_active', true)->first();

        if (!$qr) {
            return response()->json(['status' => false, 'message' => 'Invalid or inactive QR code'], 404);
        }

        $tenant = Tenant::find($qr->tenant_id);

        if ($tenant->status === 'suspended') {
            return $this->suspendedResponse($tenant);
        }

        return response()->json([
            'status' => true,
            'data'   => [
                'tenant_name'       => $tenant->name,
                'placement'         => $qr->placement,
                'label'             => $qr->label,
                'google_review_url' => $tenant->google_review_url,
            ],
        ]);
    }

    public function submit(Request $request, string $token): JsonResponse
    {
        $qr = FeedbackQrCode::where('qr_token', $token)->where('is_active', true)->first();

        if (!$qr) {
            return response()->json(['status' => false, 'message' => 'Invalid QR code'], 404);
        }

        $tenant = Tenant::find($qr->tenant_id);
        if ($tenant->status === 'suspended') {
            return $this->suspendedResponse($tenant);
        }

        $data = $request->validate([
            'rating'           => 'required|integer|min:1|max:5',
            'comment'          => 'nullable|string|max:1000',
            'submitter_name'   => 'nullable|string|max:100',
            'submitter_phone'  => 'nullable|regex:/^[6-9]\d{9}$/',
        ]);

        $isInternal = $data['rating'] <= 3;

        $submission = FeedbackSubmission::create([
            'tenant_id'           => $qr->tenant_id,
            'feedback_qr_code_id' => $qr->id,
            'rating'              => $data['rating'],
            'comment'             => $data['comment'] ?? null,
            'is_internal'         => $isInternal,
            'submitter_name'      => $data['submitter_name'] ?? null,
            'submitter_phone'     => $data['submitter_phone'] ?? null,
            'ip_address'          => $request->ip(),
        ]);

        return response()->json([
            'status' => true,
            'data'   => [
                'id'                => $submission->id,
                'rating'            => $submission->rating,
                'is_internal'       => $isInternal,
                'google_review_url' => $isInternal ? null : $tenant->google_review_url,
                'tenant_name'       => $tenant->name,
            ],
        ]);
    }

    public function aiSuggestions(Request $request, string $token): JsonResponse
    {
        $qr = FeedbackQrCode::where('qr_token', $token)->where('is_active', true)->first();
        if (!$qr) {
            return response()->json(['status' => false, 'message' => 'Invalid QR code'], 404);
        }

        $tenant = Tenant::find($qr->tenant_id);

        $domain = $tenant->business_domain ?? '';

        // Feature not enabled for this tenant — still show domain-aware static suggestions
        if (!$tenant->ai_suggestions_enabled) {
            return response()->json(['status' => true, 'data' => [
                'suggestions' => $this->threeUniqueStatics($domain),
                'ai_enabled'  => false,
            ]]);
        }

        // Reset monthly counter on first call of a new month
        $today = now()->startOfMonth()->toDateString();
        if ($tenant->ai_usage_reset_at === null || $tenant->ai_usage_reset_at->toDateString() < $today) {
            $tenant->update(['ai_usage_this_month' => 0, 'ai_usage_reset_at' => $today]);
            $tenant->refresh();
        }

        // Quota exhausted — return fallback silently (still show suggestions, just not AI)
        if ($tenant->ai_usage_this_month >= $tenant->ai_monthly_quota) {
            return response()->json(['status' => true, 'data' => [
                'suggestions' => $this->threeUniqueStatics($domain),
                'ai_enabled'  => false,
            ]]);
        }

        // Build a meaningful domain label for the AI prompt.
        // If domain is a known key (restaurant, hotel, etc.) use it directly.
        // If it looks like free-text (i.e. not in the known list), pass it verbatim so AI
        // generates domain-specific copy even for non-standard business types.
        $knownDomains  = ['restaurant','hotel','cafe','bar','bakery','clinic','dentist','salon','gym','retail','barber'];
        $domainForAi   = in_array($domain, $knownDomains) ? $domain : ($domain ?: 'business');

        // 1 AI review + 2 unique static reviews — saves tokens, stays fresh
        $aiReview      = $this->generateOneLiveSuggestion($tenant->name, $domainForAi);
        $staticTwo     = $this->twoUniqueStatics($domain);
        $suggestions   = array_values(array_merge([$aiReview], $staticTwo));

        $tenant->increment('ai_usage_this_month');

        return response()->json(['status' => true, 'data' => [
            'suggestions' => $suggestions,
            'ai_enabled'  => true,
        ]]);
    }

    private function generateOneLiveSuggestion(string $businessName, string $domain): string
    {
        $apiKey = config('services.openai.api_key');
        if (!$apiKey) {
            return $this->staticPool()[array_rand($this->staticPool())];
        }

        $langs = ['English', 'Hinglish', 'Hindi'];
        $lang  = $langs[array_rand($langs)];
        $seed  = substr(md5(uniqid('', true)), 0, 8);

        $prompt = "One short Google review for \"{$businessName}\" ({$domain}). Language: {$lang}. Max 18 words. Natural, specific, no emojis, no names. Seed:{$seed}. Return only the plain review text, nothing else.";

        $ch = curl_init('https://api.openai.com/v1/chat/completions');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $apiKey, 'Content-Type: application/json'],
            CURLOPT_POSTFIELDS     => json_encode([
                'model'       => 'gpt-4o-mini',
                'messages'    => [['role' => 'user', 'content' => $prompt]],
                'max_tokens'  => 40,
                'temperature' => 1.2,
            ]),
            CURLOPT_TIMEOUT => 15,
        ]);

        $response = curl_exec($ch);
        $err      = curl_error($ch);
        curl_close($ch);

        if ($err || !$response) {
            return $this->staticPool()[array_rand($this->staticPool())];
        }

        try {
            $parsed  = json_decode($response, true);
            $content = trim($parsed['choices'][0]['message']['content'] ?? '');
            // Strip any accidental quotes GPT wraps around the text
            $content = trim($content, '"\'');
            if (strlen($content) > 5) return $content;
        } catch (\Throwable) {}

        return $this->staticPool()[array_rand($this->staticPool())];
    }

    private function twoUniqueStatics(string $domain = ''): array
    {
        $pool = $this->domainPool($domain);
        shuffle($pool);
        return array_slice($pool, 0, 2);
    }

    private function threeUniqueStatics(string $domain = ''): array
    {
        $pool = $this->domainPool($domain);
        shuffle($pool);
        return array_slice($pool, 0, 3);
    }

    // Returns the domain-specific pool, falling back to generic only for unknown/other domains.
    private function domainPool(string $domain): array
    {
        $pools = $this->allDomainPools();
        return $pools[$domain] ?? $pools['_generic'];
    }

    private function allDomainPools(): array
    {
        return [
            'restaurant' => [
                "Visited with family last Sunday — the dal makhani and butter naan were absolutely spot on. Felt like ghar ka khana honestly.",
                "Been coming here for 2 years now and the quality has never dropped. The owner personally comes and checks on everyone.",
                "Ordered the thali and it was so filling, I couldn't eat dinner that night! Great value for money, portions are very generous.",
                "The biryani here is the real deal — not the hotel-style watered down version. Properly cooked, full of flavour.",
                "Fast service even on a busy Saturday evening. Food came hot and fresh within 20 minutes. Will definitely come again.",
                "The paneer dishes are exceptional — soft, fresh, and full of masala. Finally found a place that doesn't compromise on taste.",
                "Amazing ambiance, great AC, and the food quality is consistently excellent. Exactly what you want after a long day.",
                "Great for both veg and non-veg eaters. My whole friend group comes here because everyone finds something they love.",
                "The chole bhature here is something else — fluffy bhature, perfectly spiced chole. Definitely worth the visit.",
                "First time visit but won't be the last. The waiter helped me pick what to order. Felt very welcome.",
                "Very clean kitchen and dining area — could see from the open kitchen setup. Made us feel confident about the food.",
                "The dosa is crispy on the outside and perfectly thin — not the thick spongy kind. Authentic preparation, loved it.",
                "The murgh makhani here beats anything I've had at five-star restaurants. Rich, creamy, and full of flavour.",
                "No compromise on cleanliness. Tables are wiped immediately, floors are clean, and the washroom is well maintained.",
                "Even during peak hours the kitchen doesn't slow down. Food arrives quickly and tastes like it was cooked fresh.",
                "Bhai biryani ekdum mast thi, seriously. Dosto ke saath aaya tha, sabne enjoy kiya. Full paisa vasool.",
                "Ghar ke khane jaisa taste tha. Dal chawal itne simple the but itne tasty — yahi toh asli khana hai.",
                "Bhai paneer butter masala aur naan — bas itna hi order karo aur zindagi set hai. Must try seriously.",
                "Dosto ke saath teen baar aa chuka hun. Har baar same quality. Isi liye toh recommend karta hun sabko.",
                "Owner khud aa ke puchha kaisa laga — yahi cheez alag karti hai is jagah ko. Real care dikhta hai.",
            ],
            'hotel' => [
                "Checked in after a very long journey and the front desk staff were so helpful — even arranged early check-in without extra charge.",
                "The room was spotless and the AC was perfectly cool. Slept like a baby after a hectic day of travel.",
                "Breakfast buffet is excellent — hot items kept replenished, fresh juice, and the staff is proactive.",
                "The housekeeping team did an amazing job — room was cleaned twice a day and fresh towels provided without asking.",
                "Checked out smoothly, no billing issues, no hidden charges. Appreciated the transparency and professionalism.",
                "Power backup was instant during the brief outage — shows the hotel is well managed. No inconvenience at all.",
                "Very value-for-money compared to other hotels in this price range. Quality easily matches places that charge double.",
                "Had a small issue with the geyser and they fixed it within 15 minutes of calling the front desk.",
                "Late checkout was granted without any fuss when we requested it. Small gesture but makes a big difference.",
                "The property is well-maintained and secure. Felt very safe throughout the stay.",
                "Room service was prompt and the food quality was surprisingly good. Expected average hotel food but got much better.",
                "The bed linen is fresh and well-pressed. These details reflect a hotel that actually cares about the guest experience.",
                "Bhai hotel ekdum mast hai. Room clean tha, AC perfect tha, aur staff ne koi problem nahi hone di. Full recommend.",
                "Check-in ke time early arrival tha, bina extra charge ke room de diya. Yeh cheez bahut rare hai hotels mein.",
                "Room service ka khana surprisingly acha tha. Normally hotel food average hota hai but yahaan genuinely tasty tha.",
                "WiFi full speed tha pure property mein. Work trip thi, yeh sab se important tha. Ekdum perfect.",
                "Housekeeping wale ne room ekdum chamka ke rakha tha. Fresh towels, clean bedsheet — sab set tha.",
                "Station se paidal distance mein hai. Late night train thi, tension nahi thi cab ki. Bahut convenient location.",
                "Pillows aur mattress genuinely comfortable the. Finally ek hotel jisne bedding pe properly invest kiya hai.",
                "Honestly soch ke nahi aaya tha itna acha hoga is price range mein. Pleasantly surprised. Will book again.",
            ],
            'cafe' => [
                "The cold coffee here is hands down the best in the city. Thick, creamy, not too sweet — exactly how it should be.",
                "Came to study here on a weekday and stayed for 4 hours. Free WiFi, comfortable seating, and nobody rushed me.",
                "The staff is super friendly and remembered my usual order by the third visit. That small thing makes a big difference.",
                "Perfect spot for a first date — cozy lighting, not too loud, and the desserts are beautiful.",
                "The matcha latte here is actually made with real matcha, not powder. You can taste the quality immediately.",
                "The croissants are baked fresh every morning — buttery, flaky, and not overly sweet. Absolute joy with the coffee.",
                "Great place to catch up with old friends. The background music is just right — not too loud to talk over.",
                "Even on a busy weekend afternoon, the service was quick and the order was correct. Efficient team.",
                "Clean washrooms, reliable WiFi, fresh food — the three things a cafe must get right, and they nail all three.",
                "The filter coffee here is proper south Indian style — strong, hot, frothy. Haven't found better outside Chennai.",
                "Brought my laptop for a work session and the plug points near every seat made it so convenient.",
                "The cheesecake here is genuinely restaurant-quality. Light, not too dense, with a perfect biscuit base.",
                "Bhai cold coffee pee ke life set ho gayi. Itni thick aur creamy thi, bahar se lene ki zaroorat hi nahi.",
                "College ke baad yahan aa ke baithna has become a routine. Sasta hai, WiFi hai, koi rush nahi karta. Perfect.",
                "Barista ne meri coffee exact waisi banayi jo maine describe ki thi. Skill chahiye yeh karne ke liye. Impressed.",
                "Waffles mein itna generous topping tha, seriously ek order mein pet bhar gaya. Koi cheating nahi karte yahan.",
                "Matcha latte real matcha se bani thi, powder se nahi. Farak immediately taste mein pata chala. Good quality.",
                "Staff ne teesri visit pe mera usual order yaad rakha tha. Choti si baat hai but bahut warmth feel hoti hai.",
                "Terrace pe shaam ko fairy lights, thandi hawa, aur acha coffee — yaar kya scene tha. Wapas zaroor aaunga.",
                "Chai latte try ki pehli baar — masala chai aur latte ka combination genuinely acha laga. Unique hai yeh.",
            ],
            'bar' => [
                "The cocktails here are expertly crafted — not the pre-mixed stuff you get elsewhere. The bartender knows his work.",
                "Came on a Friday night and despite being packed, service was fast and the drinks were never watered down.",
                "Best whisky collection in the city. The staff guided me through the single malts without being pushy.",
                "The rooftop seating area has an amazing view of the city lights. Perfect setting for a relaxed evening.",
                "Tried the house special cocktail and it was genuinely unique — not just a regular drink with a fancy name.",
                "The mocktail menu is just as impressive as the cocktail menu. My friend who doesn't drink was equally happy.",
                "The food menu is solid — not just bar snacks. Had proper meals and they were really well made.",
                "The music volume is perfect — loud enough to have fun but you can still have a conversation.",
                "The staff remembered our preferences from last time without us mentioning it. That's how loyalty is built.",
                "Great for corporate team outings — private booth available, staff is discreet and professional.",
                "The draught beer is always fresh and cold. The glasses are properly chilled too — little details that matter.",
                "Happy hours are genuinely good value. Came in for one drink and stayed for three. No regrets.",
                "Bhai bartender ne cocktail ekdum perfectly banaya. Pre-mixed wala drama nahi tha yahan — real craft hai.",
                "Friday night ko bhi service fast thi, drinks watered down nahi the. Packed tha fir bhi quality same rahi.",
                "Whisky collection dekh ke aankh khul gayi yaar. Single malts bhi the, pushy bhi nahi kiya. Mast.",
                "Rooftop pe baith ke city lights dekhe, drink haath mein tha — seriously what a vibe. Full enjoy.",
                "Meri friend drink nahi karti, uske liye bhi bohot options the mocktail mein. Inclusive place hai yeh.",
                "Food bhi order kiya saath mein — bar ka khana usually average hota hai but yahaan genuinely tasty tha.",
                "Birthday celebrate kiya yahan — team ne surprise dessert diya bina kuch maange. Really touched hua.",
                "Tab settle karna quick tha, bill accurate tha. Koi hidden charges nahi. Honest place hai yeh.",
            ],
            'bakery' => [
                "The pav here is softer than anything you'll find in a supermarket — fresh out of the oven, slightly warm.",
                "Ordered a custom birthday cake and it looked exactly like the picture I shared. Tasted even better than it looked.",
                "The khari biscuits and chai combo here is unbeatable. My morning routine now — stop here before office every day.",
                "The plum cake during Christmas was exceptional — rich, moist, and full of fruit. Pre-ordered for the whole family.",
                "The bread is baked fresh twice a day and you can tell — no staleness, no artificial smell, just proper bread.",
                "Very hygienic setup — everything wrapped properly, staff wearing gloves, clean display cases. Felt confident buying.",
                "Reasonably priced and the portions are generous. A 500g cake easily fed 8 people at our gathering.",
                "The chocolate truffle cake is dangerously good — rich ganache, moist sponge, and not overly sweet.",
                "The bun maska here with Irani chai is the ultimate comfort combo. A classic experience done perfectly.",
                "The jeera biscuits here are addictive — crisp, perfectly salted, and pair beautifully with chai.",
                "Fresh cream pastries are made fresh every morning — no stale cream or dry sponge. Genuinely fresh.",
                "Brownies here are fudgy and rich, not cakey — exactly how a brownie should be. Been recommending to everyone.",
                "Bhai pav itna soft tha ki seedha samajh aaya — yahaan fresh banta hai. Supermarket wala nahi.",
                "Birthday cake order ki thi, photo share ki thi reference ke liye — exactly waisi bani. Taste bhi mast tha.",
                "Khari biscuit aur chai — roz subah office jaate waqt yahaan ruk jaata hun. Life set hai bhai.",
                "Display mein sab itna fresh dikh raha tha ki plan se zyada le liya. Koi regret nahi, sab khatam bhi ho gaya.",
                "Owner khud present tha aur har item ke baare mein bata raha tha. Yeh passion dikhta hai quality mein.",
                "Cream rolls yahaan ki famous hain area mein, log door se aate hain sirf inke liye. Try karo ek baar.",
                "Diwali pe kaju katli yahan ki li — homemade jaisi quality thi, market wali artificial taste bilkul nahi.",
                "Ek saal se aa raha hun, ek bhi baar disappointed nahi hua. Consistency hi inki sabse badi quality hai.",
            ],
            'clinic' => [
                "The doctor actually listened to everything I said without rushing me. Spent a good 20 minutes understanding the issue.",
                "Got my reports the same day and the doctor called personally to explain the results. That follow-up is very rare.",
                "The doctor didn't over-prescribe. Gave a practical treatment plan without recommending unnecessary tests.",
                "Clean, sanitized environment. Felt safe bringing my elderly parents here.",
                "The paediatrician here is exceptional with children. My 4-year-old has no fear of visiting the doctor anymore.",
                "Emergency consultations handled promptly. When I called at 8 PM, the doctor returned my call within 10 minutes.",
                "Very straightforward about fees upfront. No surprise charges after the consultation. Transparent and professional.",
                "The nursing staff is compassionate and skilled. Injections are genuinely painless.",
                "The doctor remembered details from my last visit without checking notes. Shows genuine interest in patient history.",
                "Very practical about medication — prescribed generics where possible to keep costs down.",
                "Doctor ne baat sunne ka time liya bina rush kiye. 20 minute diye sirf sunne mein — aajkal milta nahi yeh.",
                "Same day reports aaye aur doctor ne personally call karke explain kiya. Yeh follow-up bohot rare hai.",
                "Over-prescribe nahi kiya doctor ne. Practical treatment plan diya bina unnecessary tests ke. Trustworthy.",
                "Clean aur sanitized environment — elderly parents ko lekar aaya tha, safe feel kiya.",
                "Paediatrician ne mere bete ke saath itna acha kiya — ab woh doctor se darta nahi. Kaam ban gaya.",
                "Raat 8 baje call kiya tha, doctor ne 10 minute mein callback diya. Emergency mein yeh bahut kaam aata hai.",
                "Insurance claim staff ki help se smooth ho gaya. Jo normally stressful hota hai woh easy ho gaya.",
                "Doctor ne simple language mein explain kiya condition ko — medical jargon mein nahi. Good first visit.",
                "Meri maaji sirf Hindi mein bolti hain — doctor aur staff ne poori baat Hindi mein ki. No problem at all.",
                "Teen logon ne same galat diagnosis di thi — yahaan ek visit mein sahi identify ho gaya. Relief tha bohot.",
            ],
            'dentist' => [
                "Honestly terrified of dentists but the doctor was so calm and patient with me. No pain at all.",
                "Got my root canal done here and was dreading it for weeks. Turned out to be completely comfortable.",
                "The clinic is very clean and modern. Saw proper sterilisation being done which immediately put me at ease.",
                "Very fair and transparent with the treatment plan and cost. No pressure to do unnecessary procedures.",
                "My 6-year-old was scared but the dentist was so gentle and playful with her. She came out smiling.",
                "The teeth cleaning was thorough and painless. My gums feel healthier and the dentist gave great aftercare advice.",
                "Emergency appointment was given same day when I had a bad toothache. The relief after treatment was immediate.",
                "Follow-up calls are made after every major procedure to check on the patient. That level of care is exceptional.",
                "Cost is very reasonable without any hidden charges. Itemized bill given which I appreciated for insurance.",
                "Recommended the simplest and most affordable treatment option when they could have suggested something expensive.",
                "My whole family — 4 members — now come here exclusively. The trust built over one good visit is irreplaceable.",
                "Waited only 5 minutes past my appointment time. For a dental clinic in India, that punctuality is commendable.",
                "Yaar dentist se dar lagta tha pehle, but yahaan itna acha experience tha ki ab zyada tension nahi hoti.",
                "Root canal karwayi thi, weeks se darr raha tha. Bilkul dard nahi hua honestly. Doctor ka haath bahut acha hai.",
                "5 minute se zyada wait nahi karna pada. Indian dental clinic mein yeh bohot rare hai bhai.",
                "Doctor ne koi unnecessary procedure suggest nahi ki. Jo actual mein chahiye tha woh hi bola. Rare honesty.",
                "Meri 6 saal ki beti dar rahi thi — doctor ne itne gently handle kiya ki woh muskurate bahar aayi.",
                "Poori family ab sirf yahaan aate hain. Ek acha experience ne permanent trust bana diya.",
                "Major procedure ke baad follow-up call aaya clinic se. Is level of care ki expect nahi thi. Impressed hun.",
                "Sab se sasta option recommend kiya jab expensive bhi suggest kar sakte the. Yeh integrity hai bhai.",
            ],
            'salon' => [
                "Finally found a salon where they actually listen to what haircut you want instead of doing whatever they feel like.",
                "The keratin treatment done here lasted 4 months — much longer than what I got at more expensive salons before.",
                "Colour came out exactly as shown in the reference photo. No bleeding, no brassing — technically very skilled team.",
                "Reasonable prices for the quality of products and service. They use good brands, not cheap alternatives.",
                "Appointment system is smooth and they actually stick to the time. No long waits sitting around doing nothing.",
                "Staff gave honest advice — recommended against a cut that wouldn't suit my face shape. That honesty is appreciated.",
                "The nail art done here is so detailed and long-lasting. Still looks perfect after 10 days.",
                "Clean towels and fresh equipment every time. Hygiene standards are clearly taken seriously here.",
                "My go-to salon for the past 2 years. Consistency in quality and service is their biggest strength.",
                "The balayage here is done with such precision — very natural-looking gradient that grows out beautifully.",
                "The senior stylist consulted with me for 10 minutes before touching my hair. That approach builds real confidence.",
                "The waxing here is thorough and not painful beyond what's normal. Good technique makes all the difference.",
                "Finally ek salon mila jahan sunते hain what you want instead of apni marzi se karte hain. Bahut relief.",
                "Keratin 4 mahine tak chala — pehle wali jagah se zyada lamba. Same price mein better result.",
                "Head spa session karwaya — itna relax hua ki ghar jaake seedha so gaya. Stress completely gone.",
                "Colour exactly photo jaisi aayi. Bleeding nahi, brassing nahi — technically bahut skilled team hai yahaan.",
                "Threading itni precise thi, over-pluck nahi kiya. Finally koi hai jo samajhta hai eyebrow shaping.",
                "Hair wash aur blow dry akela worth it tha puri visit ka. Baal genuinely healthy feel hue kaafi dino tak.",
                "2 saal se aa rahi hun, ek baar bhi quality drop nahi hui. Yahi consistency loyal banati hai.",
                "Nail art 10 din baad bhi perfect lag raha tha. Application technique clearly excellent hai.",
            ],
            'gym' => [
                "The trainers here actually pay attention to your form instead of just counting reps. Genuinely knowledgeable.",
                "Clean equipment, well-maintained machines, and the floor is mopped regularly. Hygiene is taken seriously.",
                "The membership pricing is very reasonable for the facilities offered. Great value for the investment.",
                "The trainer designed a custom programme for my goal and it's already showing results in 6 weeks.",
                "Not overly crowded even during peak hours. Equipment is always available without long waits.",
                "The nutrition advice given here is practical and sustainable — not extreme fad diets. Real guidance.",
                "The cardio section has great variety — treadmills, cycles, cross trainers, all well-maintained.",
                "Staff is encouraging without being pushy. Never felt judged no matter what level I was at.",
                "The locker rooms are clean and the showers actually have good water pressure. Basic things done right.",
                "Personal training sessions are worth every rupee — the trainer is fully focused on you the entire hour.",
                "Good air conditioning throughout the facility — important during intense workouts. Never felt suffocated.",
                "Bhai trainer ne form pe bahut dhyan diya — sirf reps count nahi ki. Real coaching milti hai yahaan.",
                "Equipment clean rehta hai, machines maintain rehte hain. Hygiene ke baare mein serious hain yeh log.",
                "Membership kaafi affordable hai facilities ke hisab se. Paisa wasool easily ho jaata hai.",
                "Peak hours mein bhi crowd manageable tha. Equipment ke liye zyada wait nahi karna pada.",
                "Trainer ne custom programme banaya meri goal ke hisab se — 6 hafte mein results dikhne lage. Works!",
                "Cardio section mein variety achi hai — treadmill, cycle, cross trainer sab well maintained.",
                "Staff encouraging hai, pushy nahi. Koi judgment nahi chahे aap kisi bhi level pe ho.",
                "Nutrition advice practical tha — extreme fad diet nahi boli, sustainable changes bataye. Real guidance.",
                "Personal training session mein trainer full focus deta hai — ek ghante mein real value milti hai.",
            ],
            'retail' => [
                "The staff is knowledgeable and helped me find exactly what I needed without being pushy. Great experience.",
                "Good variety of products and everything is well-organised. Easy to browse and find what you're looking for.",
                "The billing process is quick and the staff is courteous. No unnecessary delays or confusion.",
                "Prices are fair and they clearly mark all discounts. No hidden charges or confusing pricing.",
                "The exchange and return policy is hassle-free. Had a minor issue and it was resolved without any fuss.",
                "Parking is convenient and the store layout is logical. Makes shopping genuinely easy and stress-free.",
                "The quality of the products here is noticeably better than what you find online. Worth coming in person.",
                "Staff suggested a better alternative that was actually cheaper than what I was looking at. Honest help.",
                "Clean, well-lit store with clear signage. Everything exactly where you'd expect it. Very organised.",
                "The loyalty programme here gives real value — discounts accumulate quickly. Smart incentive to return.",
                "Bhai staff ne exactly woh dhundha diya jo chahiye tha bina zyada suggest kiye. Acha experience tha.",
                "Variety achi hai aur sab well-organised hai. Browse karna easy tha, kuch dhoondne mein time nahi gaya.",
                "Billing fast thi aur staff courteous tha. Koi unnecessary delay ya confusion nahi. Smooth experience.",
                "Prices fair hain aur discounts clearly marked hain. Koi hidden charges nahi. Trustworthy store.",
                "Return policy hassle-free thi — minor issue tha, bina tamasha ke resolve ho gaya. Impressed hun.",
                "Quality yahan ki clearly better hai online se. In-person aana worth it tha. Products genuine lagte hain.",
                "Staff ne better aur sasta alternative suggest kiya khud se. Yeh honesty rare hai retail mein.",
                "Store saaf tha, lighting achi thi, signage clear tha. Sab apni jagah milta hai. Very organised.",
                "Loyalty programme genuine value deta hai — discounts jaldi accumulate hote hain. Return karne ka mann karta hai.",
                "Mujhe kuch specific chahiye tha, staff ne exactly woh item dhundh ke diya. Knowledgeable team hai.",
            ],
            // Generic fallback — used when domain is empty, null, or unrecognised free-text
            '_generic' => [
                'Absolutely loved it — the service was fast and the staff genuinely cared.',
                'Best experience I have had in a while. Will definitely be back soon.',
                'Great ambience, warm staff, and excellent value for money. Highly recommend.',
                'The quality here is consistently top-notch. A must-visit for anyone in the area.',
                'Felt right at home from the moment I walked in. Wonderful hospitality.',
                'Everything was spotless and the team was incredibly attentive throughout.',
                'Really impressed — exceeded my expectations on every front. Five stars easily.',
                'One of the best places I have visited in this city. Will spread the word.',
                'Smooth experience from start to finish. Professional, warm, and very well-managed.',
                'The attention to detail sets this place apart. Genuinely outstanding service.',
                'Perfect from beginning to end. The staff made us feel like VIPs.',
                'Clean, comfortable, and run with real care. This is how it should be done.',
                'Yaar, ekdum mast jagah hai. Service bhi fast aur staff bhi bahut friendly tha.',
                'Bahut achha experience raha. Definitely dobara aaunga — highly recommend!',
                'Is jagah ka koi jawab nahi. Sab kuch top-class tha, paise bhi wasool lage.',
                'Service itni achhi thi ki dil khush ho gaya. Zaroor try karo ek baar.',
                'Atmosphere bilkul chill tha aur staff ne bhi bahut achhe se treat kiya.',
                'Bhai, seriously ek baar jaao — acha lagega, guarantee hai.',
                'Sab kuch neat aur clean tha. Staff ka behaviour bhi bahut professional tha.',
                'First time gaya tha, but ab toh regular ban gaya hoon. Kaafi achha hai.',
                'Bahut hi accha anubhav raha. Seva bahut tez aur staff ati vinaysheel tha.',
                'Yahan ki sewa ne dil jeet liya. Sabse acchi jagah hai sheher mein.',
                'Saaf-safai aur mahaul dono laajawab the. Zaroor aana chahiye ek baar.',
                'Staff ne itne pyar se swagat kiya ki bilkul ghar jaisa laga. Bahut shukriya.',
            ],
        ];
    }
}
