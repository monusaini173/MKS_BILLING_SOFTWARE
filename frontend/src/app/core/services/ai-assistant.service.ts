import { Injectable, signal } from '@angular/core';

export interface AiMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: Date;
  category?: string;
  actions?: { label: string; route?: string; queryParams?: any; externalUrl?: string; icon?: string }[];
  whatsappTemplate?: string;
}

export interface QuickPrompt {
  id: string;
  title: string;
  query: string;
  category: 'ALL' | 'BILLING' | 'CREDIT' | 'GROWTH' | 'GST' | 'STOCK';
  icon: string;
}

@Injectable({
  providedIn: 'root'
})
export class AiAssistantService {
  isOpen = signal<boolean>(false);
  isTyping = signal<boolean>(false);
  selectedCategory = signal<'ALL' | 'BILLING' | 'CREDIT' | 'GROWTH' | 'GST' | 'STOCK'>('ALL');
  
  messages = signal<AiMessage[]>([
    {
      id: 'welcome_1',
      sender: 'bot',
      text: `🙏 **नमस्ते दुकानदार भाई!**\nमैं आपका डिजिटल **MKS मुनीम जी AI (दुकानदार 24/7 AI सहायक)** हूँ।\n\nआप मुझसे दुकानदारी, व्यापार और सॉफ्टवेयर से जुड़ा कोई भी सवाल पूछ सकते हैं:\n• 📲 **WhatsApp बॉट क्या है और इसके क्या फायदे हैं?**\n• 💰 **उधारी का पैसा जल्दी व प्यार से कैसे वसूलें?**\n• 🧾 **फास्ट POS बिलिंग व कीबोर्ड शॉर्टकट कैसे चलाएं?**\n• 📈 **दुकान की बिक्री व मुनाफा 2x कैसे करें?**\n• 🏷️ **बारकोड स्टिकर व Google Lens QR कोड कैसे बनाएं?**\n• 📜 **GST, HSN कोड व CA मासिक रिपोर्ट कैसे निकालें?**\n\nनीचे दिए गए सुझाव पर क्लिक करें या अपना सवाल लिखकर / बोलकर पूछें! 👇`,
      timestamp: new Date(),
      actions: [
        { label: '🧾 नया बिल बनाएं', route: '/billing', icon: 'fa-solid fa-calculator' },
        { label: '👥 ग्राहक खाता खोलें', route: '/customers', icon: 'fa-solid fa-users' },
        { label: '📢 नया स्टॉक ब्रॉडकास्ट', route: '/products', queryParams: { action: 'broadcast' }, icon: 'fa-brands fa-whatsapp' }
      ]
    }
  ]);

  quickPrompts: QuickPrompt[] = [
    { id: 'p1', title: '📲 WhatsApp बॉट क्या है व फायदे?', query: 'WhatsApp बॉट क्या होता है और इससे दुकानदार को क्या फायदे हैं?', category: 'BILLING', icon: 'fa-brands fa-whatsapp' },
    { id: 'p2', title: '💰 उधारी कैसे वसूलें?', query: 'उधारी का पैसा जल्दी और प्यार से कैसे वसूलें?', category: 'CREDIT', icon: 'fa-solid fa-hand-holding-dollar' },
    { id: 'p3', title: '🧾 नया बिल कैसे बनाएं?', query: 'सॉफ्टवेयर में नया बिल कैसे बनाएं और डिस्काउंट कैसे दें?', category: 'BILLING', icon: 'fa-solid fa-receipt' },
    { id: 'p4', title: '📈 दुकान की बिक्री कैसे बढ़ाएं?', query: 'दुकान में ग्राहकों की भीड़ और बिक्री बढ़ाने के तरीके बताएं', category: 'GROWTH', icon: 'fa-solid fa-chart-line' },
    { id: 'p5', title: '🏷️ बारकोड स्टिकर कैसे प्रिंट करें?', query: 'सामान पर लगाने के लिए बारकोड और QR स्टिकर कैसे प्रिंट करें?', category: 'STOCK', icon: 'fa-solid fa-barcode' },
    { id: 'p6', title: '📜 GST रिपोर्ट कैसे निकालें?', query: 'CA और टैक्स फाइलिंग के लिए GST रिपोर्ट कैसे निकालें?', category: 'GST', icon: 'fa-solid fa-file-invoice-dollar' },
    { id: 'p7', title: '📦 डेड स्टॉक कैसे निकालें?', query: 'दुकान में अटका हुआ पुराना और डेड स्टॉक कैसे तेजी से बेचें?', category: 'STOCK', icon: 'fa-solid fa-boxes-packing' },
    { id: 'p8', title: '🪔 त्योहारों पर क्या ऑफर दें?', query: 'त्योहारों पर ग्राहकों को आकर्षित करने के लिए क्या ऑफर चलाएं?', category: 'GROWTH', icon: 'fa-solid fa-gift' }
  ];

  openChat(initialPrompt?: string) {
    this.isOpen.set(true);
    if (initialPrompt) {
      this.askQuestion(initialPrompt);
    }
  }

  closeChat() {
    this.isOpen.set(false);
  }

  toggleChat() {
    this.isOpen.update(v => !v);
  }

  clearChat() {
    this.messages.set([
      {
        id: 'welcome_' + Date.now(),
        sender: 'bot',
        text: `🧹 **चैट क्लियर कर दी गई है!**\nमैं आपकी क्या मदद कर सकता हूँ? नीचे दिए सुझाव चुनें या अपना सवाल टाइप / बोलें।`,
        timestamp: new Date()
      }
    ]);
  }

