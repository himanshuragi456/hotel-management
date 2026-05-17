<?php

namespace App\Http\Controllers\Owner\Feedback;

use App\Http\Controllers\Controller;
use App\Models\FeedbackQrCode;
use App\Models\FeedbackSubmission;
use App\Models\Tenant;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use SimpleSoftwareIO\QrCode\Facades\QrCode;

class FeedbackController extends Controller
{
    use ApiResponse;

    // ── QR Management ─────────────────────────────────────────────────────────

    public function listQrCodes(Request $request): JsonResponse
    {
        $qrs = FeedbackQrCode::where('tenant_id', $request->_tenant_id)
            ->withCount('submissions')
            ->latest()
            ->get();

        return $this->success($qrs);
    }

    public function createQrCode(Request $request): JsonResponse
    {
        $data = $request->validate([
            'label'     => 'required|string|max:100',
            'placement' => 'required|in:reception,table,room,other',
        ]);

        $qr = FeedbackQrCode::create(array_merge($data, ['tenant_id' => $request->_tenant_id]));
        return $this->created($qr);
    }

    public function updateQrCode(Request $request, FeedbackQrCode $qrCode): JsonResponse
    {
        if ($qrCode->tenant_id !== $request->_tenant_id) return $this->notFound();

        $data = $request->validate([
            'label'     => 'sometimes|string|max:100',
            'placement' => 'sometimes|in:reception,table,room,other',
            'is_active' => 'sometimes|boolean',
        ]);

        $qrCode->update($data);
        return $this->success($qrCode->fresh());
    }

    public function deleteQrCode(Request $request, FeedbackQrCode $qrCode): JsonResponse
    {
        if ($qrCode->tenant_id !== $request->_tenant_id) return $this->notFound();
        $qrCode->delete();
        return $this->success(null, 'Deleted');
    }

    public function downloadQrPng(Request $request, FeedbackQrCode $qrCode)
    {
        if ($qrCode->tenant_id !== $request->_tenant_id) abort(404);

        $url = config('app.frontend_url') . '/feedback/' . $qrCode->qr_token;
        $svg = QrCode::format('svg')->size(400)->margin(2)->generate($url);

        return response($svg, 200, [
            'Content-Type'        => 'image/svg+xml',
            'Content-Disposition' => 'attachment; filename="feedback-qr-' . $qrCode->label . '.svg"',
        ]);
    }

    // ── Google Place Lookup ────────────────────────────────────────────────────

