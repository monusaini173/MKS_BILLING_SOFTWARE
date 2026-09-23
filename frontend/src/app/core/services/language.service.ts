import { Injectable, signal, computed } from '@angular/core';

export type LangCode = 'hi' | 'en';

export interface LangInfo {
  code: LangCode;
  name: string;
  nativeName: string;
  flag: string;
  otherLangName: string;
}

export const LANGUAGES: Record<LangCode, LangInfo> = {
  hi: {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    flag: '🇮🇳',
    otherLangName: 'English (EN)'
  },
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇬🇧',
    otherLangName: 'हिन्दी (HI)'
  }
};

// Comprehensive Dictionary for Instant 0ms Translation
const TRANSLATIONS: Record<string, { hi: string; en: string }> = {
  // Navigation & Core
  'nav.dashboard': { hi: 'डैशबोर्ड (Dashboard)', en: 'Dashboard' },
  'nav.billing': { hi: 'पीओएस बिलिंग (POS Billing)', en: 'POS Billing' },
  'nav.catalog': { hi: 'कैटलॉग (Catalog)', en: 'Catalog' },
  'nav.products': { hi: 'प्रोडक्ट्स (Products)', en: 'Products' },
  'nav.broadcast': { hi: 'स्टॉक ब्रॉडकास्ट (नया माल)', en: 'Stock Broadcast' },
  'nav.inventory': { hi: 'इन्वेंटरी स्टॉक (Inventory)', en: 'Inventory' },
  'nav.parties': { hi: 'पार्टी और फाइनेंस (Finance)', en: 'Parties & Finance' },
  'nav.customers': { hi: 'ग्राहक (Customers)', en: 'Customers' },
  'nav.suppliers': { hi: 'सप्लायर्स (Suppliers)', en: 'Suppliers' },
  'nav.purchases': { hi: 'खरीद (Purchases)', en: 'Purchases' },
  'nav.expenses': { hi: 'दुकान खर्च (Expenses)', en: 'Expenses' },
  'nav.payments': { hi: 'भुगतान इतिहास (Payment History)', en: 'Payment History' },
  'nav.system': { hi: 'सिस्टम (System)', en: 'System' },
  'nav.reports': { hi: 'रिपोर्ट्स (Reports)', en: 'Reports' },
  'nav.settings': { hi: 'सेटिंग्स (Settings)', en: 'Settings' },
  'nav.admin': { hi: 'सुपर एडमिन (Super Admin)', en: 'Super Admin' },
  
  // Header Actions
  'header.newBill': { hi: 'नया बिल बनाएं', en: 'New Bill' },
  'header.darkMode': { hi: '🌙 डार्क मोड', en: '🌙 Dark Mode' },
  'header.lightMode': { hi: '☀️ लाइट मोड', en: '☀️ Light Mode' },
  'header.owner': { hi: 'मालिक:', en: 'Owner:' },
  
  // Common Actions
  'common.search': { hi: 'खोजें...', en: 'Search...' },
  'common.save': { hi: 'सुरक्षित करें', en: 'Save' },
  'common.cancel': { hi: 'रद्द करें', en: 'Cancel' },
  'common.close': { hi: 'बंद करें', en: 'Close' },
  'common.delete': { hi: 'हटाएं', en: 'Delete' },
  'common.edit': { hi: 'संपादित करें', en: 'Edit' },
  'common.add': { hi: 'जोड़ें', en: 'Add' },
  'common.filter': { hi: 'फ़िल्टर', en: 'Filter' },
  'common.refresh': { hi: 'रीफ़्रेश', en: 'Refresh' },
  'common.print': { hi: 'प्रिंट', en: 'Print' },
  'common.all': { hi: 'सभी', en: 'All' },
  'common.today': { hi: 'आज', en: 'Today' },
  'common.yesterday': { hi: 'कल', en: 'Yesterday' },
  'common.status': { hi: 'स्थिति', en: 'Status' },
  'common.amount': { hi: 'राशि', en: 'Amount' },
  'common.date': { hi: 'दिनांक', en: 'Date' },
  'common.success': { hi: 'सफल', en: 'Success' },
  'common.pending': { hi: 'पेंडिंग / उधार', en: 'Pending' },
  'common.total': { hi: 'कुल', en: 'Total' },
};

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  currentLang = signal<LangCode>(this.getInitialLang());

  // Current config info
  activeConfig = computed<LangInfo>(() => LANGUAGES[this.currentLang()]);

  // Is Hindi active?
  isHindi = computed<boolean>(() => this.currentLang() === 'hi');

  // Is English active?
  isEnglish = computed<boolean>(() => this.currentLang() === 'en');

  private getInitialLang(): LangCode {
    const saved = localStorage.getItem('mks_app_lang');
    return (saved === 'en' || saved === 'hi') ? saved : 'hi';
  }

  // Blazing fast 1-click toggle between Hindi and English (0ms delay)
  toggleLanguage(): LangCode {
    const newLang: LangCode = this.currentLang() === 'hi' ? 'en' : 'hi';
    this.setLanguage(newLang);
    return newLang;
  }

  setLanguage(lang: LangCode) {
    this.currentLang.set(lang);
    localStorage.setItem('mks_app_lang', lang);
    document.documentElement.setAttribute('lang', lang);
  }

  // Fast translation function
  t(key: string, defaultVal?: string): string {
    const entry = TRANSLATIONS[key];
    if (entry) {
      return entry[this.currentLang()] || defaultVal || key;
    }
    return defaultVal || key;
  }
}