  async askQuestion(userText: string) {
    const trimmed = userText.trim();
    if (!trimmed) return;

    // Add user message
    const userMsg: AiMessage = {
      id: 'usr_' + Date.now(),
      sender: 'user',
      text: trimmed,
      timestamp: new Date()
    };
    this.messages.update(msgs => [...msgs, userMsg]);

    this.isTyping.set(true);

    try {
      // 1. First try calling Backend AI endpoint (/api/ai/ask) which supports Gemini/OpenAI
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: trimmed }),
        signal: controller.signal
      }).catch(() => null);

      clearTimeout(timeoutId);

      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        if (data && data.success && data.answer) {
          const botMsg: AiMessage = {
            id: 'bot_' + Date.now(),
            sender: 'bot',
            text: data.answer,
            timestamp: new Date(),
            actions: [
              { label: '🧾 POS बिलिंग', route: '/billing', icon: 'fa-solid fa-calculator' },
              { label: '👥 ग्राहक खाता', route: '/customers', icon: 'fa-solid fa-users' },
              { label: '📢 WhatsApp ब्रॉडकास्ट', route: '/products', queryParams: { action: 'broadcast' }, icon: 'fa-brands fa-whatsapp' }
            ]
          };
          this.messages.update(msgs => [...msgs, botMsg]);
          this.isTyping.set(false);
          return;
        }
      }
    } catch (e) {
      // Fall through to local intelligent engine
    }

    // 2. Local Multilingual AI Engine fallback (instant & language-matched)
    setTimeout(() => {
      const response = this.resolveQuery(trimmed);
      const botMsg: AiMessage = {
        id: 'bot_' + Date.now(),
        sender: 'bot',
        text: response.text,
        timestamp: new Date(),
        actions: response.actions,
        whatsappTemplate: response.whatsappTemplate
      };
      this.messages.update(msgs => [...msgs, botMsg]);
      this.isTyping.set(false);
    }, 50);
  }

  private resolveQuery(query: string): { text: string; actions?: any[]; whatsappTemplate?: string } {
    const raw = query.toLowerCase().trim();
    const q = raw.replace(/[^\w\s\u0900-\u097F]/gi, ' ').replace(/\s+/g, ' ');

    // 🧮 0. LIVE MATH / GST / DISCOUNT CALCULATION DETECTOR
    const mathResponse = this.checkAndSolveCalculation(raw);
    if (mathResponse) return mathResponse;

    // ❤️ 1. LOVE / AFFECTION & COMPLIMENTS (e.g. "I love you", "love u", "pyaar", "bhai ho tum mere")
    if (q.includes('love you') || q.includes('love u') || q.includes('i love u') || q.includes('i love you') || 
        q.includes('लव यू') || q.includes('आई लव यू') || q.includes('प्यार') || q.includes('pyaar') || 
        q.includes('dil se') || q.includes('dil jeet liya') || q.includes('you are best') || q.includes('best ai')) {
      return {
        text: `❤️ **अरे बहुत-बहुत धन्यवाद भाई साहब! आपका यह प्यार और भरोसा ही मेरी असली कमाई है!** 😊🙏\n\nमैं एक डिजिटल **AI मुनीम जी** हूँ, तो मेरा दिल तो बस आपकी दुकान की तेज बिलिंग, समय पर उधारी वसूली और आपके व्यापार को **2x मुनाफे** की ओर ले जाने की खुशी में धड़कता है! 💼✨\n\nबताइए आज दुकान में किस चीज़ में मदद करूँ?\n• 🧾 नया सुपरफास्ट बिल काटना है?\n• 💰 उधारी का तकादा मैसेज भेजना है?\n• 📢 या ग्राहकों को WhatsApp पर नया ऑफर भेजना है?`,
        actions: [
          { label: '🧾 नया बिल बनाएं', route: '/billing', icon: 'fa-solid fa-calculator' },
          { label: '👥 उधारी खाता देखें', route: '/customers', icon: 'fa-solid fa-users' },
          { label: '📢 WhatsApp ब्रॉडकास्ट', route: '/products', queryParams: { action: 'broadcast' }, icon: 'fa-brands fa-whatsapp' }
        ]
      };
    }

    // 🤖 2. WHO ARE YOU / TUM KAUN HO
    if (q.includes('kaun ho') || q.includes('who are you') || q.includes('tum kaun') || q.includes('aap kaun') || q.includes('कौन हो') || q.includes('तुम्हारा नाम') || q.includes('naam kya hai') || q.includes('kya karte ho')) {
      return {
        text: `🤖 **मैं हूँ MKS मुनीम जी AI — आपका 24/7 डिजिटल व्यापार सहायक!** 🌸\n\nमेरा काम है आपकी दुकानदारी को आसान, तेज और पूरी तरह आधुनिक बनाना:\n• 🧾 **5 सेकंड में POS बिलिंग** व डिस्काउंट\n• 📲 **ऑटोमैटिक WhatsApp बिल व ऑफर ब्रॉडकास्ट**\n• 💰 **उधारी वसूली के अचूक तरीके व तकादा संदेश**\n• 📦 **कम स्टॉक अलर्ट व बारकोड स्टिकर प्रिंटिंग**\n• 📜 **CA और GST टैक्स रिपोर्ट्स**\n\nआप मुझसे दुकानदारी से जुड़ा कोई भी सवाल कभी भी पूछ सकते हैं!`,
        actions: [
          { label: '🧾 POS बिलिंग', route: '/billing', icon: 'fa-solid fa-calculator' },
          { label: '📊 डैशबोर्ड', route: '/dashboard', icon: 'fa-solid fa-chart-line' }
        ]
      };
    }

    // ☕ 3. CHAI / KHANA / CASUAL FRIENDLY TALK
    if (q.includes('chai') || q.includes('chaye') || q.includes('tea') || q.includes('khana') || q.includes('khane') || q.includes('चाय') || q.includes('खाना') || q.includes('nashta')) {
      return {
        text: `☕ **अरे वाह भाई साहब! आपकी चाय और प्यार की पेशकश ने दिल खुश कर दिया!** 😊\n\nमैं तो डिजिटल मुनीम हूँ, मेरी खुराक तो आपके कंप्यूटर का इंटरनेट और आपके दुकान की बढ़ती बिक्री है! ⚡\nआप आराम से गरमा-गरम चाय की चुस्की लें और दुकान की बिलिंग व उधारी का काम मुझ पर छोड़ दें! 📊`,
        actions: [
          { label: '🧾 नया बिल काटें', route: '/billing', icon: 'fa-solid fa-calculator' },
          { label: '📊 आज का हिसाब देखें', route: '/dashboard', icon: 'fa-solid fa-chart-line' }
        ]
      };
    }

    // 🌙 4. GOOD NIGHT / SHUBH RATRI / ALVIDA
    if (q.includes('good night') || q.includes('shubh ratri') || q.includes('शुभ रात्रि') || q.includes('so jao') || q.includes('bye') || q.includes('alvida')) {
      return {
        text: `🌙 **शुभ रात्रि भाई साहब! (Good Night)** 🌸\n\nदुकान का सारा हिसाब-किताब सुरक्षित रूप से सहेज दिया गया है।\nकल का दिन आपकी दुकान के लिए और अधिक ग्राहकों व बंपर मुनाफे से भरा हो! आराम से सोइए, मुनीम जी 24/7 तैनात है! 😴✨`,
        actions: [
          { label: '📊 दिनभर की कुल बिक्री रिपोर्ट', route: '/dashboard', icon: 'fa-solid fa-chart-line' }
        ]
      };
    }

    // 👋 5. GREETINGS & INTRODUCTIONS
    if (/^(hi|hello|hey|namaste|pranam|ram ram|radhe radhe|jai shri ram|namaskar|kem cho|kasa kay|salam|sat sri akal|kaise ho|kya hal hai|good morning|good evening|good afternoon)/i.test(raw) || 
        q === 'hi' || q === 'hello' || q === 'नमस्ते' || q === 'प्रणाम' || q === 'राम राम') {
      return {
        text: `🙏 **नमस्ते दुकानदार भाई!**\nमैं आपका डिजिटल **MKS मुनीम जी AI** हूँ। आपका दिन और व्यापार दोनों मंगलमय हों!\n\nमैं आपकी दुकान के हर काम को आसान और मुनाफेदार बनाने के लिए यहाँ 24/7 तैयार हूँ:\n• 📲 **WhatsApp बॉट के फायदे व उपयोग**\n• 💰 **उधारी वसूली व डिजिटल खाता**\n• 🧾 **सुपरफास्ट POS बिलिंग व डिस्काउंट**\n• 📈 **दुकान की बिक्री व ग्राहक 2x करने के तरीके**\n• 🏷️ **बारकोड व Google Lens QR स्टिकर**\n• 📜 **GST, HSN कोड व CA रिपोर्ट्स**\n\nआप मुझसे बेझिझक कोई भी सवाल पूछ सकते हैं या नीचे दिए बटन दबा सकते हैं! 👇`,
        actions: [
          { label: '🧾 नया बिल बनाएं', route: '/billing', icon: 'fa-solid fa-calculator' },
          { label: '👥 उधारी खाता देखें', route: '/customers', icon: 'fa-solid fa-users' },
          { label: '📢 WhatsApp ब्रॉडकास्ट', route: '/products', queryParams: { action: 'broadcast' }, icon: 'fa-brands fa-whatsapp' }
        ]
      };
    }

    // 🙏 6. THANKS & APPRECIATION
    if (q.includes('dhanyawad') || q.includes('shukriya') || q.includes('thanks') || q.includes('thank you') || q.includes('धन्यवाद') || q.includes('शुक्रिया') || q.includes('good job') || q.includes('bahut badhiya') || q.includes('badhiya')) {
      return {
        text: `💐 **आपका बहुत-बहुत धन्यवाद भाई साहब!**\n\nआपकी दुकान की तरक्की और आपका समय बचाना ही मेरा मुख्य उद्देश्य है।\nयदि आपको बिलिंग, उधारी, स्टॉक, WhatsApp या ग्राहक बढ़ाने में कोई भी सहायता चाहिए तो कभी भी पूछें।\n\n*"ग्राहक भगवान का रूप है, और मुनीम जी आपका भरोसेमंद साथी!"* 🌸`,
        actions: [
          { label: '🧾 POS बिलिंग करें', route: '/billing', icon: 'fa-solid fa-calculator' },
          { label: '📊 आज का डैशबोर्ड', route: '/dashboard', icon: 'fa-solid fa-chart-line' }
        ]
      };
    }

    // 📲 3. WHATSAPP बॉट क्या होता है / इसके क्या फायदे हैं / यह कैसे काम करता है / कैसे कनेक्ट करें
    if (q.includes('whatsapp') || q.includes('whats') || q.includes('watsap') || q.includes('watsapp') || q.includes('vatsap') || q.includes('व्हाट्सएप') || q.includes('व्हाट्सऐप') || q.includes('वाट्सएप') || q.includes('bot') || q.includes('बॉट') || q.includes('broadcast') || q.includes('ब्रॉडकास्ट') || q.includes('qr scan') || q.includes('किवआर')) {
      return {
        text: `📲 **WhatsApp बॉट क्या होता है, इसके क्या फायदे हैं और यह कैसे काम करता है?**\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📌 **1. WhatsApp बॉट क्या होता है? (What is WhatsApp Bot?):**\n• यह एक **स्मार्ट ऑटोमैटिक रोबोटिक असिस्टेंट** है जो बिना किसी थर्ड पार्टी शुल्क के सीधे आपके कंप्यूटर सॉफ्टवेयर से ग्राहकों के मोबाइल पर WhatsApp संदेश भेजता है।\n• सबसे बड़ी बात: इसके लिए आपको ग्राहक का मोबाइल नंबर अपने फोन की कॉन्टैक्ट लिस्ट में सेव करने की रत्ती भर भी जरूरत नहीं होती! बिल बना ➜ और 1 सेकंड में ग्राहक के WhatsApp पर पहुँच गया।\n\n💡 **2. दुकानदार को इससे होने वाले 6 सबसे बड़े फायदे (Key Benefits):**\n1️⃣ **कागज व थर्मल प्रिंटर के खर्च में 100% बचत:**\n• रोल व इंक का हर महीने ₹1,500 से ₹3,500 की सीधी बचत होती है।\n2️⃣ **1-क्लिक में नए माल का प्रचार (500+ ग्राहकों को एक साथ):**\n• जब भी दुकान में नया स्टॉक, नया फैंसी सूट, साड़ी या किराना माल आए, 1-क्लिक में सभी ग्राहकों को फोटो + डिस्काउंट रेट का ब्रॉडकास्ट पहुँच जाता है।\n3️⃣ **उधारी वसूली 2x तेज (Instant Payment Collection):**\n• ग्राहक के WhatsApp पर बिल व UPI QR कोड जाने से वह घर बैठे 2 मिनट में PhonePe/GooglePay से पैसे भेज देता है।\n4️⃣ **दुकान की ब्रांड वैल्यू और पक्का विश्वास:**\n• दुकान के लोगो, GST नंबर, पते व आइटम लिस्ट के साथ रंगीन डिजिटल PDF बिल देखकर ग्राहक आकर्षित और संतुष्ट होता है।\n5️⃣ **बिल कभी खोता नहीं:**\n• ग्राहक का बिल WhatsApp चैट में हमेशा सुरक्षित रहता है, जिससे रिटर्न या एक्सचेंज के समय कोई विवाद नहीं होता।\n6️⃣ **त्योहारों पर ऑटोमैटिक शुभकामनाएं:**\n• दीपावली, होली, धनतेरस पर ग्राहकों को शुभकामना व स्पेशल डिस्काउंट कूपन सीधे WhatsApp पर जाते हैं।\n\n⚙️ **3. यह कैसे काम करता है और कैसे कनेक्ट करें? (How it works):**\n1. सॉफ्टवेयर के टॉप बार या नीचे दिए बटन से **'📲 QR कोड'** खोलें।\n2. अपने मोबाइल में **WhatsApp खोलें ➜ 3 Dots ➜ Linked Devices (लिंक किए गए डिवाइस) ➜ Link a Device** पर टैप करें।\n3. स्क्रीन पर आ रहे QR कोड को अपने फोन के कैमरे से स्कैन करें।\n4. स्कैन होते ही **🟢 WhatsApp Connected** हो जाएगा और ऑटो-बिलिंग शुरू हो जाएगी!`,
        actions: [
          { label: '📢 WhatsApp ब्रॉडकास्ट व QR कनेक्ट', route: '/products', queryParams: { action: 'broadcast' }, icon: 'fa-brands fa-whatsapp' },
          { label: '🧾 POS बिलिंग खोलें', route: '/billing', icon: 'fa-solid fa-calculator' },
          { label: '👥 ग्राहक खाता खोलें', route: '/customers', icon: 'fa-solid fa-users' }
        ]
      };
    }

    // 💰 4. उधारी खाता / उधारी वसूली / बहीखाता / तकादा / बकायेदार
    if (q.includes('उधार') || q.includes('udhar') || q.includes('vasool') || q.includes('vasuli') || q.includes('वसूल') || q.includes('तकादा') || q.includes('khata') || q.includes('खाता') || q.includes('बकाया') || q.includes('क्रेडिट') || q.includes('credit') || q.includes('उधारी') || q.includes('bakaya') || q.includes('remind') || q.includes('bad debt')) {
      const template = `🙏 नमस्ते [ग्राहक का नाम] जी! आपकी दुकान [दुकान का नाम] से आपका ₹[रुपये] का पिछला बकाया चल रहा है। कृपया समय पर भुगतान करके सहयोग प्रदान करें। ऑनलाइन पेमेंट हेतु QR कोड साथ में संलग्न है। धन्यवाद! 🌸`;
      return {
        text: `💰 **उधारी खाता क्या है और उधार का पैसा प्यार से व तेजी से कैसे वसूलें?**\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📌 **1. डिजिटल उधारी खाता क्या है?**\n• यह पुराने कागजी लाल बहीखाते का आधुनिक डिजिटल स्वरूप है। इसमें हर ग्राहक की खरीद तारीख, बिल नंबर, जमा रकम (Credit) और बाकी रकम (Debit) पाई-पाई का सटीक हिसाब रहता है।\n\n💡 **2. उधारी वसूली के 5 अचूक व व्यावहारिक फॉर्मूले:**\n1️⃣ **समय पर विनम्र WhatsApp तकादा भेजें:**\n• ग्राहक से बिना फोन किए और बिना बहस किए 1-क्लिक में पेशेवर WhatsApp बकाया संदेश भेजें।\n2️⃣ **क्विक पेमेंट डिस्काउंट ऑफर (Cash Incentive):**\n• ग्राहक से कहें: *"यदि आप 3 दिन के अंदर पूरा बकाया चुकाते हैं, तो इस बिल पर 3% से 5% की विशेष नकद छूट मिलेगी!"*\n3️⃣ **आसान साप्ताहिक किश्तें (Easy Installments):**\n• यदि किसी ग्राहक का बड़ा बिल (जैसे ₹10,000) अटका है, तो उससे कहें कि वह हर हफ्ते ₹1,000 या ₹1,500 जमा करवा दे।\n4️⃣ **सॉफ्टवेयर में क्रेडिट लिमिट (Credit Limit) सेट करें:**\n• हर ग्राहक के लिए ₹2,000 या ₹5,000 की उधारी सीमा तय करें। सीमा पार होने पर सॉफ्टवेयर नया उधार बिल नहीं बनने देगा।\n5️⃣ **बिल पर स्पष्ट ड्यू डेट (Due Date) लिखें:**\n• बिल बनाते समय 7 दिन या 15 दिन की भुगतान तारीख जरूर सेट करें।\n\n📝 **रेडीमेड WhatsApp तकादा संदेश नीचे से कॉपी करें:**`,
        whatsappTemplate: template,
        actions: [
          { label: '👥 ग्राहक खाता व उधारी लिस्ट', route: '/customers', icon: 'fa-solid fa-users' },
          { label: '💳 पेमेंट इन (Payment In) दर्ज करें', route: '/payments', icon: 'fa-solid fa-money-bill-wave' }
        ]
      };
    }

    // 🧾 5. POS बिलिंग / फास्ट बिलिंग / नया बिल / डिस्काउंट / शॉर्टकट / इनवॉइस
    if (q.includes('बिल') || q.includes('bill') || q.includes('pos') || q.includes('invoice') || q.includes('इनवॉइस') || q.includes('फास्ट बिलिंग') || q.includes('शॉर्टकट') || q.includes('billing') || q.includes('counter') || q.includes('shortcut')) {
      return {
        text: `🧾 **POS बिलिंग क्या है और इससे दुकान में क्या-क्या फायदे होते हैं?**\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📌 **1. POS बिलिंग क्या होती है? (Point of Sale):**\n• यह सुपरफास्ट काउंटर बिलिंग सिस्टम है, जिसमें आप बारकोड स्कैनर या कीबोर्ड से मात्र 5 सेकंड में ग्राहक का बिल बनाकर तुरंत प्रिंट व WhatsApp पर भेज सकते हैं।\n\n💡 **2. दुकानदार को इससे होने वाले 5 मुख्य फायदे:**\n1️⃣ **भीड़ के समय नो-लाइन (Zero Wait Time):** काउंटर पर ग्राहकों की लंबी कतार नहीं लगती, बिलिंग बिजली जैसी तेज होती है।\n2️⃣ **जोड़-घटाव में 0% गलती:** डिस्काउंट, GST, राउंड-ऑफ और कुल जोड़ सॉफ्टवेयर खुद करता है, जिससे घाटा नहीं होता।\n3️⃣ **स्टॉक अपने-आप कम:** बिल कटते ही गोदाम/दुकान से माल अपने-आप घट जाता है, चोरी व शॉर्टेज का तुरंत पता चलता है।\n4️⃣ **मल्टीप्ल पेमेंट मोड:** नकद (Cash), UPI/QR, कार्ड और उधारी (Credit) को एक ही बिल में अलग-अलग ले सकते हैं।\n5️⃣ **कीबोर्ड शॉर्टकट का जादू:** बिना माउस छुए पूरी बिलिंग!\n\n⌨️ **सुपरफास्ट कीबोर्ड शॉर्टकट लिस्ट:**\n• **F2** ➜ नया बिल शुरू करें\n• **F4** ➜ ग्राहक खोजें या नया जोड़ें\n• **Enter** ➜ पेमेंट स्क्रीन पर जाएं और बिल सेव करें\n• **Ctrl + P** ➜ तुरंत प्रिंट निकालें\n• **Esc** ➜ बिल रद्द या वापस जाएं`,
        actions: [
          { label: '⚡ सुपरफास्ट POS बिलिंग खोलें', route: '/billing', icon: 'fa-solid fa-calculator' },
          { label: '📊 आज की कुल बिक्री देखें', route: '/dashboard', icon: 'fa-solid fa-chart-line' }
        ]
      };
    }

    // 📈 6. दुकान की बिक्री / ग्राहक बढ़ाना / सेल / मुनाफा 2x / ग्रोथ
    if (q.includes('बिक्री') || q.includes('bikri') || q.includes('sale') || q.includes('sales') || q.includes('ग्राहक') || q.includes('customer') || q.includes('grahak') || q.includes('मंदी') || q.includes('कमाई') || q.includes('मुनाफा') || q.includes('profit') || q.includes('ग्रोथ') || q.includes('growth') || q.includes('business grow') || q.includes('bheed')) {
      return {
        text: `📈 **दुकान की बिक्री, ग्राहक व मुनाफा 2x करने के 6 अचूक नियम:**\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n1️⃣ **नया माल आते ही WhatsApp ब्रॉडकास्ट भेजें:**\n• दुकान में कोई भी नया स्टॉक आते ही 1-क्लिक में सभी ग्राहकों को फोटो + डिस्काउंट रेट भेजें। जो दिखता है वही बिकता है!\n2️⃣ **कॉम्बो और बंडल ऑफर चलाएं (Combo Offers):**\n• उदाहरण: *"2 शर्ट लेने पर 1 टी-शर्ट फ्री"* या *"₹2,000 की खरीदारी पर ₹200 का उपहार"*\n3️⃣ **डेड स्टॉक को तुरंत क्लियर करें:**\n• 6 महीने से पुराने माल पर 10-20% की 'महा बचत सेल' लगाकर पूंजी खाली करें और तेज बिकने वाला माल भरें।\n4️⃣ **Google Maps (Google My Business) पर दुकान जोड़ें:**\n• अपनी दुकान का नाम, फोटो व मोबाइल नंबर Google Maps पर डालें ताकि आसपास के नए ग्राहक आसानी से आपकी दुकान तक आ सकें।\n5️⃣ **त्योहारों व जन्मदिन पर शुभकामनाएं भेजें:**\n• हर हिंदू त्योहार पर ग्राहकों को शुभकामना + स्पेशल डिस्काउंट कूपन भेजकर अपनापन बनाएं।\n6️⃣ **लॉयल्टी पॉइंट्स सिस्टम अपनाएं:**\n• हर ₹100 की खरीदारी पर 2 पॉइंट दें, ताकि ग्राहक बार-बार आपकी ही दुकान पर आए!`,
        actions: [
          { label: '📢 नया स्टॉक WhatsApp ब्रॉडकास्ट', route: '/products', queryParams: { action: 'broadcast' }, icon: 'fa-brands fa-whatsapp' },
          { label: '📊 बिजनेस रिपोर्ट्स व मुनाफा देखें', route: '/reports', icon: 'fa-solid fa-chart-pie' }
        ]
      };
    }

    // 🏷️ 7. बारकोड, QR स्टिकर, लेबल प्रिंटिंग
    if (q.includes('बारकोड') || q.includes('barcode') || q.includes('स्टिकर') || q.includes('sticker') || q.includes('प्रिंट') || q.includes('print') || q.includes('लेबल') || q.includes('label') || q.includes('lens')) {
      return {
        text: `🏷️ **बारकोड व QR स्टिकर क्या है और इसके क्या फायदे हैं?**\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📌 **1. बारकोड और QR स्टिकर क्या होता है?**\n• यह उत्पाद की पहचान का विशिष्ट डिजिटल कोड होता है। सॉफ्टवेयर हर प्रोडक्ट का यूनिक बारकोड और **Google Lens वेब QR कोड** अपने-आप जनरेट करता है।\n\n💡 **2. दुकानदार को होने वाले मुख्य फायदे:**\n1️⃣ **रेट याद रखने या पर्ची ढूंढने की झंझट खत्म:** कपड़े, बॉक्स या किराना पैकेट पर लगे स्टिकर को स्कैनर से स्कैन करते ही नाम और रेट स्क्रीन पर आ जाता है।\n2️⃣ **स्टाफ से बिलिंग में कोई गलती नहीं:** नया सेल्समैन या लड़का भी बिना किसी गलती के आसानी से बिल बना सकता है।\n3️⃣ **A4 व थर्मल स्टिकर प्रिंटिंग:** एक बार में 24, 40 या सिंगल स्टिकर शीट आसानी से प्रिंट कर सकते हैं।\n4️⃣ **दुकान का पेशेवर लुक:** बारकोड स्टिकर लगे सामान से ग्राहक मोल-भाव नहीं करता और दुकान का स्तर ऊंचा दिखता है।`,
        actions: [
          { label: '📦 प्रोडक्ट्स लिस्ट व बारकोड प्रिंटिंग', route: '/products', icon: 'fa-solid fa-barcode' }
        ]
      };
    }

    // 📜 8. GST, HSN कोड, टैक्स व CA रिपोर्ट
    if (q.includes('gst') || q.includes('जीएसटी') || q.includes('tax') || q.includes('टैक्स') || q.includes('ca') || q.includes('hsn') || q.includes('रिटर्न') || q.includes('return') || q.includes('gstr') || q.includes('cgst') || q.includes('sgst') || q.includes('igst')) {
      return {
        text: `📜 **GST, HSN कोड व CA रिपोर्ट क्या है और इसका क्या लाभ है?**\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📌 **1. HSN कोड व GST क्या है?**\n• **HSN Code:** यह वस्तु की पहचान का 4, 6 या 8 अंकों का सरकारी कोड है जिससे सही टैक्स स्लैब (0%, 5%, 12%, 18%, 28%) तय होता है।\n• **CGST + SGST:** जब राज्य के अंदर माल बेचा जाता है तो टैक्स आधा-आधा केंद्र और राज्य को जाता है (उदा. 18% = 9% CGST + 9% SGST)।\n• **IGST:** जब दूसरे राज्य में माल बेचा जाता है तो पूरा टैक्स IGST में जाता है।\n\n💡 **2. CA मासिक रिपोर्ट के फायदे:**\n• हर महीने CA के दफ्तर के चक्कर लगाने की जरूरत नहीं!\n• सॉफ्टवेयर 1-क्लिक में **GSTR-1 सेल्स रिपोर्ट**, **GSTR-3B परचेज समरी** और **HSN वाइज टैक्स रिपोर्ट** Excel व PDF में तैयार कर देता है।`,
        actions: [
          { label: '👔 CA मासिक रिपोर्ट खोलें', route: '/reports/ca', icon: 'fa-solid fa-user-tie' },
          { label: '📊 टैक्स रिपोर्ट्स देखें', route: '/reports', icon: 'fa-solid fa-file-invoice-dollar' }
        ]
      };
    }

    // 📦 9. स्टॉक, इन्वेंटरी, लो स्टॉक व डेड स्टॉक
    if (q.includes('स्टॉक') || q.includes('stock') || q.includes('इन्वेंटरी') || q.includes('inventory') || q.includes('कम माल') || q.includes('low stock') || q.includes('dead stock') || q.includes('डेड स्टॉक') || q.includes('godown') || q.includes('गोदाम')) {
      return {
        text: `📦 **इन्वेंटरी मैनेजमेंट क्या है और स्टॉक का नुकसान/चोरी कैसे रोकें?**\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📌 **1. इन्वेंटरी मैनेजमेंट क्या होता है?**\n• दुकान व गोदाम में मौजूद कुल सामान की सटीक लाइव गिनती। कौन सा माल कितना बचा है, कब खत्म होने वाला है और कौन सा माल नहीं बिक रहा।\n\n💡 **2. दुकानदार को होने वाले 4 बड़े फायदे:**\n1️⃣ **लो-स्टॉक ऑटो अलर्ट (Low Stock Alert):** माल खत्म होने से पहले ही पीली/लाल चेतावनी मिल जाती है ताकि ग्राहक खाली हाथ न लौटे।\n2️⃣ **डेड स्टॉक की पहचान:** जो माल 90 दिनों से नहीं बिका, उसे पहचानकर ऑफर या डिस्काउंट पर तुरंत निकालें।\n3️⃣ **चोरी व लीकेज पर रोक:** सिस्टम का स्टॉक और काउंटर का माल हमेशा मैच करता है।\n4️⃣ **सप्लायर से सही ऑर्डर:** केवल वही माल मंगाएं जिसकी दुकान में वास्तव में मांग है, जिससे आपकी पूंजी ब्लॉक नहीं होती।`,
        actions: [
          { label: '⚠️ कम स्टॉक अलर्ट देखें', route: '/inventory', icon: 'fa-solid fa-boxes-stacked' },
          { label: '🛒 नई खरीद (Purchase) दर्ज करें', route: '/purchases', icon: 'fa-solid fa-cart-shopping' }
        ]
      };
    }

    // 🛒 10. सप्लायर, खरीददारी व थोक व्यापारी
    if (q.includes('सप्लायर') || q.includes('supplier') || q.includes('होलसेलर') || q.includes('wholesaler') || q.includes('सस्ता माल') || q.includes('purchase') || q.includes('खरीद') || q.includes('खरीदारी')) {
      return {
        text: `🤝 **सप्लायर से सस्ता माल व लंबा क्रेडिट पीरियड प्राप्त करने के टिप्स:**\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n1️⃣ **समय पर भुगतान का रिकॉर्ड:** जो दुकानदार सप्लायर का भुगतान समय पर करता है, उसे सप्लायर 3-5% एक्स्ट्रा कैश डिस्काउंट (Cash Discount) और 30 से 45 दिन का उधार देता है।\n2️⃣ **2-3 सप्लायरों से कोटेशन कम्पेयर करें:** कभी भी एक ही सप्लायर पर निर्भर न रहें, रेट व स्कीम का मिलान करें।\n3️⃣ **सॉफ्टवेयर में लेजर मेंटेन रखें:** परचेज बिल दर्ज करने से सप्लायर का बकाया और आइटम का खरीद रेट हमेशा सुरक्षित रहता है।`,
        actions: [
          { label: '🚚 सप्लायर खाता खोलें', route: '/suppliers', icon: 'fa-solid fa-truck-field' },
          { label: '🛒 नई खरीद (Purchase) बिल जोड़ें', route: '/purchases', icon: 'fa-solid fa-cart-plus' }
        ]
      };
    }

    // 🪔 11. त्योहार, ऑफर्स, दीपावली, होली, रक्षाबंधन
    if (q.includes('त्योहार') || q.includes('tyohar') || q.includes('festival') || q.includes('ऑफर') || q.includes('offer') || q.includes('दीपावली') || q.includes('होली') || q.includes('दशहरा') || q.includes('राखी') || q.includes('नवरात्रि') || q.includes('eid') || q.includes('diwali')) {
      return {
        text: `🪔 **फेस्टिवल मार्केटिंग क्या है और त्योहारों पर सेल कैसे बढ़ाएं?**\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📌 **1. यह क्या होता है?**\n• त्योहारों के पावन अवसर पर ग्राहकों को शुभकामनाएं व स्पेशल डिस्काउंट देकर दुकान पर आकर्षित करने की अचूक रणनीति।\n\n💡 **2. 30+ हिंदू त्योहारों का 1-क्लिक ब्रॉडकास्ट:**\n• सॉफ्टवेयर में **दीपावली, धनतेरस, होली, मकर संक्रांति, रक्षाबंधन, नवरात्रि, जन्माष्टमी, शिवरात्रि** आदि सभी 30 त्योहारों के रेडीमेड मैसेज व फोटो हैं।\n• 1-क्लिक में सभी ग्राहकों को WhatsApp शुभकामना + ऑफर भेजें!`,
        actions: [
          { label: '🪔 त्योहार ब्रॉडकास्ट खोलें', route: '/products', queryParams: { action: 'broadcast' }, icon: 'fa-solid fa-gift' }
        ]
      };
    }

    // ⚖️ 12. कीमत, मार्जिन, डिस्काउंट व मुनाफा तय करना
    if (q.includes('डिस्काउंट') || q.includes('discount') || q.includes('मार्जिन') || q.includes('margin') || q.includes('रेट') || q.includes('rate') || q.includes('कीमत') || q.includes('price') || q.includes('mrp') || q.includes('profit margin')) {
      return {
        text: `⚖️ **उत्पाद की सही MRP, मार्जिन व डिस्काउंट तय करने का फॉर्मूला:**\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📌 **1. मार्जिन फॉर्मूला:**\n• खरीद मूल्य (Purchase Price) + दुकान खर्च व ट्रांसपोर्ट (8-10%) + आपका शुद्ध मुनाफा (15-30%) = विक्रय मूल्य (Selling Price)।\n\n💡 **2. मनोवैज्ञानिक मूल्य निर्धारण (Psychological Pricing):**\n• ₹1,000 के बजाय **₹999** या ₹500 के बजाय **₹499** रखें। इससे ग्राहक को सामान सस्ता महसूस होता है।\n• फ्लैट डिस्काउंट के बजाय **कॉम्बो ऑफर** दें (जैसे 3 पीस लेने पर ₹150 की छूट)।`,
        actions: [
          { label: '📦 प्रोडक्ट्स रेट सूची', route: '/products', icon: 'fa-solid fa-tags' }
        ]
      };
    }

    // 💸 13. दुकान के खर्चे, पेट्टी कैश, लाभ-हानि (P&L)
    if (q.includes('खर्चा') || q.includes('kharcha') || q.includes('expense') || q.includes('किराया') || q.includes('बिजली') || q.includes('rent') || q.includes('salary') || q.includes('तनख्वाह') || q.includes('loss') || q.includes('हानि')) {
      return {
        text: `💸 **दुकान के दैनिक खर्चे व शुद्ध लाभ-हानि (P&L) कैसे ट्रैक करें?**\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📌 **1. खर्चे दर्ज करने का महत्व:**\n• जब तक दुकान का किराया, बिजली का बिल, स्टाफ की सैलरी, चाय-नाश्ता और ट्रांसपोर्ट खर्च अलग से दर्ज नहीं होगा, तब तक आपको अपनी दुकान का **असली शुद्ध मुनाफा (Net Profit)** पता नहीं चलेगा।\n\n💡 **2. सॉफ्टवेयर में एक्सपेंस मैनेजमेंट:**\n• रोज के छोटे-मोटे खर्चे **'खर्चे (Expenses)'** सेक्शन में 10 सेकंड में दर्ज करें।\n• महीने के अंत में कुल बिक्री में से खरीद और खर्चे घटाकर शुद्ध बचत रिपोर्ट देखें!`,
        actions: [
          { label: '💸 नया खर्चा दर्ज करें', route: '/expenses', icon: 'fa-solid fa-receipt' },
          { label: '📊 प्रॉफिट एंड लॉस रिपोर्ट', route: '/reports', icon: 'fa-solid fa-chart-line' }
        ]
      };
    }

    // 🔒 14. बैकअप, सिक्योरिटी, पासवर्ड, कर्मचारी अधिकार (Staff Roles)
    if (q.includes('backup') || q.includes('बैकअप') || q.includes('सुरक्षा') || q.includes('security') || q.includes('password') || q.includes('पासवर्ड') || q.includes('कर्मचारी') || q.includes('staff') || q.includes('role') || q.includes('pin') || q.includes('पिन')) {
      return {
        text: `🔒 **डेटा बैकअप व कर्मचारी रोल सिक्योरिटी सिस्टम:**\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📌 **1. ऑटो क्लाउड व लोकल बैकअप:**\n• आपका बिलिंग डेटा, ग्राहक उधारी व स्टॉक रिकॉर्ड पूरी तरह सुरक्षित है। आप कभी भी 1-क्लिक में Excel या डेटाबेस बैकअप ले सकते हैं।\n\n💡 **2. कर्मचारी रोल व सुरक्षा पिन (Admin PIN):**\n• स्टाफ को केवल बिल बनाने की अनुमति दें। पुराना बिल डिलीट करने, डिस्काउंट बदलने या रिपोर्ट्स देखने के लिए **Admin PIN** आवश्यक होता है।`,
        actions: [
          { label: '⚙️ सेटिंग्स व सुरक्षा', route: '/settings', icon: 'fa-solid fa-shield-halved' },
          { label: '👥 कर्मचारी प्रबंधन', route: '/admin', icon: 'fa-solid fa-user-gear' }
        ]
      };
    }

    // 💳 15. ऑनलाइन पेमेंट, UPI, QR कोड, कार्ड स्वाइप
    if (q.includes('upi') || q.includes('qr') || q.includes('payment') || q.includes('पेमेंट') || q.includes('पेटीएम') || q.includes('phonepe') || q.includes('gpay') || q.includes('गूगल पे') || q.includes('online')) {
      return {
        text: `💳 **डिजिटल पेमेंट व डायनामिक UPI QR कोड सिस्टम:**\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📌 **1. बिलिंग में UPI QR कोड के लाभ:**\n• बिल बनते ही स्क्रीन और इनवॉइस पर ग्राहक के नाम और सटीक बिल राशि का **डायनामिक UPI QR कोड** बन जाता है।\n• ग्राहक किसी भी ऐप (PhonePe, GooglePay, Paytm) से स्कैन करता है और पैसा सीधे आपके बैंक खाते में आ जाता है।\n• इससे छुट्टा पैसे (चेंज) की झंझट और गलत ट्रांसफर का खतरा 0% हो जाता है!`,
        actions: [
          { label: '🧾 POS बिलिंग व QR पेमेंट', route: '/billing', icon: 'fa-solid fa-qrcode' },
          { label: '💳 पेमेंट हिस्ट्री देखें', route: '/payments', icon: 'fa-solid fa-money-check' }
        ]
      };
    }

    // 🤖 16. DYNAMIC CONVERSATIONAL AI REASONING ENGINE (Contextual synthesis for ANY question)
    return this.synthesizeDynamicAnswer(query, q);
  }

  // 🧮 Math & Calculation Solver
  private checkAndSolveCalculation(raw: string): { text: string; actions?: any[] } | null {
    // Check for patterns like "10000 ka 18% gst", "5000 pe 10% discount", "2500 + 18%"
    const gstMatch = raw.match(/(\d+(?:\.\d+)?)\s*(?:ka|par|pe|का|पर|पे)?\s*(\d+(?:\.\d+)?)\s*%\s*(?:gst|tax|जीएसटी|टैक्स)/i) ||
                     raw.match(/(?:gst|tax|जीएसटी|टैक्स)\s*(\d+(?:\.\d+)?)\s*%\s*(?:of|on|का|पर|पे)?\s*(\d+(?:\.\d+)?)/i);
    
    if (gstMatch) {
      const amount = parseFloat(gstMatch[1]);
      const rate = parseFloat(gstMatch[2]);
      if (!isNaN(amount) && !isNaN(rate)) {
        const gstAmount = (amount * rate) / 100;
        const total = amount + gstAmount;
        const cgst = gstAmount / 2;
        const sgst = gstAmount / 2;
        return {
          text: `🧮 **GST टैक्स गणना (Calculation):**\n━━━━━━━━━━━━━━━━━━━━\n• मूल राशि (Base Amount): **₹${amount.toLocaleString('en-IN')}**\n• GST दर (${rate}%): **₹${gstAmount.toLocaleString('en-IN')}**\n  - CGST (${rate / 2}%): **₹${cgst.toLocaleString('en-IN')}**\n  - SGST (${rate / 2}%): **₹${sgst.toLocaleString('en-IN')}**\n━━━━━━━━━━━━━━━━━━━━\n📌 **कुल देय राशि (Total Amount): ₹${total.toLocaleString('en-IN')}**`,
          actions: [
            { label: '🧾 POS बिलिंग करें', route: '/billing', icon: 'fa-solid fa-calculator' },
            { label: '📊 टैक्स रिपोर्ट्स', route: '/reports', icon: 'fa-solid fa-file-invoice-dollar' }
          ]
        };
      }
    }

    // Check discount calculations: "2000 ka 15% discount"
    const discMatch = raw.match(/(\d+(?:\.\d+)?)\s*(?:ka|par|pe|का|पर|पे)?\s*(\d+(?:\.\d+)?)\s*%\s*(?:discount|off|छूट|डिस्काउंट)/i);
    if (discMatch) {
      const amount = parseFloat(discMatch[1]);
      const rate = parseFloat(discMatch[2]);
      if (!isNaN(amount) && !isNaN(rate)) {
        const discAmount = (amount * rate) / 100;
        const finalPrice = amount - discAmount;
        return {
          text: `🧮 **डिस्काउंट गणना (Discount Calculation):**\n━━━━━━━━━━━━━━━━━━━━\n• मूल कीमत (MRP): **₹${amount.toLocaleString('en-IN')}**\n• छूट दर (${rate}%): **- ₹${discAmount.toLocaleString('en-IN')}**\n━━━━━━━━━━━━━━━━━━━━\n📌 **ग्राहक को देने की अंतिम कीमत: ₹${finalPrice.toLocaleString('en-IN')}**\n💡 *आपकी बचत/छूट: ₹${discAmount.toLocaleString('en-IN')}*`,
          actions: [
            { label: '🧾 बिल में डिस्काउंट लगाएं', route: '/billing', icon: 'fa-solid fa-receipt' }
          ]
        };
      }
    }

    return null;
  }

  // 🧠 Contextual Universal Question Answer Synthesizer (Multilingual: Hinglish, Hindi, English)
  private synthesizeDynamicAnswer(originalQuery: string, normalized: string): { text: string; actions?: any[] } {
    let topic = originalQuery.trim();
    if (topic.length > 55) {
      topic = topic.substring(0, 55) + '...';
    }

    const hasHindiChars = /[\u0900-\u097F]/.test(originalQuery);
    const isEnglishOnly = !hasHindiChars && /^(what|how|why|when|who|where|which|can|could|please|tell|give|is|are|the|explain|calculate|guide|help)\b/i.test(normalized);

    // 🇬🇧 1. English Response
    if (isEnglishOnly) {
      return {
        text: `🤖 **MKS Munim Ji AI — Answer:**\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📌 **Regarding your question:** *"__${topic}__"*\n\n🔹 **1. Overview & Understanding:**\n• In business and retail management, every streamlined process saves crucial time, cuts operating costs, and maximizes your profit margins.\n• Whether it's managing customer accounts, billing speed, or inventory safety—having clear systems ensures smooth daily operations.\n\n💡 **2. Key Advantages & Benefits:**\n1️⃣ **Time & Cost Savings:** Eliminates manual record-keeping errors and paperwork overhead.\n2️⃣ **Customer Loyalty:** Transparent digital invoices and fast service create strong brand trust.\n3️⃣ **Business Growth:** Live stock tracking and instant POS billing boost daily sales efficiency.\n\n⚙️ **3. How to Apply in Your Shop:**\n• Utilize built-in tools like POS Billing, WhatsApp Broadcast, and Credit Khata daily.\n• Check your end-of-day sales summary on the **Dashboard** every evening.\n\n👉 You can ask me anything about **WhatsApp Bot, Billing Shortcuts, Credit Recovery, GST, or Stock**!`,
        actions: [
          { label: '🧾 POS Billing', route: '/billing', icon: 'fa-solid fa-calculator' },
          { label: '👥 Customer Khata', route: '/customers', icon: 'fa-solid fa-users' },
          { label: '📊 Dashboard Reports', route: '/reports', icon: 'fa-solid fa-chart-pie' }
        ]
      };
    }

    // 🇮🇳 2. Hinglish Response (Roman Hindi like "kya hota hai", "kaise kare", "batao", etc.)
    if (!hasHindiChars) {
      return {
        text: `🤖 **MKS मुनीम जी AI — आपका समाधान:**\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📌 **Aapke sawaal par jaankari:** *"__${topic}__"*\n\n🔹 **1. Yeh kya hota hai? (Overview):**\n• Business aur dukandari me har chhoti-badi vyavastha aapke samay, kharche aur munafey se judi hoti hai.\n• Chahe baat bikri badhane ki ho, grahako ko jodkar rakhne ki ho ya inventory sambhalne ki—sahi digital tarika dukan ko aage le jata hai.\n\n💡 **2. Isse dukandar ko kya-kya fayde honge:**\n1️⃣ **Time aur Paise ki seedhi bachat:** Parchi banane aur manual hisab ki jhanjhat khatam hoti hai.\n2️⃣ **Grahako ka pakka vishwas:** Digital PDF bill aur WhatsApp updates se dukan professional dikhti hai.\n3️⃣ **Bikri aur Profit me badhotari:** Jab counter aur stock organized rehte hain to bikri 2x teji se badhti hai.\n\n⚙️ **3. Ise apni dukan me kaise lagoo karein:**\n• Naya bill banane ke liye **'🧾 POS Billing'** ka upyog karein aur grahako ko WhatsApp par updates bhejein.\n• Roz shaam ko dukan badhane se pehle **'Dashboard'** par total cash aur online bikri ka milan karein.\n\n👉 Aap mujhse **WhatsApp Bot, Udhari Wasooli, Bill Discount, GST ya Stock** ke baare me koi bhi sawaal pooch sakte hain!`,
        actions: [
          { label: '🧾 POS Billing', route: '/billing', icon: 'fa-solid fa-calculator' },
          { label: '👥 Grahak Khata', route: '/customers', icon: 'fa-solid fa-users' },
          { label: '📢 WhatsApp Prachar', route: '/products', queryParams: { action: 'broadcast' }, icon: 'fa-brands fa-whatsapp' },
          { label: '📊 Business Report', route: '/reports', icon: 'fa-solid fa-chart-pie' }
        ]
      };
    }

    // 🕉️ 3. Pure Hindi Devanagari Response
    return {
      text: `🤖 **MKS मुनीम जी AI — सम्पूर्ण समाधान:**\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📌 **आपके प्रश्न पर विश्लेषण:** *"__${topic}__"*\n\n🔹 **1. यह क्या है व इसकी सही समझ (Concept & Meaning):**\n• व्यापार और दुकानदारी में हर प्रक्रिया आपके समय, लागत (Cost) और मुनाफे को सीधे प्रभावित करती है।\n• चाहे बात बिक्री बढ़ाने की हो, इन्वेंटरी को सुरक्षित रखने की हो या ग्राहकों को आकर्षित करने की—तकनीक और नियमों का सही तालमेल दुकान को सफल बनाता है।\n\n💡 **2. इससे दुकानदार को क्या-क्या लाभ होंगे (Key Benefits):**\n1️⃣ **समय व पैसों की बचत:** सभी हिसाब-किताब और प्रक्रियाएं डिजिटल होने से फिजूलखर्ची रुकती है।\n2️⃣ **ग्राहकों का अटूट विश्वास:** पारदर्शी व पेशेवर कार्यप्रणाली से ग्राहक हमेशा आपकी ही दुकान को चुनता है।\n3️⃣ **व्यापार में तेजी व मुनाफा:** जब काउंटर और स्टॉक सुव्यवस्थित होते हैं तो बिक्री 2x तेजी से बढ़ती है।\n\n⚙️ **3. इसे अपनी दुकान में कैसे लागू करें (Actionable Steps):**\n• सॉफ्टवेयर में उपलब्ध फीचर्स (POS बिलिंग, WhatsApp ब्रॉडकास्ट, उधारी खाता, स्टॉक ट्रैकिंग) का प्रतिदिन उपयोग करें।\n• रोज़ शाम को काउंटर बंद करते समय **'डैशबोर्ड'** पर दिनभर की कुल बिक्री और उधारी मिलान अवश्य करें।\n\n👉 आप मुझसे **WhatsApp बॉट, उधारी वसूली, बिलिंग शॉर्टकट, GST या स्टॉक** के बारे में कोई भी प्रश्न पूछ सकते हैं!`,
      actions: [
        { label: '🧾 POS बिलिंग', route: '/billing', icon: 'fa-solid fa-calculator' },
        { label: '👥 ग्राहक खाता', route: '/customers', icon: 'fa-solid fa-users' },
        { label: '📢 WhatsApp प्रचार', route: '/products', queryParams: { action: 'broadcast' }, icon: 'fa-brands fa-whatsapp' },
        { label: '📊 बिजनेस रिपोर्ट', route: '/reports', icon: 'fa-solid fa-chart-pie' }
      ]
    };
  }
}