    public function findPlace(Request $request): JsonResponse
    {
        $data = $request->validate([
            'business_name' => 'required|string|max:200',
            'city'          => 'nullable|string|max:100',
        ]);

        $apiKey = config('services.google.places_api_key');
        if (!$apiKey) {
            return $this->error('Google Places API key not configured', 422);
        }

        $query = trim($data['business_name'] . ' ' . ($data['city'] ?? ''));
        $url   = 'https://maps.googleapis.com/maps/api/place/findplacefromtext/json?' . http_build_query([
            'input'           => $query,
            'inputtype'       => 'textquery',
            'fields'          => 'place_id,name,formatted_address',
            'key'             => $apiKey,
        ]);

        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10]);
        $response = curl_exec($ch);
        $error    = curl_error($ch);
        curl_close($ch);

        if ($error || !$response) {
            return $this->error('Failed to reach Google Places API', 502);
        }

        $parsed = json_decode($response, true);

        if (($parsed['status'] ?? '') !== 'OK' || empty($parsed['candidates'])) {
            return $this->error('No matching business found. Try adding a city or more detail.', 404);
        }

        $place      = $parsed['candidates'][0];
        $placeId    = $place['place_id'];
        $reviewUrl  = 'https://search.google.com/local/writereview?placeid=' . $placeId;

        return $this->success([
            'place_id'    => $placeId,
            'name'        => $place['name'] ?? '',
            'address'     => $place['formatted_address'] ?? '',
            'review_url'  => $reviewUrl,
        ]);
    }

    // ── Google Review Config ───────────────────────────────────────────────────

    public function getReviewConfig(Request $request): JsonResponse
    {
        $tenant = Tenant::find($request->_tenant_id);
        return $this->success([
            'google_place_id'    => $tenant->google_place_id,
            'google_review_url'  => $tenant->google_review_url,
            'business_domain'    => $tenant->business_domain,
            'has_suggestions'    => !empty($tenant->review_suggestions),
            'suggestions_count'  => count($tenant->review_suggestions ?? []),
        ]);
    }

    public function updateReviewConfig(Request $request): JsonResponse
    {
        $data = $request->validate([
            'google_place_id'   => 'nullable|string|max:200',
            'google_review_url' => 'nullable|url|max:500',
            'business_domain'   => 'nullable|string|max:100',
        ]);

        $tenant = Tenant::find($request->_tenant_id);
        $tenant->update($data);

        // Regenerate suggestions if business_domain provided
        if (!empty($data['business_domain'])) {
            $suggestions = $this->generateReviewPool($tenant->name, $data['business_domain']);
            $tenant->update(['review_suggestions' => $suggestions]);
        }

        return $this->success([
            'google_place_id'   => $tenant->google_place_id,
            'google_review_url' => $tenant->google_review_url,
            'business_domain'   => $tenant->business_domain,
            'has_suggestions'   => !empty($tenant->review_suggestions),
            'suggestions_count' => count($tenant->review_suggestions ?? []),
        ], 'Config saved');
    }

    private function generateReviewPool(string $businessName, string $domain): array
    {
        $apiKey = config('services.openai.api_key');

        if (!$apiKey) {
            return $this->genericPool($domain);
        }

        $prompt = "Generate 18 short, genuine Google review suggestions for a {$domain} called \"{$businessName}\". " .
                  "Mix of 4-star and 5-star vibes. Each review should be 1-2 sentences, natural, varied in tone (enthusiastic, warm, casual, professional). " .
                  "No names, no dates. Return ONLY a JSON array of 18 strings.";

        $ch = curl_init('https://api.openai.com/v1/chat/completions');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_HTTPHEADER     => [
                'Authorization: Bearer ' . $apiKey,
                'Content-Type: application/json',
            ],
            CURLOPT_POSTFIELDS => json_encode([
                'model'       => 'gpt-4o-mini',
                'messages'    => [['role' => 'user', 'content' => $prompt]],
                'max_tokens'  => 1200,
                'temperature' => 0.9,
            ]),
            CURLOPT_TIMEOUT => 30,
        ]);

        $response = curl_exec($ch);
        $error    = curl_error($ch);
        curl_close($ch);

        if ($error || !$response) return $this->genericPool($domain);

        try {
            $parsed  = json_decode($response, true);
            $content = $parsed['choices'][0]['message']['content'] ?? '';
            preg_match('/\[.*\]/s', $content, $matches);
            if ($matches) {
                $suggestions = json_decode($matches[0], true);
                if (is_array($suggestions) && count($suggestions) >= 10) {
                    return array_values($suggestions);
                }
            }
        } catch (\Throwable) {}

        return $this->genericPool($domain);
    }

    private function genericPool(string $domain): array
    {
        $pools = [
            'restaurant' => [
                "Visited with family last Sunday — the dal makhani and butter naan were absolutely spot on. Felt like ghar ka khana honestly.",
                "Been coming here for 2 years now and the quality has never dropped. The owner personally comes and checks if everything is okay, that's rare nowadays.",
                "Ordered the thali and it was so filling, I couldn't eat dinner that night! Great value for money, portions are very generous.",
                "The biryani here is the real deal — not the hotel-style watered down version. Properly cooked, full of flavour, highly recommend.",
                "Took my parents here for their anniversary. The staff arranged a small table decoration without us asking. Touched our hearts.",
                "Fast service even on a busy Saturday evening. Food came hot and fresh within 20 minutes. Will definitely come again.",
                "The paneer dishes are exceptional — soft, fresh, and full of masala. Finally found a place that doesn't compromise on taste.",
                "Affordable pricing without cutting corners on quality. Rare combination these days. My team's go-to lunch spot now.",
                "Amazing ambiance, great AC, and the food quality is consistently excellent. Exactly what you want after a long day.",
                "The staff is very polite and patient even when we had a big group of 15 people. Handled everything perfectly.",
                "Ordered paratha and lassi — both outstanding. The lassi was thick and not too sweet, exactly how I like it.",
                "Great for both veg and non-veg eaters. My whole friend group comes here because everyone finds something they love.",
                "The chole bhature here is something else — fluffy bhature, perfectly spiced chole. Definitely worth the visit.",
                "First time visit but won't be the last. The waiter was helpful in recommending what to order. Felt very welcome.",
                "Home delivery packaging was excellent — everything arrived hot and without spilling. That attention to detail shows.",
                "The chaat counter outside is a hidden gem. The pani puri water is perfectly tangy. Best I've had in this area.",
                "Very clean kitchen and dining area — could see from the open kitchen setup. Made us feel confident about the food.",
                "South Indian breakfast here is a must — the idli is soft, sambar is flavorful, and the chutney is freshly made.",
                "Ordered the fish curry on a friend's recommendation and it was absolutely spectacular. Perfectly balanced spices.",
                "The dosa is crispy on the outside and perfectly thin — not the thick spongy kind. Authentic preparation, loved it.",
                "Came for a quick lunch and ended up spending an hour just because everything was so good. No complaints at all.",
                "The murgh makhani here beats anything I've had at five-star restaurants. Rich, creamy, and full of flavour.",
                "Staff remembered it was my birthday without me telling them and got a small mithai plate. Really sweet gesture.",
                "Even the raita and pickles that come with the meal are made in-house. That level of care is rare in restaurants today.",
                "Took a client here for lunch and they were very impressed. Good place for professional meetings too.",
                "The desserts are not an afterthought — the gulab jamun was perfectly soft and not overly sweet. Wonderful ending to the meal.",
                "No compromise on cleanliness. Tables are wiped immediately, floors are clean, and the washroom is well maintained.",
                "The lunch combo pricing is incredible — you get soup, main course, bread, and dessert at a very reasonable price.",
                "Even during peak hours the kitchen doesn't slow down. Food arrives quickly and tastes like it was cooked fresh.",
                "My vegetarian friends always pick this place because the veg menu is extensive and genuinely delicious, not just an afterthought.",
                "The masala chai after the meal was the perfect finish. Small gesture but it completed the entire experience.",
                "Very good with dietary restrictions — I told them I'm gluten intolerant and they carefully guided me through safe options.",
                "Came here on a recommendation and immediately understood why everyone talks about this place. Truly lives up to the hype.",
                "The Sunday brunch spread is extraordinary. At least 25 dishes, all hot and fresh. Absolute value for the price.",
                "Service is attentive but not intrusive — the staff knows when to be present and when to leave you to your meal.",
                "The mutton is slow-cooked and falls off the bone perfectly. You can tell it's not rushed. Real cooking, real flavour.",
                "Parking is easy, the entry is quick, and the food is outstanding. Everything about this visit just worked perfectly.",
                "The head chef came out to ask for feedback personally. That kind of ownership and pride in the food is commendable.",
                "We ordered takeaway for 10 people and every single order was accurate, well-packed, and arrived hot. Impressive.",
                "The ambiance in the evening with dim lighting and soft music makes it perfect for a special dinner. Loved every moment.",
                "Yaar seedha bolunga — best restaurant hai is area mein. Khaana itna acha tha ki dobara aane ka mann kar raha hai abhi bhi.",
                "Bhai biryani ekdum mast thi, seriously. Dosto ke saath aaya tha, sabne enjoy kiya. Full paisa vasool.",
                "Thoda late ho gaye the order aane mein but quality itni achi thi ki sab bhul gaye. Taste kaafi acha hai yahan ka.",
                "Pehli baar aaya tha, waiter bhai ne bahut acha guide kiya kya order karna chahiye. Good experience overall.",
                "Ghar ke khane jaisa taste tha, seriously. Dal chawal itne simple the but itne tasty — yahi toh asli khana hai.",
                "Sunday ko family ke saath gaye the. Bacche khush, bade khush, budget mein bhi tha. Kya chahiye aur?",
                "Bhai paneer butter masala aur naan — bas itna hi order karo aur zindagi set hai. Must try seriously.",
                "Bohot dino baad itna acha khana khaya. Staff bhi mast tha, koi pressure nahi tha zyada order karne ka.",
                "Dosto ke saath teen baar aa chuka hun. Har baar same quality. Isi liye toh recommend karta hun sabko.",
                "Thali ka size dekh ke hi peth bhar gaya 😄 Seriously itna dete hain yahan. Quality + quantity dono.",
                "Owner khud aa ke puchha kaisa laga — yahi cheez alag karti hai is jagah ko. Real care dikhta hai.",
                "Late night khana dhoondh rahe the, yahan mila aur ekdum fresh tha. No compromise on quality even late hours mein.",
                "Chai ke saath jo free snack mila vo bhi lajawab tha. Choti choti cheezein hoti hain jo experience bana deti hain.",
                "Office lunch ke liye perfect jagah hai. Sasta bhi hai aur itna acha bhi — rare combination hai bhai.",
                "Ek baar try karo, phir khud samajh jaoge kyun sab isko recommend karte hain. Guarantee se acha lagega.",
                "Haleem yahaan pe ekdum authentic thi — woh wali taste jo normally nahi milti. Bahut dino baad milI.",
                "Puri family le ke gaya tha. Dadi ne bola ghar jaisa khana tha. Highest compliment possible hai yeh.",
                "Service thoda slow thi weekend mein but food ne sab cover kar liya honestly. Taste mein no compromise.",
                "Bhai ek baar chole bhature khaao yahaan ke, phir bahar se nahi khaoge. Simple fact hai.",
            ],
            'hotel' => [
                "Checked in after a very long journey and the front desk staff were so helpful — even arranged early check-in without extra charge.",
                "The room was spotless and the AC was perfectly cool. Slept like a baby after a hectic day of travel. Very comfortable.",
                "Breakfast buffet is excellent — hot items kept replenished, fresh juice, and the staff is proactive about refilling plates.",
                "Great location, walking distance to the railway station. Felt very safe and the area is clean. Will book again.",
                "The housekeeping team did an amazing job — room was cleaned twice a day and fresh towels were provided without asking.",
                "Checked out smoothly, no billing issues, no hidden charges. Appreciated the transparency and professionalism at the front desk.",
                "Power backup was instant during the brief outage — shows the hotel is well managed. No inconvenience at all.",
                "The staff helped us arrange a local cab and even recommended good restaurants nearby. Above and beyond service.",
                "Booked for 3 nights and every night the room was equally clean and well-maintained. Consistent quality throughout.",
                "Good WiFi throughout the property, including in the room. Important for work travel and it didn't disappoint.",
                "Very value-for-money compared to other hotels in this price range. Quality easily matches places that charge double.",
                "The pillows and mattress are genuinely comfortable — finally a hotel that invests in proper bedding.",
                "Had a small issue with the geyser and they fixed it within 15 minutes of calling the front desk. Responsive team.",
                "The dining area has good variety and the food is reasonably priced for a hotel. Didn't feel ripped off at all.",
                "Warm welcome from the moment we arrived. The receptionist remembered our names by the second day — that's impressive.",
                "Family room was spacious enough for two adults and two kids. Kids loved the facilities and we had a relaxing stay.",
                "Late checkout was granted without any fuss when we requested it. Small gesture but makes a big difference.",
                "The property is well-maintained and secure. Felt very safe as a solo woman traveller. Will recommend to others.",
                "Room service was prompt and the food quality was surprisingly good. Expected average hotel food but got much better.",
                "The water pressure in the shower is excellent — something that's often neglected in budget hotels but not here.",
                "They offered to store our luggage after checkout at no extra charge. Made our remaining sightseeing hours so easy.",
                "The front desk handled my flight rescheduling panic calmly and helped me arrange everything. Went beyond just hotel duties.",
                "First time staying alone in a new city and the staff made me feel completely safe and welcome throughout.",
                "The rooftop area in the evening is beautiful — great view, comfortable seating, and a nice way to end the day.",
                "Very prompt with wake-up calls — called exactly on time and followed up when I didn't pick up. Responsible.",
                "The bed linen is fresh and well-pressed. These details reflect a hotel that actually cares about the guest experience.",
                "Booked last minute and they accommodated us without any difficulty. Flexible and guest-friendly approach.",
                "The hotel arranged a doctor visit when one of us fell ill. They handled it so quickly and with so much care.",
                "Great for business travellers — desk in room, good lighting, reliable internet, and a quiet environment. Ticked all boxes.",
                "Even the complimentary toiletries are of good quality. Not the generic tiny sachets but proper branded products.",
                "The reception team speaks Hindi, English, and even a bit of the local language — very accommodating for all guests.",
                "Checked in multiple times across different months and the standard has been the same every time. That consistency is rare.",
                "The swimming pool is clean and the timings are generous. Had a great morning swim before heading out for the day.",
                "Appreciated the no-smoking policy being strictly enforced. The corridors and rooms never had that stale smell.",
                "The staff proactively told us about road closures near the hotel and suggested the best route. Very helpful.",
                "Complimentary newspaper at the door every morning — a small touch that shows real attention to guest comfort.",
                "Express checkout was smooth and the bill was pre-emailed so no surprises. Modern and efficient process.",
                "The gym is small but has everything you need for a basic workout. Well-maintained equipment and clean towels provided.",
                "The in-house restaurant's thali is excellent — better than most standalone restaurants in the area.",
                "The courtyard area is peaceful and a lovely place to sit in the morning with a cup of chai. Loved the atmosphere.",
                "Bhai hotel ekdum mast hai. Room clean tha, AC perfect tha, aur staff ne koi problem nahi hone di. Full recommend.",
                "Pehli baar akele travel kar raha tha, thoda nervous tha. Reception wale bhai ne sab handle kar liya. Bohot helpful the.",
                "Check-in ke time early arrival tha, bina extra charge ke room de diya. Yeh cheez bahut rare hai hotels mein.",
                "Geyser ka paani garam nahi tha, call kiya toh 10 minute mein fix ho gaya. Fast response — impressed hua.",
                "Room service ka khana surprisingly acha tha. Normally hotel food average hota hai but yahaan genuinely tasty tha.",
                "WiFi full speed tha pure property mein. Work trip tha meri, yeh sab se important tha. Ekdum perfect.",
                "Housekeeping wale bhai ne room ekdum chamka ke rakha tha. Fresh towels, clean bedsheet — sab set tha.",
                "Station se paidal distance mein hai. Late night train thi, tension nahi thi cab ki. Bahut convenient location.",
                "Breakfast mein poha, idli, eggs sab tha. Fresh tha aur bar bar refill ho raha tha. Value for money.",
                "Late checkout maanga toh bina tamasha kiye de diya. Choti si baat hai but bahut helpful hoti hai.",
                "Family trip tha humara — 2 bachche saath the. Kids ke liye bhi sab arrange ho gaya bina zyada bolne ke.",
                "Power cut hua thodi der ke liye, generator turant chala. Pata hi nahi chala practically. Well maintained hai.",
                "Cab book karni thi city mein, front desk ne turant arrange kar di aur rate bhi theek tha. Extra service achi lagi.",
                "Pillows aur mattress genuinely comfortable the. Finally ek hotel jisne bedding pe invest kiya hai properly.",
                "Room mein ek baar AC ki problem aayi, turant naya room de diya without any argument. Professional handling.",
                "Solo woman traveller hun, security ka bohot dhyan tha yahan. CCTV, guard, safe environment — sab tha.",
                "Raat ko bhi reception pe koi na koi tha. 2 baje paani maanga toh bhi turant mila. 24/7 service real mein.",
                "Hotel ne check-out ke baad bhi luggage store kar ke rakha bina kisi charge ke. Sightseeing easily ho gayi.",
                "Dosto ke saath group trip tha. Multiple rooms the, sab same quality ke the. Consistent service throughout.",
                "Honestly soch ke nahi aaya tha itna acha hoga is price range mein. Pleasantly surprised hun. Will book again.",
            ],
            'cafe' => [
                "The cold coffee here is hands down the best in the city. Thick, creamy, not too sweet — exactly how it should be.",
                "Came to study here on a weekday and stayed for 4 hours. Free WiFi, comfortable seating, and nobody rushed me. Perfect.",
                "The staff is super friendly and remembered my usual order by the third visit. That small thing makes a big difference.",
                "Had the sandwich and cappuccino combo — both were fresh and made to order. Definitely coming back with friends.",
                "Perfect spot for a first date — cozy lighting, not too loud, and the desserts are beautiful. Highly recommend.",
                "The matcha latte here is actually made with real matcha, not powder. You can taste the quality immediately.",
                "Prices are very reasonable for this kind of ambiance. Feels like a Mumbai cafe but at local prices.",
                "The croissants are baked fresh every morning — buttery, flaky, and not overly sweet. Absolute joy with the coffee.",
                "Love the aesthetic of this place. The decor is Instagram-worthy but also genuinely comfortable to sit in.",
                "Ordered the waffles and they were amazing — crispy outside, soft inside, with generous toppings. Will order again.",
                "The barista was patient and made my coffee exactly how I wanted after I described it in detail. Very skilled.",
                "Great place to catch up with old friends. The background music is just right — not too loud to talk over.",
                "The iced tea options here are unique and refreshing. Tried the lemon ginger one and it was absolutely perfect.",
                "Even on a busy weekend afternoon, the service was quick and the order was correct. Efficient team.",
                "Vegan options available and clearly marked on the menu. Appreciated the inclusivity and the quality was great.",
                "The loyalty card fills up fast and the free coffee is well worth it. Smart way to build a regular customer base.",
                "Came for the ambiance, stayed for the food. The avocado toast was surprisingly filling and very well seasoned.",
                "Clean washrooms, reliable WiFi, fresh food — the three things a cafe must get right, and they nail all three.",
                "The filter coffee here is proper south Indian style — strong, hot, frothy. Haven't found better outside Chennai.",
                "Tried the seasonal special drink and it was creative and delicious. Love that they keep rotating the menu.",
                "Brought my laptop for a work session and the plug points near every seat made it so convenient. Thought-through design.",
                "The cheesecake here is genuinely restaurant-quality. Light, not too dense, with a perfect biscuit base.",
                "Had a minor complaint about the order and it was fixed immediately with a smile. No arguments, no justifications.",
                "The cold brew is properly brewed — smooth, not bitter, and doesn't need sugar. Exactly how good cold brew should taste.",
                "Love that they use recyclable packaging for takeaway. Small effort but it matters and reflects the right values.",
                "The entire menu has calorie counts listed. Very helpful for someone watching their diet. Thoughtful addition.",
                "The pasta here is surprisingly good — not what you expect from a cafe but they've clearly put effort into the food menu.",
                "Staff offers a sample of the new drinks before you order — that confidence in their product is very reassuring.",
                "Sunday brunch crowd here has such a lovely vibe. Everyone seems happy and relaxed. The cafe's energy is infectious.",
                "The hot chocolate is rich and made with real chocolate, not just powder. Immediately felt the difference.",
                "Terrace seating area is lovely in the evening — fairy lights, cool breeze, and great coffee. What more could you ask?",
                "Never had to wait more than 8 minutes for any order here, even when busy. Efficient kitchen and smart workflow.",
                "The staff handles rush hour with grace — no frustration, no cutting corners on quality even when packed.",
                "Ordered a custom order with multiple changes and it was executed perfectly. Very accommodating team.",
                "The breakfast menu starts early — 7:30 AM — which is perfect for early risers who want something proper.",
                "My kids love the pancakes here. Fluffy, with real maple syrup, and the kids' portion size is just right.",
                "The chai latte is a great fusion of Indian masala chai and a latte format. Comforting and warming.",
                "Very reasonable corkage policy — they allowed us to bring a cake for a birthday and handled it graciously.",
                "The book shelf corner with board games is a lovely touch. Spent an extra hour just because it was so fun.",
                "First cafe I've found where the espresso is actually well-pulled — crema intact, not bitter, perfectly extracted.",
                "Bhai cold coffee pee ke life set ho gayi. Seriously itni thick aur creamy thi, bahar se lene ki zaroorat hi nahi.",
                "College ke baad yahan aa ke baithna has become a routine now. Sasta hai, WiFi hai, koi rush nahi karta. Perfect.",
                "Pehli date yahaan thi, dono ko itna acha laga ki second date bhi yahaan hi thi 😄 Vibe ekdum perfect hai.",
                "Croissant aur cappuccino — bas yeh do cheezein order karo aur subah ban jaati hai. Fresh hote hain daily.",
                "Barista ne meri coffee exact waisi banayi jo maine describe ki thi. Skill chahiye yeh karne ke liye. Impressed.",
                "Weekend mein bhi wait zyada nahi tha. Fast service without compromising taste — mushkil hota hai yeh balance.",
                "Waffles mein itna generous topping tha, seriously ek order mein pet bhar gaya. Koi cheating nahi karte yahan.",
                "Laptop le ke aaya tha kaam karne — plug points the, WiFi fast thi, koi disturbance nahi. Productive session tha.",
                "Matcha latte real matcha se bani thi, powder se nahi. Farak immediately taste mein pata chala. Good quality.",
                "Staff ne teesri visit pe mera usual order yaad rakha tha. Choti si baat hai but bahut warmth feel hoti hai.",
                "Iced tea yahaan ki unique hai — lemon ginger wali try karo, seriously refreshing hai especially summer mein.",
                "Vegan options clearly mark kiye hue hain menu mein. Meri friend ke liye perfect tha yeh. Inclusive vibe hai.",
                "Cheesecake itni light thi, ek baar mein poori kha li bina guilt ke 😄 Quality clearly bahut achi hai.",
                "Filter coffee south Indian style mein bani thi — strong, frothy, perfect temperature. Chennai jaisi feel aayi.",
                "Loyalty card bohot jaldi fill ho jaati hai. Free coffee mila bhi jaldi. Smart system hai yeh.",
                "Book shelf corner mein baithke board game khela dost ke saath — extra 1 ghanta nikal gaya easily.",
                "Hot chocolate real chocolate se bani thi, powder se nahi. Taste mein difference clearly pata chala. Rich tha.",
                "Terrace pe shaam ko fairy lights, thandi hawa, aur acha coffee — yaar kya scene tha. Wapas zaroor aaunga.",
                "Chai latte try ki pehli baar — masala chai aur latte ka combination genuinely acha laga. Unique hai yeh.",
                "Clean washrooms, fast WiFi, fresh food — teen cheezein jo matter karti hain, teeno mein full marks.",
            ],
            'bar' => [
                "The cocktails here are expertly crafted — not the pre-mixed stuff you get elsewhere. The bartender actually knows his work.",
                "Came here on a Friday night and despite being packed, service was fast and the drinks were never watered down.",
                "Best whisky collection in the city. The staff guided me through the single malts without being pushy. Loved it.",
                "The rooftop seating area has an amazing view of the city lights. Perfect setting for a relaxed evening with friends.",
                "Tried the house special cocktail and it was genuinely unique — not just a regular drink with a fancy name.",
                "The mocktail menu is just as impressive as the cocktail menu. My friend who doesn't drink was equally happy.",
                "Reasonable pricing compared to other bars in this area. The quality of drinks and food justifies every rupee.",
                "The food menu is solid — not just bar snacks. Had proper meals and they were really well made.",
                "The music volume is perfect — loud enough to have fun but you can still have a conversation without shouting.",
                "Very clean and well-maintained bar. The restrooms are actually clean, which says a lot about how the place is managed.",
                "The staff remembered our preferences from last time without us mentioning it. That's the kind of service that builds loyalty.",
                "Great for corporate team outings — private booth available, staff is discreet and professional.",
                "The draught beer is always fresh and cold. The glasses are properly chilled too — little details that matter.",
                "Celebrated my birthday here and the team surprised us with a complimentary dessert. Absolutely wasn't expected.",
                "Happy hours are genuinely good value. Came in for one drink and stayed for three — no regrets.",
                "Smooth entry process, no drama at the door. Well-organised place with a great crowd.",
                "The cheese platter and wine pairing recommendation from the staff was perfect. Knowledgeable team.",
                "Always a consistent experience here. Same quality, same service, every single visit. That reliability is rare.",
                "The bartender explained the origin of each spirit when I asked — genuinely passionate about his craft. Impressive.",
                "The lighting and decor hits the right balance — not too dark, not too bright. Perfect mood for the evening.",
                "Tried their signature gin and tonic with house-infused botanicals. It was absolutely brilliant — highly creative.",
                "The bar bites — especially the chicken wings — are genuinely good. Not an afterthought like in most bars.",
                "Staff is very professional and firm about responsible service. Didn't feel any pressure to keep ordering. Respected.",
                "The outdoor seating area has misting fans which made it perfect even on a warm evening. Smart setup.",
                "Booked a private table for an anniversary and they decorated it without being asked. Went above and beyond.",
                "The sangria is homemade and fruity without being overly sweet. Best I've had outside of a 5-star restaurant.",
                "Karaoke nights are hosted with great energy by the staff. The vibe is inclusive and everyone has a great time.",
                "Very reasonable minimum charge for the experience you get. No nickel-and-diming, just good value.",
                "The bar team is quick even during peak hours. Never waited more than 5 minutes for a drink. Very efficient.",
                "The CCTV and security is visible but not intimidating. Felt safe throughout the evening with my friends.",
                "The Old Fashioned here is made properly — not sweetened beyond recognition. For whisky lovers, this is the place.",
                "The cocktail menu changes seasonally. Always something new to try each time we visit. Keeps it exciting.",
                "Tab settling is quick and billing is accurate. No mysterious charges added. Trustworthy and professional.",
                "The bar is immaculately stocked — if you name an obscure spirit they almost certainly have it. Impressive range.",
                "Staff greeted us by name when we walked in for the third time. That recognition feels genuinely good.",
                "The live music on weekends is tasteful — not too loud, great musicians, adds to the ambiance perfectly.",
                "The ice is clearly filtered — drinks don't taste off like they do when low-quality ice is used. Small detail, big difference.",
                "Comfortable bar stools with back support — something most bars overlook but makes a big difference on a long evening.",
                "The non-alcoholic cocktails are creative and premium — not just juice in a fancy glass. Genuinely enjoyable.",
                "We came for my colleague's farewell and they handled our group of 20 without any hiccups. Very well coordinated.",
                "Bhai bartender ne cocktail ekdum perfectly banaya. Pre-mixed wala drama nahi tha yahan — real craft hai.",
                "Friday night ko bhi service fast thi, drinks watered down nahi the. Packed tha fir bhi quality same rahi.",
                "Whisky collection dekh ke aankh khul gayi yaar. Single malts bhi the, aur bande ne pushy bhi nahi kiya. Mast.",
                "Rooftop pe baith ke city lights dekhe, drink haath mein tha — seriously what a vibe. Dosto ke saath full enjoy.",
                "House special cocktail try kiya — genuinely unique tha, just fancy naam wala koi regular drink nahi. Creative work.",
                "Meri friend drink nahi karti, uske liye bhi bohot options the mocktail mein. Inclusive place hai yeh.",
                "Prices thode high lagte hain first mein but quality dekh ke feel hota hai paise vasool hue. Fair deal hai.",
                "Food bhi order kiya saath mein — bar ka khana usually average hota hai but yahaan genuinely tasty tha.",
                "Music loud tha but itna nahi ki baat na ho sake. Perfect balance tha — dance bhi kar sakte, baat bhi.",
                "Bhai restroom clean thi — yeh ek cheez hai jo bahut kuch bata deti hai bar ke baare mein. Marks badhte hain.",
                "Bartender ne last time ka order yaad rakha bina bataye. Yeh level of service ka matlab hai regular banana.",
                "Birthday celebrate kiya yahan — team ne surprise dessert diya bina kuch maange. Really touched hua.",
                "Happy hours mein ek drink ke liye aaya, teen peeke gaya. No regrets. Value bahut acha tha.",
                "Entry smooth thi, koi drama nahi. Crowd bhi decent tha. Achi management dikhti hai overall.",
                "Draught beer always fresh aur cold thi. Glass bhi chilled diya — yeh detail bahut matters yaar.",
                "Sangria homemade thi aur fruity thi, zyada sweet nahi. 5-star jaisi quality thi honestly.",
                "Live music weekend pe tha — musicians aache the, volume sahi tha. Ambiance ekdum set tha.",
                "Tab settle karna quick tha, bill accurate tha. Koi hidden charges nahi. Honest place hai yeh.",
                "Old Fashioned properly bana tha — zyada sweeten nahi kiya tha. Whisky lovers ke liye yeh jagah hai.",
                "Teen logon ke saath gaya tha pehli baar. Sabne enjoy kiya itna ki group outing ka default spot ban gaya.",
            ],
            'bakery' => [
                "The pav here is softer than anything you'll find in a supermarket — fresh out of the oven, slightly warm, absolutely perfect.",
                "Ordered a custom birthday cake and it looked exactly like the picture I shared. Tasted even better than it looked.",
                "The khari biscuits and chai combo here is unbeatable. My morning routine now — stop here before office every day.",
                "Everything in the display case looked so fresh and inviting. Ended up buying way more than planned. No regrets!",
                "The plum cake during Christmas was exceptional — rich, moist, and full of fruit. Pre-ordered for the whole family.",
                "Owner is hands-on and clearly passionate about quality. Spoke to us about each item we were curious about.",
                "The bread is baked fresh twice a day and you can tell — no staleness, no artificial smell, just proper bread.",
                "Got the cake for my parents' anniversary and they absolutely loved it. Everyone at the party asked where it was from.",
                "The cream rolls and patties are legendary in this area. People drive from far just for these — and rightly so.",
                "Very hygienic setup — everything wrapped properly, staff wearing gloves, clean display cases. Felt confident buying.",
                "The mawa cake here is a proper Parsi-style one — not the artificial sweetened version. Authentic and delicious.",
                "Reasonably priced and the portions are generous. A 500g cake easily fed 8 people at our gathering.",
                "Great variety from Indian mithai to continental pastries. One stop shop for all occasions.",
                "The chocolate truffle cake is dangerously good — rich ganache, moist sponge, and not overly sweet. Top tier.",
                "They take pre-orders seriously and deliver exactly on time. Very professional for a neighbourhood bakery.",
                "The staff patiently helped me pick a combination of items within my budget. Very helpful and not snooty at all.",
                "The bun maska here with Irani chai is the ultimate comfort combo. A classic experience done perfectly.",
                "Never had a bad experience in over a year of visiting. Consistent quality is their biggest strength.",
                "The jeera biscuits here are addictive — crisp, perfectly salted, and pair beautifully with chai. Always buy two packets.",
                "Ordered eggless versions for a friend who doesn't eat eggs and they tasted just as good. Great inclusive options.",
                "The bread pudding here is a hidden gem — warm, custardy, and just the right amount of sweetness. Must try.",
                "The packaging is sturdy and the cakes travel well. Ordered delivery for a party 15 km away and it arrived perfect.",
                "The seasonal mithai during Diwali was exceptional — kaju katli and besan ladoo that tasted completely homemade.",
                "Fresh cream pastries are made fresh every morning and it shows — no stale cream or dry sponge. Genuinely fresh.",
                "The multi-grain loaf is excellent for health-conscious people — dense, nutty, and actually tastes good toasted.",
                "Brownies here are fudgy and rich, not cakey — exactly how a brownie should be. Been recommending to everyone.",
                "The pineapple pastry is a classic done right — moist sponge, just enough cream, real pineapple pieces. Nostalgic.",
                "They remembered my allergy note from a previous order when I came back. That kind of attention to detail is rare.",
                "The banana bread here is the moistest I've had — not too dense, not too light. Perfectly balanced flavour.",
                "They stock freshly made items every 3 hours during the day. Never buy anything more than 3 hours old. Impressive.",
                "The gift boxes are beautifully packaged and make for excellent corporate gifts. Ordered 20 for our office Diwali.",
                "Kulcha and nankhatai here are both perfect — buttery, crumbly, and not too sweet. Traditional baking at its best.",
                "The staff suggested the ragi cookies when I mentioned I was watching sugar intake. Thoughtful and knowledgeable.",
                "The sambusak pastry during Eid was absolutely authentic. Could tell the recipe hasn't been compromised at all.",
                "Every item has a small card describing the ingredients and shelf life. That transparency builds so much trust.",
                "The carrot cake has real carrots, real walnuts, and actual cream cheese frosting. Not a lazy version. Excellent.",
                "My kids insist on stopping here every weekend. The petit fours and eclairs are their absolute favourites.",
                "The whole wheat pizza base they sell separately is brilliant — used it at home and it was better than from the oven.",
                "Asked for less sugar in the cake and they adjusted without hesitation. Very accommodating and no extra charge.",
                "The quiche here is outstanding — buttery shortcrust pastry, creamy filling, well-seasoned. Perfect weekend brunch item.",
                "Bhai pav itna soft tha ki seedha samajh aaya — yahaan fresh banta hai, bakery se seedha. Supermarket wala nahi.",
                "Birthday cake order ki thi, photo share ki thi reference ke liye — exactly waisi bani. Taste bhi mast tha.",
                "Khari biscuit aur chai — roz subah office jaate waqt yahaan ruk jaata hun. Life set hai bhai literally.",
                "Display mein sab itna fresh dikh raha tha ki plan se zyada le liya 😄 Koi regret nahi, sab khatam bhi ho gaya.",
                "Plum cake Christmas pe try ki — rich, moist, fruits bhi the properly. Family ke liye ek aur order kiya.",
                "Owner khud present tha aur har item ke baare mein bata raha tha. Yeh passion dikhta hai quality mein.",
                "Bread din mein do baar fresh aata hai — pata chal jaata hai kyunki smell aur taste dono fresh hote hain.",
                "Anniversary pe cake liya tha parents ke liye — sab ne kaha best cake tha party mein. Proud moment tha.",
                "Cream rolls yahaan ki famous hain area mein, log door se aate hain sirf inke liye. Try karo ek baar.",
                "Sab cheez wrapped tha properly, gloves the staff ke haath mein — hygienic setup dekh ke confident feel kiya.",
                "Mawa cake ekdum original Parsi style ki thi — artificial sweetness nahi thi. Rare cheez hai yeh aajkal.",
                "500g cake 8 logon ko easily feed kar li. Reasonable price mein itna — bohot acha value for money.",
                "Mithai bhi milti hai yahaan aur continental pastries bhi — ek hi jagah pe sab milne se life easy ho jaati hai.",
                "Chocolate truffle cake — bhai ek baar khao, phir bahar ki yaad nahi aayegi. Rich, moist, not too sweet.",
                "Pre-order serious se lete hain yahan, time pe deliver kiya. Professional approach hai unka.",
                "Budget tha limited, staff ne patiently best combination suggest kiya. Koi attitude nahi tha. Good people.",
                "Bun maska aur Irani chai — yeh combo yahan milta hai aur yaar kya classic experience hai. Must try.",
                "Ek saal se aa raha hun, ek bhi baar disappointed nahi hua. Consistency hi inki sabse badi quality hai.",
                "Jeera biscuits ek packet li thi, dusre din dobara aana pada doosri packet ke liye. Addictive seriously.",
                "Diwali pe kaju katli yahan ki li — homemade jaisi quality thi, market wali artificial taste bilkul nahi.",
            ],
            'dentist' => [
                "Honestly terrified of dentists but the doctor was so calm and patient with me. Explained every step before doing it. No pain at all.",
                "Got my root canal done here and was dreading it for weeks. Turned out to be completely comfortable — excellent technique.",
                "The clinic is very clean and modern. Saw proper sterilisation being done which immediately put me at ease.",
                "Waited only 5 minutes past my appointment time. For a dental clinic in India, that punctuality is commendable.",
                "Braces treatment has been going on for 8 months — every visit is comfortable and the progress is exactly as promised.",
                "Very fair and transparent with the treatment plan and cost. No pressure to do unnecessary procedures. Rare honesty.",
                "My 6-year-old was scared but the dentist was so gentle and playful with her. She came out smiling. That's skill.",
                "The teeth cleaning was thorough and painless. My gums feel healthier and the dentist gave great aftercare advice.",
                "Good to know they use digital X-rays — less radiation and the results are instant. Modern and thoughtful setup.",
                "Got a second opinion here after another clinic gave a scary diagnosis. This doctor gave an honest assessment. Trusted immediately.",
                "Emergency appointment was given same day when I had a bad toothache. The relief after treatment was immediate.",
                "Follow-up calls are made after every major procedure to check on the patient. That level of care is exceptional.",
                "The assistant is warm and helpful — makes the whole experience feel less clinical and more human.",
                "Cost is very reasonable without any hidden charges. Itemized bill was given which I appreciated for insurance claims.",
                "The implant procedure was spread across multiple visits and every single one was comfortable and well-explained.",
                "Recommended the simplest and most affordable treatment option when they could have suggested something expensive. Integrity.",
                "Very good with adult patients who have dental anxiety. The team has clearly been trained to handle nervous patients.",
                "My whole family — 4 members — now come here exclusively. The trust built over one good visit is irreplaceable.",
                "The whitening treatment gave visible results in just one session. The doctor set realistic expectations beforehand too.",
                "Explained everything using a mirror so I could see exactly what was being done. That transparency builds enormous trust.",
                "The waiting area is comfortable and the magazines are recent — small thing but shows attention to the overall experience.",
                "My elderly mother is nervous about dental visits but leaves every appointment here feeling reassured. That's rare.",
                "The doctor noticed a potential issue I wasn't even aware of and addressed it early. Proactive care at its best.",
                "Saturday appointments available which is very convenient for working professionals. Thoughtful scheduling.",
                "The scaling and polishing here is done so thoroughly — my teeth haven't felt this clean in years.",
                "Very detailed about post-procedure instructions. Gave written instructions too so nothing gets forgotten. Professional.",
                "The receptionist handles appointment rescheduling without any fuss. Very accommodating and understanding.",
                "Children's area in the waiting room with toys and drawings on the wall. Smart design that puts kids at ease.",
                "The doctor spent extra time explaining the cause of my recurring sensitivity and gave long-term preventive advice.",
                "Never pushes cosmetic procedures unless you ask. Sticks to clinical necessity. That restraint builds trust.",
                "Painless injection technique — the anaesthesia was given so slowly I barely felt it. Clearly trained in patient comfort.",
                "The clinic is accessible via public transport and has a ramp for wheelchair users. Very inclusive setup.",
                "Night guard prescribed here fits perfectly — the impressions were taken with great precision on the first try.",
                "The doctor explains costs before starting any treatment so there are never any bill surprises. Very professional.",
                "After my filling, a 2-day follow-up call came from the clinic to check if there was any discomfort. Excellent aftercare.",
                "The new portable X-ray machine means I don't have to move between rooms during diagnosis. Convenient and efficient.",
                "The fluoride treatment was gentle and the benefits were explained clearly. Clearly a clinic that believes in prevention.",
                "Sterilisation trays are opened fresh in front of the patient. That level of transparency means everything.",
                "My previous dentist had given me the wrong diagnosis for 2 years. This doctor identified and corrected it in one visit.",
                "The entire team — from receptionist to assistant to doctor — communicates consistently. No confusion, no mixed messages.",
                "Yaar dentist se dar lagta tha pehle, but yahaan itna acha experience tha ki ab zyada tension nahi hoti. Good dentist hai.",
                "Root canal karwayi thi, weeks se darr raha tha. Bilkul dard nahi hua honestly. Doctor ka haath bahut acha hai.",
                "Clinic ekdum clean hai, sterilization sab ke saamne hoti hai. Immediately comfortable feel kiya yeh dekh ke.",
                "5 minute se zyada wait nahi karna pada appointment ke baad. Indian dental clinic mein yeh bohot rare hai bhai.",
                "8 mahine se braces ka treatment chal raha hai — har visit comfortable rahi hai. Progress exactly as promised.",
                "Doctor ne koi unnecessary procedure suggest nahi ki. Jo actual mein chahiye tha woh hi bola. Rare honesty hai.",
                "Meri 6 saal ki beti dar rahi thi — doctor ne itne gently handle kiya ki woh muskurate bahar aayi. Skill hai yeh.",
                "Teeth cleaning mein bilkul dard nahi tha. Gums healthy feel ho rahi hain ab. Doctor ne great aftercare tips bhi diye.",
                "Digital X-ray use karte hain yahan — less radiation, instant result. Modern setup dekh ke confidence aaya.",
                "Doosre clinic ne scary diagnosis di thi — yahaan second opinion li toh honest assessment mila. Trust ban gaya.",
                "Same day appointment diya tha toothache pe. Itni jaldi relief mili — really grateful hun.",
                "Major procedure ke baad follow-up call aaya clinic se. Is level of care ki expect nahi thi. Impressed hun.",
                "Assistant bahut warm hai — less clinical feel hota hai. Human touch matter karta hai yeh samajhte hain yahan.",
                "Bill mein koi hidden charges nahi the. Itemized receipt di — insurance claim ke liye bohot helpful tha.",
                "Implant ke multiple visits the — har ek comfortable thi aur doctor ne explain kiya every step pe. Bahut patient.",
                "Sab se sasta option recommend kiya jab expensive bhi suggest kar sakte the. Yeh integrity hai bhai.",
                "Dental anxiety waale patients ke saath bahut acha handle karta hai team. Pata chalta hai training achi hai.",
                "Poori family — 4 log — ab sirf yahaan aate hain. Ek acha experience ne permanent trust bana diya.",
                "Whitening ka result ek hi session mein dikh gaya. Doctor ne realistic expectations bhi set ki thi pehle se.",
                "Mirror se dikhaya kya treatment ho rahi hai — yeh transparency sab se zyada trust build karti hai mujhe.",
            ],
            'clinic' => [
                "The doctor actually listened to everything I said without rushing me. Spent a good 20 minutes understanding the issue properly.",
                "Got my reports the same day and the doctor called personally to explain the results. That follow-up is very rare.",
                "Waiting time was minimal despite it being a Monday morning. Well-managed appointment system.",
                "The doctor's diagnosis was accurate and the prescribed treatment worked within the expected time. Highly competent.",
                "Staff at reception is organized and helpful. They guided us through the paperwork without making us feel overwhelmed.",
                "Clean, sanitized environment — especially important post-COVID. Felt safe bringing my elderly parents here.",
                "The doctor didn't over-prescribe. Gave a practical treatment plan without recommending unnecessary tests. Trustworthy.",
                "Good experience for a first visit. The doctor explained the condition in simple language, not just medical jargon.",
                "Insurance claims were processed smoothly with staff assistance. Something that usually causes so much stress — handled easily.",
                "The paediatrician here is exceptional with children. My 4-year-old has no fear of visiting the doctor anymore.",
                "Emergency consultations handled promptly. When I called at 8 PM, the doctor returned my call within 10 minutes.",
                "The diagnostic lab inside the clinic is convenient. No need to go to a separate place for basic tests.",
                "Referral to a specialist was given without delay when the situation required it. The care coordination was excellent.",
                "Very straightforward about fees upfront. No surprise charges after the consultation. Transparent and professional.",
                "The nursing staff is compassionate and skilled. Injections are genuinely painless — something I notice every time.",
                "The doctor remembered details from my last visit without checking notes. Shows genuine interest in the patient's history.",
                "Good parking facility and wheelchair-accessible entrance. Thoughtful infrastructure for all types of patients.",
                "The skin treatment recommended actually showed visible results within 3 weeks. Evidence-based approach, very impressed.",
                "The general physician here has an excellent diagnostic instinct — caught something three other clinics had missed.",
                "Very practical about medication — prescribed generics where possible to keep costs down. That consideration is appreciated.",
                "The orthopaedic consultation was thorough — took time with the physical examination instead of just ordering scans.",
                "Online appointment booking works perfectly and the reminders via WhatsApp are very helpful. Modern and convenient.",
                "The doctor explained my blood report line by line until I fully understood what each value meant. Exceptional patience.",
                "Very good follow-up system — got a reminder for my next visit 2 days before. Shows organised patient management.",
                "The gynaecologist here makes patients feel completely comfortable. Very professional and sensitive in approach.",
                "Brought my mother-in-law who only speaks Hindi — the doctor and staff communicated entirely in Hindi without hesitation.",
                "The physiotherapy sessions recommended here have genuinely reduced my chronic back pain. Right advice, right treatment.",
                "The doctor explained the side effects of the medication honestly before prescribing. Informed consent done properly.",
                "Very good with chronic condition management — monthly check-ins are structured and the dosage adjustments are careful.",
                "The ENT specialist here used the latest endoscopic equipment. The diagnosis was clear and the treatment was quick.",
                "Report delivery via digital link was very convenient — could share it with family immediately on WhatsApp.",
                "Even on a walk-in basis the wait wasn't more than 30 minutes. Very well managed for the patient volume.",
                "The doctor took the time to ask about my lifestyle before prescribing. Holistic approach that's hard to find.",
                "The ophthalmologist here has a very calm manner — important for elderly patients who are nervous about eye procedures.",
                "Very ethical — told me the condition didn't need medication and recommended lifestyle changes instead. Rare honesty.",
                "The staff proactively informed me about my upcoming renewal for a chronic prescription. Good patient tracking system.",
                "Excellent antenatal care — the gynaecologist is supportive, answers every question, and makes the journey less stressful.",
                "The diet counsellor here gave a practical and sustainable plan — not an extreme one that's impossible to follow.",
                "The cardiologist did a thorough review of my history before suggesting any tests. No unnecessary investigations ordered.",
                "Five-star experience in terms of care and courtesy. Highly recommend this clinic to everyone in my network.",
                "Doctor ne baat sunne ka time liya bina rush kiye. 20 minute diye sirf sunne mein — aajkal milta nahi yeh.",
                "Same day reports aaye aur doctor ne personally call karke explain kiya. Yeh follow-up bohot rare hai honestly.",
                "Monday morning tha, wait nahi tha zyada. Appointment system bahut well managed hai yahaan.",
                "Jo diagnosis di woh accurate nikli, treatment time pe kaam aaya. Competent doctor hain yahan clearly.",
                "Reception pe sab organized tha — paperwork mein help ki, overwhelmed feel nahi hua. Good support team.",
                "Clean aur sanitized environment — elderly parents ko lekar aaya tha, safe feel kiya. Important hai yeh.",
                "Over-prescribe nahi kiya doctor ne. Practical treatment plan diya bina unnecessary tests ke. Trustworthy.",
                "Simple language mein explain kiya condition ko — medical jargon mein nahi. First visit experience acha tha.",
                "Insurance claim staff ki help se smooth ho gaya. Jo normally bohot stressful hota hai woh easy ho gaya.",
                "Paediatrician ne mere 4 saal ke bete ke saath itna acha kiya — ab woh doctor se darta nahi. Kaam ban gaya.",
                "Raat 8 baje call kiya tha, doctor ne 10 minute mein callback diya. Emergency mein yeh bahut kaam aata hai.",
                "Andar hi lab hai — alag jagah jaane ki zaroorat nahi basic tests ke liye. Convenient setup hai.",
                "Specialist ke paas referral bina kisi delay ke mila. Care coordination bahut acha tha yahan.",
                "Fees pehle hi bata di clearly. Consultation ke baad koi surprise charge nahi aaya. Transparent practice.",
                "Nurse ka haath itna acha tha — injection laga hi nahi practically. Baar baar notice karta hun yeh.",
                "Pichhli visit ki details yaad thi doctor ko bina notes dekhe. Patient mein genuinely interest dikhta hai.",
                "Parking acha hai aur wheelchair ramp bhi hai — sab ke liye accessible banaya hai. Thoughtful design.",
                "Skin treatment ke 3 week mein result dikh gaya. Evidence-based approach hai yahaan, random advice nahi.",
                "Teen logon ne same galat diagnosis di thi — yahaan ek visit mein sahi identify ho gaya. Relief tha bohot.",
                "Meri maaji sirf Hindi mein bolti hain — doctor aur staff ne poori baat Hindi mein ki. No problem at all.",
            ],
            'salon' => [
                "Finally found a salon where they actually listen to what haircut you want instead of doing whatever they feel like.",
                "The keratin treatment done here lasted 4 months — much longer than what I got at more expensive salons before.",
                "The ambiance is calming and the staff is professional. Had a head spa session that completely melted away my stress.",
                "Colour came out exactly as shown in the reference photo. No bleeding, no brassing — technically very skilled team.",
                "The threading and cleanup here is so precise — cleaned up my eyebrows without over-plucking. Exactly what I wanted.",
                "Reasonable prices for the quality of products and service. They use good brands, not cheap alternatives.",
                "The hair wash and blow-dry alone was worth the visit. Hair felt genuinely healthier for days after.",
                "Bridal package was very well organized — trial run done in advance, team was on time, and the look lasted all day.",
                "The facial here gave visible results — skin was glowing for almost a week. Can feel the quality of the products used.",
                "Appointment system is smooth and they actually stick to the time. No long waits sitting around doing nothing.",
                "The massage during the hair treatment is something I look forward to every single visit. Very skilled hands.",
                "Staff gave honest advice — recommended against a cut that wouldn't suit my face shape. That honesty is appreciated.",
                "The nail art done here is so detailed and long-lasting. Still looks perfect after 10 days. Exceptional work.",
                "Clean towels and fresh equipment every time. Hygiene standards are clearly taken seriously here.",
                "Walked in for a trim and the stylist noticed split ends I'd missed and fixed them too. Proactive and caring.",
                "The new trainee was supervised properly while doing my treatment. Shows the owner cares about maintaining quality.",
                "Never felt judged or rushed here. Relaxed atmosphere where you can enjoy the experience without pressure.",
                "My go-to salon for the past 2 years. Consistency in quality and service is their biggest strength.",
                "The hair spa treatment reduced my frizz significantly. Used the right products for my hair type without asking.",
                "The balayage here is done with such precision — very natural-looking gradient that grows out beautifully.",
                "Got a manicure and pedicure together and both were done with full attention. No rushing to finish one to start the other.",
                "The steam facial is so relaxing and the extraction afterwards is gentle. Skin feels amazing for days.",
                "The senior stylist consulted with me for 10 minutes before touching my hair. That approach builds real confidence.",
                "The products used for hair colouring are ammonia-free and the smell is minimal. Clearly sourced with care.",
                "The waxing here is thorough and not painful beyond what's normal. Good technique makes all the difference.",
                "Offered a scalp analysis before recommending products. Evidence-based approach to hair care, not just upselling.",
                "The lash extension done here lasted 3 weeks without any falling. The application technique is clearly excellent.",
                "Prebooking confirmations are sent via WhatsApp with reminders. Very professional for a local salon.",
                "The deep conditioning treatment reversed my dry, damaged hair after just 2 sessions. Visible and felt difference.",
                "The nail technician freehandled a design I sent as reference — the resemblance was incredible. Real skill.",
                "Even on a packed Saturday, nobody felt rushed. The salon has clearly built the right team-to-customer ratio.",
                "The face cleanup here doesn't leave skin red or irritated afterwards. Gentle products, gentle technique.",
                "Suggested a toner after my colour treatment to seal the cuticle — that extra step shows real expertise.",
                "The salon is wheelchair accessible and the staff immediately offered assistance without waiting to be asked.",
                "Hair fall treatment package recommended here has shown real improvement in 6 weeks. Evidence-based recommendation.",
                "The kids' hair service is handled with patience and fun — my daughter actually enjoyed getting her hair done here.",
                "The cold wax for upper lip is done so quickly and precisely — minimal redness, great results every time.",
                "The owner personally checks the work before any client leaves. That quality control sets this salon apart.",
                "Genuinely good at recommending what your hair needs versus what's just a trendy treatment. Honest expertise.",
                "The aroma in the salon is relaxing without being overpowering. A thoughtful environment to be in for an hour.",
                "Finally ek salon mila jahan sunते hain what you actually want instead of apni marzi se karte hain. Bahut relief.",
                "Keratin 4 mahine tak chala — pehle wali jagah se zyada lamba. Same price mein better result. No brainer.",
                "Head spa session karwaya — itna relax hua ki ghar jaake seedha so gaya 😄 Stress completely gone.",
                "Colour exactly photo jaisi aayi. Bleeding nahi, brassing nahi — technically bahut skilled team hai yahaan.",
                "Threading itni precise thi, over-pluck nahi kiya. Finally koi hai jo samajhta hai eyebrow shaping.",
                "Achhe brands use karte hain — cheap alternatives nahi lagate sirf margin badhane ke liye. Quality minded.",
                "Hair wash aur blow dry akela worth it tha puri visit ka. Baal genuinely healthy feel hue kaafi dino tak.",
                "Bridal package mein trial run pehle tha, team time pe aayi, look poore din tika — sab set tha.",
                "Facial ke baad skin 1 week glowing rahi. Products ki quality clearly achi hai, sasta nahi use karte.",
                "Appointment pe on time le liya — koi wait nahi tha. Rare hai yeh honestly salon mein.",
                "Hair treatment ke waqt massage itni aachi thi ki woh akele ke liye dobara aaunga. Kaafi skilled hain.",
                "Honest advice di — bola yeh cut suit nahi karega face shape pe. Us honesty ki wajah se trust ban gaya.",
                "Nail art 10 din baad bhi perfect lag raha tha. Application technique clearly excellent hai.",
                "Towels fresh the, equipment clean tha — hygiene seriously lete hain yahan. Comfortable feel hoti hai.",
                "Trim ke liye gayi thi, stylist ne split ends khud notice karke fix kiye bina extra charge ke. Proactive care.",
                "Trainee supervised tha properly — owner quality maintain karna chahta hai clearly. Achhi soch hai.",
                "Koi judgment nahi, koi rush nahi — relax atmosphere mein apna time le sakte ho. Rare quality hai.",
                "2 saal se aa rahi hun, ek baar bhi quality drop nahi hui. Yahi consistency loyal banati hai.",
                "Balayage itna natural laga — perfectly gradient tha, grow out bhi beautiful hota hai. Very skilled.",
                "Manicure aur pedicure dono ek saath karwaye — dono ko poora attention mila. Koi jaldi nahi ki gayi.",
            ],
            'barber' => [
                "The scissor cut here is precise — no machine buzz for everything. Can tell the barber actually learned the craft properly.",
                "Had a beard shape-up and it transformed my entire look. The barber has a great eye for what suits your face.",
                "Walked in without an appointment on a Sunday and was attended to within 10 minutes. Well-managed shop.",
                "The hot towel shave here is a proper experience — straight razor, warm lather, aftershave balm. Old school done right.",
                "My regular barber knows exactly how I want my hair without me explaining every time. That relationship is gold.",
                "Very clean setup — fresh cape for every customer, clean blades, sanitized scissors. Can see the professionalism.",
                "Got a haircut before a wedding and it stayed sharp for the entire 3-day event. That's a good cut.",
                "The head massage with the haircut is genuinely relaxing. Came stressed, left refreshed. Worth every rupee.",
                "The fade is done cleanly with proper blending — no harsh lines or uneven patches. Technically excellent.",
                "The barber patiently explained what would look good given my hairline and face shape. Great consultation.",
                "Affordable without feeling cheap. You get proper quality and the barber takes pride in his work.",
                "Even the basic trim is done with care here. No rushing, no carelessness. Impressive consistency.",
                "The hair and beard combo package is great value. Left looking completely put together.",
                "Very conversational and friendly barber — made a first-time visit feel comfortable immediately.",
                "The kids' haircut service is handled with a lot of patience. My 5-year-old sat still and came out looking great.",
                "Products used are good quality — the hair wax they applied kept the style intact for the whole day.",
                "Clean mirror, clean floor, clean tools. The basics are done right which builds trust in everything else.",
                "Been going here for 3 years. Followed this barber when he moved shops. That's how good he is.",
                "The eyebrow threading here is done precisely — not over-done. Finally a barber who understands male grooming properly.",
                "The D-tan face pack included after the shave was an unexpected bonus. Skin felt noticeably fresher.",
                "Booked via WhatsApp and the appointment was confirmed within 2 minutes. Very responsive and organised.",
                "The neck shave after a haircut is done with a fresh disposable blade every single time. Hygiene-first approach.",
                "The barber suggested a style that I would never have thought of myself — and it suits me perfectly. Great eye.",
                "Colour treatment here is done by someone who understands undertones. No orange brass, no muddy result.",
                "The scalp scrub treatment is something I now get every month. Noticed significant reduction in dandruff.",
                "The classic pompadour was shaped perfectly — took time to get the volume and direction right. Worth every minute.",
                "Beard straightening done here lasted 6 weeks cleanly. Very good technique and the result was natural-looking.",
                "The staff speaks respectfully and professionally at all times. A gentlemen's space done right.",
                "The nose hair trimming is included without extra charge. Small detail that completes the grooming experience.",
                "Very good with curly hair — understands how curls behave when dry versus wet. Adjusted the cut accordingly.",
                "The charcoal face mask treatment here is very effective — pores visibly reduced after the first session.",
                "The barber showed me how to maintain the style at home. That kind of professional guidance is rare.",
                "Opened on time even during festival days. Very reliable for pre-event grooming when timing matters.",
                "The pricing is displayed clearly on a board — no ambiguity, no post-service surprises. Honest business.",
                "The vintage-style shop decor is charming and feels authentic. Old school in the best possible way.",
                "Even during a busy Saturday queue, each customer is given full attention. No compromising on time per client.",
                "The hair spa here improved my scalp health visibly — less flaking and oiliness within 2 weeks.",
                "The skin fade with a razor edge lining was done perfectly — clean enough to last 3 weeks before any touch-up.",
                "The mustache trim is done with precision scissors, not an electric trimmer. The finish is much cleaner.",
                "Got a full grooming package before my sister's wedding. Every single service was done with care and skill.",
                "Bhai scissor cut itna clean tha — machine pe depend nahi karte yahan. Real barbering skill hai unke paas.",
                "Beard shape-up ne poora look change kar diya. Barber ki aankhon mein style dikha — great eye hai uska.",
                "Sunday ko bina appointment ke gaya tha, 10 minute mein le liya. Well managed shop hai clearly.",
                "Hot towel shave full experience tha — straight razor, warm lather, aftershave balm. Old school sahi mein.",
                "Mera regular barber mera style bina bataye jaanta hai — yeh relationship bohot valuable hoti hai bhai.",
                "Fresh cape, clean blades, sanitized scissors — sab dekh ke pata chala kitna professional setup hai.",
                "Shaadi se pehle haircut li thi, 3 din tak sharp rahi. Yahi toh acha haircut ki pehchaan hai.",
                "Head massage haircut ke saath mila — stressed aaya tha, refreshed gaya. Paise ekdum vasool.",
                "Fade ekdum clean tha, proper blending — koi harsh line nahi, koi uneven patch nahi. Technically solid.",
                "Barber ne face shape dekh ke pehle suggest kiya kya acha lagega. Itni patient consultation rare hai.",
                "Sasta hai without feeling cheap — quality hai aur barber ko apne kaam pe pride hai. Best combo.",
                "Basic trim bhi care se karta hai — koi jaldi nahi, koi carelessness nahi. Consistency impressive hai.",
                "Hair aur beard combo package great value tha. Ekdum put together nikalke gaya. Full enjoy.",
                "Pehli baar gaya tha, barber bhai ne comfortable feel karaya. Regular ban gaya usi din se.",
                "Bacche ka haircut karwaya — 5 saal ka hai mera beta, patiently handle kiya. Perfect result.",
                "Hair wax unhone lagaya jo poore din tika — good quality products use karte hain yahan.",
                "Clean mirror, clean floor, clean tools — basics sahi hain jo baaki sabpe trust banata hai.",
                "3 saal se aa raha hun, jab woh dusri jagah shift huye tab bhi follow kiya. Is level ka barber rare hai.",
                "Eyebrow threading bhi karte hain properly — finally barber jo male grooming properly samajhta hai.",
                "Poori grooming kit sister ki shaadi se pehle yahaan se li — har service care se ki gayi. Full set tha.",
            ],
            'gym' => [
                "The trainer here makes a proper customised plan and actually tracks your progress week to week. Not just generic advice.",
                "Equipment is well-maintained and cleaned regularly. Never had to wipe down a machine before using it — staff does it.",
                "The morning batch has a great energy. Motivating group of people and a trainer who genuinely pushes you.",
                "Joined 6 months ago and lost 9 kg — the structured program and diet guidance from the trainer made all the difference.",
                "The ventilation here is excellent — even on hot days the gym doesn't smell or feel stuffy. Small but important detail.",
                "Flexible timings that fit around work schedule. Early morning 5:30 AM batch is always supervised by a trainer.",
                "The trainer corrected my squat form on day one and it prevented an injury I would have definitely gotten. Knowledgeable.",
                "No unnecessary supplements pushed on members. The focus is on natural training and proper diet. Honest approach.",
                "The zumba classes here are fun and high energy. The instructor is certified and keeps the sessions well-paced.",
                "Good variety of cardio machines and free weights. No waiting in queue even during peak hours.",
                "The trial class was so good that I signed up immediately. The trainer knew exactly what level I was at and adjusted.",
                "Women's section is well-maintained and supervised. Felt safe and comfortable from day one.",
                "Locker rooms are clean and the showers actually have hot water. These basics are often ignored at other gyms.",
                "The yearly membership offers excellent value — especially given the quality of coaching you get included.",
                "Weight loss challenge conducted here was very motivating. Community aspect of the gym is a huge plus.",
                "The trainer checks in even on rest days to see if diet is on track. That accountability makes a real difference.",
                "Never felt like a number here. The owner knows every member by name. Very personal and community-driven.",
                "Saw real results in 3 months. Clean diet guidance plus good training equals exactly what they promised.",
                "The CrossFit sessions here are intense but well-supervised — no recklessness, always with proper form guidance.",
                "The yoga batch in the evening is taken by a very experienced instructor. Felt the difference in flexibility in 4 weeks.",
                "The diet chart given was practical and suited to Indian eating habits — not some western keto plan that's impossible to follow.",
                "My teenage son joined here and the trainer has been incredibly motivating and patient with him. Great with youngsters.",
                "The gym is never overcrowded because they cap memberships sensibly. You can always get to the equipment you need.",
                "The audio system and music keeps the energy high without being disruptively loud. Nicely balanced.",
                "Injury rehabilitation sessions offered here are very structured. Recovered from my knee problem in 8 weeks.",
                "The spin class instructor is incredibly energetic — even the most tired evening session feels alive and pumping.",
                "Free body composition analysis every month shows you real progress beyond just the weighing scale. Very motivating.",
                "The trainer is available on WhatsApp for quick questions between sessions. That accessibility is above and beyond.",
                "The gym has a parking area and is 2 minutes from the metro station — the location makes consistency easy.",
                "The protein supplements sold here are genuine and authentically sourced. No grey-market products, verified brands only.",
                "The prenatal fitness class is guided by a certified professional. My wife has had a much more comfortable pregnancy because of it.",
                "Weekend bootcamp sessions are optional but so rewarding. The trainer pushes everyone past their comfort zone safely.",
                "The towel service is included in the membership. A small perk but one that makes the morning routine so much smoother.",
                "Progress photos are taken every month and shared securely. Seeing the transformation side by side is incredibly motivating.",
                "The cooling-down stretches after every session are properly guided. Significantly reduced my post-workout soreness.",
                "Even after my membership lapsed for a month, rejoining was easy with no unnecessary penalties. Flexible and understanding.",
                "The senior trainer mentors the junior trainers on the floor. Can see the quality control being actively maintained.",
                "Abs class on Saturdays is genuinely tough but the results show within 6 weeks. Worth every second of discomfort.",
                "The air conditioning is serviced regularly — you can tell because it's always even and clean-smelling. Good maintenance.",
                "The gym community here organises occasional group runs and treks. That social aspect makes fitness genuinely enjoyable.",
                "Trainer ne proper customised plan diya aur weekly progress track karta hai. Generic advice nahi — real coaching.",
                "Equipment clean hai, well maintained hai — staff khud saaf karta hai. Kabhi machine dirty nahi mili.",
                "Morning batch ka energy level ekdum mast hai. Motivating log hain aur trainer genuinely push karta hai.",
                "6 mahine mein 9 kg gaya — structured program aur diet guidance ki wajah se. Real results milte hain yahaan.",
                "Ventilation bahut acha hai — garmi ke din bhi gym mein smell nahi aata. Small detail but matters a lot.",
                "5:30 AM batch bhi trainer ke saath hota hai. Flexible timings jo work schedule ke saath fit ho jaate hain.",
                "Squat form day one pe correct kiya trainer ne — injury se bacha liya honestly. Knowledgeable hai woh.",
                "Supplements push nahi karte — natural training aur diet pe focus hai. Honest approach bahut acha lagta hai.",
                "Zumba class ekdum high energy hai — certified instructor hai, sessions well paced rehte hain. Full enjoy.",
                "Cardio machines ka variety hai, free weights bhi — queue nahi lagti peak hours mein bhi. Well managed.",
                "Trial class itna acha tha ki turant join kar liya. Trainer samajh gaya tha mera level aur accordingly adjust kiya.",
                "Women's section well maintained hai aur supervised — day one se safe aur comfortable feel kiya.",
                "Locker rooms clean hain, showers mein hot water aata hai — basics jo gyms ignore karte hain, yahan sahi hain.",
                "Yearly membership bohot value for money hai especially coaching quality dekhte hue jo included hai.",
                "Weight loss challenge motivating tha — community aspect of this gym is genuinely a plus point.",
                "Trainer rest days pe bhi check karta hai diet ke liye. Yeh accountability actually kaam aati hai.",
                "Owner har member ko naam se jaanta hai — personal touch hai yahaan, number nahi hain hum log.",
                "3 mahine mein real results aaye. Diet + training combination exactly worked as they said it would.",
                "CrossFit sessions intense hain but supervised properly — form ke saath koi compromise nahi hota.",
                "Turf clean hai, lights acha hai, booking smooth tha — full enjoy hua match. Definitely aaunga dobara.",
            ],
            'retail' => [
                "The staff actually knows the products and helped me pick what suited my needs — not just whatever was most expensive.",
                "Got exactly what I needed at a fair price. No pressure to upgrade or buy add-ons. Refreshing shopping experience.",
                "The billing counter is quick and the staff double-checked everything before bagging. No wrong items, no missing pieces.",
                "Wide variety of products, well-organized by category. Easy to find things without needing to ask every 2 minutes.",
                "Exchange process was smooth and hassle-free. No questions asked, no drama. That trust builds loyalty.",
                "The owner was present and personally helped us when we had a doubt. Hands-on involvement shows dedication.",
                "Bought a gift here and the staff gift-wrapped it beautifully without extra charges. Went above and beyond.",
                "The product quality is genuinely better than what you get from bigger chain stores at the same price range.",
                "Very honest — told me the cheaper option would serve my need just as well instead of pushing the expensive one.",
                "The store is clean and well-lit. Product labels are clear. Everything feels well-curated, not cluttered.",
                "Got a follow-up call after purchase to check if everything was satisfactory. That post-sale care is exceptional.",
                "Staff knows the stock deeply — when I asked for a specific spec, they found it immediately without fumbling around.",
                "Competitive pricing and genuine products. No duplicate or grey-market items here, which I've seen in other shops.",
                "Easy parking nearby and the shop is spacious enough to browse comfortably. Practical location and good layout.",
                "The loyalty program gives real benefits. My 10th purchase discount was applied without me having to remind them.",
                "Bulk order for office supplies was handled efficiently with proper invoicing for GST. Very professional.",
                "Can always trust the advice here. Never been steered wrong. That's why I keep coming back for everything.",
                "Wonderful neighbourhood shop that gives you the personal attention no big mall store ever will.",
                "The staff offered to demonstrate the product before I purchased — that confidence in what they sell is reassuring.",
                "Got price-matched with an online offer without any argument. They want the business and it shows in their attitude.",
                "Home delivery arranged same day when I couldn't carry the item myself. Very accommodating and no extra charge.",
                "The product range is curated intelligently — every item on the shelf seems to have a reason for being there.",
                "The shop has a kids' corner which made shopping with my toddler stress-free for the first time ever. Brilliant idea.",
                "Asked for an item that wasn't in stock and they sourced it within 3 days and called me when it arrived. Impressive.",
                "The store layout was recently redone and finding items is now so intuitive. Someone really thought about the customer experience.",
                "The staff flagged a cheaper alternative when I was about to overpay for a brand name. That honesty is rare in retail.",
                "Very clean trial rooms with good lighting. Makes a huge difference when buying clothes — could see colours accurately.",
                "The billing software is fast and the receipts have all details including HSN codes. Useful for expense reimbursement.",
                "Seasonal sale prices are genuine — not inflated MRP with fake discounts. Transparent pricing builds real trust.",
                "The staff rotates floor duties so someone is always available nearby without hovering uncomfortably. Well-managed.",
                "EMI options available without complicated paperwork. Helped me get what I needed without straining the budget.",
                "The return policy is clearly explained at point of sale. No surprises when I actually needed to return an item.",
                "Very good for senior citizens — staff speaks slowly, explains options clearly, and is very patient throughout.",
                "The product is exactly as described on the label. No misleading packaging or hidden details. Straight honest deal.",
                "The store participates in the local environmental initiative — accepts old batteries and packaging for recycling. Thoughtful.",
                "Got a text with the invoice immediately after purchase — very helpful for expense tracking and warranty purposes.",
                "The staff member who helped me had used the product personally and gave a genuine recommendation. Real experience.",
                "The installation guidance provided with the purchase was detailed and accurate. Set up the product easily at home.",
                "The shop opens on time every day. Reliability and punctuality in a retail store says everything about the owner's values.",
                "My corporate account was set up quickly and subsequent orders are always handled with priority. Excellent B2B service.",
                "Staff ne exactly kya chahiye tha woh samajha aur suggest kiya — sabse expensive option nahi push kiya. Honest.",
                "Fair price pe exact cheez mili, koi pressure nahi tha add-ons ka. Refreshing shopping experience tha.",
                "Billing counter fast tha, sab double check kiya bagging se pehle. Koi galat item nahi, koi missing piece nahi.",
                "Wide variety hai aur well organized bhi — bina har 2 minute mein kisi se puche cheezein dhoondh sakta hun.",
                "Exchange smooth tha, koi sawaal nahi, koi drama nahi. Yeh trust hi loyalty banata hai — wapas aaonga.",
                "Owner present tha personally aur doubt clear kiya — hands-on involvement dikhta hai dedication mein.",
                "Gift yahan se liya tha, staff ne gift wrap kiya bina extra charge ke. Yeh above and beyond hai.",
                "Quality genuinely better hai bade chain stores se same price range mein. Value for money clearly.",
                "Honest the — bola cheaper option mera kaam kar dega. Zyada expensive nahi push kiya. Rare in retail.",
                "Store clean hai, well lit hai, labels clear hain. Curated feel hai, cluttered nahi — pleasant experience.",
                "Purchase ke baad follow-up call aaya ki sab theek hai — post-sale care aise hi hona chahiye.",
                "Staff ne specific spec pucha toh immediately dhoondh ke liya — stock ki deep knowledge hai inhe.",
                "Genuine products hain yahaan — duplicate ya grey market wala nahi mila kabhi. Trust hai is wajah se.",
                "Parking easy hai, shop spacious hai — comfortably browse kar sakte ho bina kisi ke upar gire.",
                "Loyalty program genuinely beneficial hai — 10th purchase discount apne aap apply hua bina yaad dilaye.",
                "Bulk office order properly handle hua GST invoice ke saath. Professional B2B service hai yahan.",
                "Yahaan ki advice pe trust hai — kabhi galat suggest nahi kiya. Isi liye har cheez yahaan se leta hun.",
                "Neighbourhood shop hai but attention aur care jo dete hain woh koi mall nahi deta. Special feel hai.",
                "Product demonstrate kiya khud use karne se pehle — confidence dikhta hai jo sell karte hain usmein.",
                "Online price match kiya bina argument ke — business chahiye tha inhe aur dikha bhi. Smart approach.",
                "Same day home delivery karwayi jab item carry nahi ho raha tha. No extra charge. Bohot helpful the.",
            ],
        ];

        if (array_key_exists($domain, $pools)) {
            return $pools[$domain];
        }

        // For unknown/custom domains — reference the domain naturally
        return [
            "Really enjoyed our visit. The staff was welcoming and everything was very well organized from start to finish.",
            "Came here on a recommendation and it absolutely lived up to the hype. Will be telling everyone I know.",
            "The team here is clearly passionate about what they do — you can feel that care in every single interaction.",
            "Great experience from start to finish. The pricing is fair and the quality is genuinely very good.",
            "My family visited together and everyone had a wonderful time. A very well managed place that we'll return to.",
            "The staff went out of their way to make sure we were comfortable. That kind of hospitality is becoming rare.",
            "Clean, professional, and thoroughly enjoyable. Exactly what you hope for and then some.",
            "Visited for the first time and already planning the next visit. Left feeling very impressed.",
            "Consistent quality and a friendly team. Exactly the kind of place you feel proud recommending to others.",
            "Everything was handled so professionally. No confusion, no unnecessary waiting. Everything just worked.",
            "Genuinely surprised by how good the experience was. It exceeded my expectations completely.",
            "The person who attended to us was knowledgeable and helpful without being at all pushy. Perfect balance.",
            "Worth every rupee spent. The experience here is unlike what you get at most places in this area.",
            "Left with a big smile. That's the best review I can give any place honestly.",
            "Very well managed and run — you can tell there's real thought put into the customer experience.",
            "A hidden gem that more people absolutely need to know about. Spreading the word to everyone.",
            "Five stars without any hesitation. Truly one of the best experiences I've had in this area.",
            "Already recommended this place to five people this week alone. It's genuinely that good.",
            "The attention to detail here is what sets it apart. Every small thing is thought through carefully.",
            "Brought my parents along and they were thoroughly impressed. That says everything I need to say.",
            "The booking process was seamless and the experience matched every expectation they set. Reliable.",
            "Never felt like just another customer here. The team made us feel genuinely valued throughout.",
            "The quality is very consistent — visited three times and each time was as good as the last.",
            "The place is spotlessly clean and very well presented. Shows real pride in what they're offering.",
            "Really appreciate how the staff handled a small issue I raised — quickly and without making a fuss.",
            "Wonderful experience for the whole family, including the kids. Inclusive and thoughtfully managed.",
            "The pricing is very transparent — no hidden charges or surprise bills. Refreshingly honest.",
            "Everything from entry to exit was smooth. No friction, no delays, just a great overall experience.",
            "The team clearly trains together because the service feels consistent regardless of who helps you.",
            "A place that genuinely delivers on what it promises. That follow-through is more rare than it should be.",
            "Left feeling like I'd got excellent value — not just for money but for time too. Efficient and enjoyable.",
            "Took a colleague here on his first visit to the city and he immediately asked when we could come back.",
            "The staff is always calm and composed even when busy. That professionalism makes the visit stress-free.",
            "Visited during peak hours and still received the same quality of attention. Impressive crowd management.",
            "Would confidently send any guest or out-of-town friend here. That's my highest form of recommendation.",
            "The feedback they received from us last time was clearly acted upon. Shows they actually listen. Impressive.",
            "A genuinely positive experience that I keep thinking about days later. That kind of impression is rare.",
            "The place feels like it's run by people who actually care — not just about the business but about the people.",
            "Came back after a year and was happy to see the quality has only improved. Growth with no compromise.",
            "Every single member of the team I interacted with was courteous, capable, and genuinely helpful.",
            "Bhai seedha bolunga — bahut acha experience tha. Staff friendly tha aur sab well organised tha. Will come again.",
            "Dosto ke saath aaya tha, sabne enjoy kiya. Koi complaint nahi thi kisi ko bhi. Full paisa vasool.",
            "Pehli baar aaya tha, but last baar nahi hoga. Itna acha tha ki wapas aana pakka hai.",
            "Sab cheez professionally handle ki gayi — koi confusion nahi, koi unnecessary wait nahi. Smooth experience.",
            "Owner genuinely care karta hai — personally aa ke puchha kaisa laga. Yeh attitude hi is jagah ko alag banata hai.",
            "Family ke saath aaya tha — baade khush, bachche khush, budget mein bhi raha. Kya chahiye aur?",
            "Prices transparent the, koi hidden charges nahi. Honest business hai yeh — isi liye trust banata hai.",
            "Recommend kiya tha ek dost ne aur bilkul sach tha uska review. Hype ke barabar experience tha.",
            "Staff ka attitude bahut acha tha — helpful tha, pushy nahi tha. Exactly jaisa hona chahiye.",
            "Har detail pe dhyan diya gaya — choti choti cheezein hoti hain jo overall experience bana deti hain.",
            "Teen baar aa chuka hun, har baar same quality. Consistency hi sabse badi baat hai kisi bhi jagah ki.",
            "Ek baar try karo, phir khud samjh jaoge kyun sab isko recommend karte hain. Guarantee se acha lagega.",
            "Jo promise kiya tha woh deliver kiya — without any excuses. Yeh follow-through bahut rare hai aajkal.",
            "Akele gaya tha pehli baar, bilkul comfortable feel kiya. Safe aur welcoming environment hai.",
            "Sabse acha part — koi pressure nahi tha kuch bhi extra lene ka. Apni marzi se enjoy kar saka.",
            "Meri complaint pe immediately action liya bina koi argument kiye. Yeh attitude hi loyalty banata hai.",
            "5 logon ko already recommend kar chuka hun is hafte. Itna acha tha ki share karna hi padta hai.",
            "Ek saal baad dobara aaya — quality aur service dono improve huye hain. Growth ke saath no compromise.",
            "Poori team courteous thi — receptionist se lekar last person tak. Consistent culture hai yahaan clearly.",
        ];
    }

    // ── Dashboard ─────────────────────────────────────────────────────────────

    public function dashboard(Request $request): JsonResponse
    {
        $tid  = $request->_tenant_id;
        $from = $request->query('from');
        $to   = $request->query('to');
        $ratingFilter = $request->query('rating');
        $view = $request->query('view'); // 'public' | 'internal' | null = all

        $query = FeedbackSubmission::where('tenant_id', $tid)->latest();

        if ($from)         $query->whereDate('created_at', '>=', $from);
        if ($to)           $query->whereDate('created_at', '<=', $to);
        if ($ratingFilter) $query->where('rating', $ratingFilter);
        if ($view === 'public')   $query->where('is_internal', false);
        if ($view === 'internal') $query->where('is_internal', true);

        $submissions = $query->with('qrCode:id,label,placement')->paginate(30);

        // Aggregates (always unfiltered by rating/view for stats)
        $baseQuery = FeedbackSubmission::where('tenant_id', $tid);
        if ($from) $baseQuery->whereDate('created_at', '>=', $from);
        if ($to)   $baseQuery->whereDate('created_at', '<=', $to);

        $total   = (clone $baseQuery)->count();
        $average = $total > 0 ? round((clone $baseQuery)->avg('rating'), 1) : 0;

        $breakdown = (clone $baseQuery)
            ->selectRaw('rating, count(*) as count')
            ->groupBy('rating')
            ->pluck('count', 'rating')
            ->toArray();

        $ratingBreakdown = [];
        for ($i = 1; $i <= 5; $i++) {
            $ratingBreakdown[$i] = $breakdown[$i] ?? 0;
        }

        return $this->success([
            'submissions' => $submissions,
            'stats' => [
                'total'    => $total,
                'average'  => $average,
                'breakdown'=> $ratingBreakdown,
                'public'   => (clone $baseQuery)->where('is_internal', false)->count(),
                'internal' => (clone $baseQuery)->where('is_internal', true)->count(),
            ],
        ]);
    }
}
