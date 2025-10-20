"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Download, Share, Smartphone, ArrowRight } from "lucide-react";

// Lightweight i18n using the html[lang] attribute
function useLocale() {
  const [locale, setLocale] = useState<'en' | 'ar'>('en');
  
  useEffect(() => {
    const updateLocale = () => {
      try {
        const lang = document.documentElement.getAttribute('lang') || 'en';
        setLocale(lang.toLowerCase().startsWith('ar') ? 'ar' : 'en');
      } catch (error) {
        setLocale('en');
      }
    };

    updateLocale();
    const observer = new MutationObserver(updateLocale);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['lang']
    });

    return () => observer.disconnect();
  }, []);

  return locale;
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  try {
    const ua = navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(ua);
  } catch {
    return false;
  }
}

function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  try {
    const ua = navigator.userAgent.toLowerCase();
    return /android/.test(ua);
  } catch {
    return false;
  }
}

function isChrome(): boolean {
  if (typeof navigator === 'undefined') return false;
  try {
    const ua = navigator.userAgent.toLowerCase();
    return /chrome|chromium/.test(ua);
  } catch {
    return false;
  }
}

function isSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  try {
    const ua = navigator.userAgent.toLowerCase();
    return /safari/.test(ua) && !/chrome|chromium/.test(ua);
  } catch {
    return false;
  }
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const isDisplayModeStandalone = window.matchMedia?.('(display-mode: standalone)').matches;
    const isIOSStandalone = (navigator as any).standalone === true;
    return !!(isDisplayModeStandalone || isIOSStandalone);
  } catch {
    return false;
  }
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PwaInstall() {
  const locale = useLocale();
  const [canInstall, setCanInstall] = useState(false);
  const [show, setShow] = useState(false);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const l10n = useMemo(() => {
    if (locale === 'ar') {
      return {
        title: 'ثبّت التطبيق',
        descAndroid: 'انقر تثبيت لإضافة تطبيق خدماتي إلى هاتفك',
        descChrome: 'انقر "تثبيت" ثم "تثبيت" في النافذة المنبثقة',
        desciOS: 'انقر "كيفية التثبيت" واتبع الخطوات البسيطة',
        install: 'تثبيت',
        installNow: 'تثبيت الآن',
        next: 'التالي',
        how: 'كيفية التثبيت',
        close: 'إغلاق',
        benefits: [
          'تشغيل سريع مثل التطبيق',
          'استخدام بدون إنترنت',
          'إشعارات فورية',
          'وصول سريع من الشاشة الرئيسية'
        ],
        iosSteps: [
          {
            title: 'انقر زر المشاركة',
            description: 'في سفاري، انقر زر المشاركة في الأسفل (المربع مع السهم للأعلى)',
            icon: 'share'
          },
          {
            title: 'اختر "إضافة إلى الشاشة الرئيسية"',
            description: 'قم بالتمرير لأسفل واختر "إضافة إلى الشاشة الرئيسية"',
            icon: 'home'
          },
          {
            title: 'انقر "إضافة"',
            description: 'أكد التثبيت بالنقر على "إضافة" في الزاوية اليمنى العليا',
            icon: 'add'
          }
        ],
        androidSteps: [
          {
            title: 'انقر "تثبيت"',
            description: 'انقر زر التثبيت وسيظهر لك طلب التأكيد',
            icon: 'install'
          },
          {
            title: 'تأكيد التثبيت',
            description: 'انقر "تثبيت" في النافذة المنبثقة لتثبيت التطبيق',
            icon: 'confirm'
          }
        ],
        chromeSteps: [
          {
            title: 'انقر القائمة (⋯)',
            description: 'انقر النقاط الثلاث في أعلى المتصفح على اليمين',
            icon: 'menu'
          },
          {
            title: 'اختر "تثبيت التطبيق"',
            description: 'اختر "تثبيت التطبيق" أو "Add to Home screen" من القائمة',
            icon: 'install'
          },
          {
            title: 'تأكيد التثبيت',
            description: 'انقر "تثبيت" في النافذة المنبثقة',
            icon: 'confirm'
          }
        ]
      };
    }
    return {
      title: 'Install App',
      descAndroid: 'Click install to add Khidmaty to your phone',
      descChrome: 'Click "Install" then "Install" in the popup',
      desciOS: 'Click "How to install" and follow simple steps',
      install: 'Install',
      installNow: 'Install Now',
      next: 'Next',
      how: 'How to Install',
      close: 'Close',
      benefits: [
        'Fast app-like performance',
        'Works offline',
        'Instant notifications', 
        'Quick access from home screen'
      ],
      iosSteps: [
        {
          title: 'Tap Share Button',
          description: 'In Safari, tap the share button at the bottom (box with arrow up)',
          icon: 'share'
        },
        {
          title: 'Select "Add to Home Screen"',
          description: 'Scroll down and select "Add to Home Screen"',
          icon: 'home'
        },
        {
          title: 'Tap "Add"',
          description: 'Confirm installation by tapping "Add" in top right corner',
          icon: 'add'
        }
      ],
      androidSteps: [
        {
          title: 'Tap "Install"',
          description: 'Tap the install button and a confirmation will appear',
          icon: 'install'
        },
        {
          title: 'Confirm Installation',
          description: 'Tap "Install" in the popup to install the app',
          icon: 'confirm'
        }
      ],
      chromeSteps: [
        {
          title: 'Tap Menu (⋯)',
          description: 'Tap the three dots in top right of browser',
          icon: 'menu'
        },
        {
          title: 'Select "Install App"',
          description: 'Choose "Install app" or "Add to Home screen" from menu',
          icon: 'install'
        },
        {
          title: 'Confirm Installation',
          description: 'Tap "Install" in the popup window',
          icon: 'confirm'
        }
      ]
    };
  }, [locale]);

  useEffect(() => {
    if (isStandalone()) {
      setShow(false);
      return;
    }

    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      deferredPromptRef.current = e;
      setCanInstall(true);
      
      // Auto-show for Android/Chrome users since they can install directly
      if (isAndroid() || isChrome()) {
        setShow(true);
      }
    };

    const handleAppInstalled = () => {
      setShow(false);
      setCanInstall(false);
      deferredPromptRef.current = null;
    };

    // For iOS/Safari, show after a short delay
    const timer = setTimeout(() => {
      if ((isIOS() && isSafari()) && !isStandalone()) {
        setShow(true);
      }
    }, 3000);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    const promptEvent = deferredPromptRef.current;
    
    if (promptEvent) {
      try {
        await promptEvent.prompt();
        const choiceResult = await promptEvent.userChoice;
        
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the install prompt');
        }
        
        deferredPromptRef.current = null;
        setCanInstall(false);
        setShow(false);
      } catch (error) {
        console.error('Error during installation:', error);
        // If automatic install fails, show guide
        setShowGuide(true);
      }
    } else {
      // No prompt available, show guide
      setShowGuide(true);
      setCurrentStep(0);
    }
  };

  const handleClose = () => {
    setShow(false);
    try {
      const dismissalDate = new Date();
      dismissalDate.setDate(dismissalDate.getDate() + 7);
      localStorage.setItem('pwa_dismissed', dismissalDate.toISOString());
    } catch (error) {
      // Ignore storage errors
    }
  };

  const handleCloseGuide = () => {
    setShowGuide(false);
    setCurrentStep(0);
  };

  const nextStep = () => {
    const steps = getSteps();
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleCloseGuide();
    }
  };

  const getSteps = () => {
    if (isIOS()) return l10n.iosSteps;
    if (isAndroid() && isChrome()) return l10n.androidSteps;
    return l10n.chromeSteps;
  };

  const getStepIcon = (iconName: string) => {
    switch (iconName) {
      case 'share': return <Share className="h-6 w-6" />;
      case 'home': return <Smartphone className="h-6 w-6" />;
      case 'add': return <Download className="h-6 w-6" />;
      case 'install': return <Download className="h-6 w-6" />;
      case 'confirm': return <Download className="h-6 w-6" />;
      case 'menu': return <Share className="h-6 w-6" />;
      default: return <Smartphone className="h-6 w-6" />;
    }
  };

  if (!show) return null;

  const steps = getSteps();
  const isIphone = isIOS();
  const isAndroidChrome = isAndroid() && isChrome();

  return (
    <>
      {/* Simplified Install Prompt */}
      <div className="fixed inset-x-0 bottom-0 z-[60] pb-safe">
        <div className="mx-auto max-w-xl px-3">
          <div className="mb-2 rounded-xl border border-ink/20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75 shadow-2xl">
            <div className="flex items-center gap-3 p-4">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-base flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-copper" />
                  {l10n.title}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {isAndroidChrome ? l10n.descAndroid : 
                   isIphone ? l10n.desciOS : l10n.descChrome}
                </div>
              </div>
              
              <div className="flex items-center gap-2 shrink-0">
                <Button 
                  onClick={handleInstall} 
                  className="h-10 px-4 text-base bg-copper hover:bg-copper-dark text-ink"
                  size="sm"
                >
                  <Download className="mr-2 h-4 w-4" /> 
                  {canInstall ? l10n.installNow : l10n.how}
                </Button>
                
                <Button 
                  variant="ghost" 
                  className="h-9 w-9 p-0 shrink-0" 
                  onClick={handleClose} 
                  aria-label={l10n.close}
                  size="sm"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Spacer to avoid overlap with bottom nav */}
        <div className="h-16 md:h-0" />
      </div>

      {/* Step-by-Step Guide */}
      {showGuide && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-end justify-center p-4 md:items-center md:p-0">
          <div className="w-full max-w-md rounded-t-2xl md:rounded-2xl bg-background p-6 shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">{l10n.how}</h2>
              <Button 
                variant="ghost" 
                className="h-8 w-8 p-0" 
                onClick={handleCloseGuide}
                aria-label={l10n.close}
                size="sm"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Progress indicator */}
            <div className="flex justify-center mb-6">
              <div className="flex gap-2">
                {steps.map((_, index) => (
                  <div
                    key={index}
                    className={`h-2 w-2 rounded-full ${
                      index <= currentStep ? 'bg-copper' : 'bg-gray-300'
                    }`}
                  />
                ))}
              </div>
            </div>
            
            {/* Current Step */}
            <div className="text-center mb-6">
              <div className="flex justify-center mb-4">
                <div className="h-12 w-12 flex items-center justify-center rounded-full bg-copper/20 text-copper">
                  {getStepIcon(steps[currentStep].icon)}
                </div>
              </div>
              <h3 className="text-lg font-semibold mb-2">
                {steps[currentStep].title}
              </h3>
              <p className="text-muted-foreground">
                {steps[currentStep].description}
              </p>
            </div>
            
            {/* Benefits */}
            {currentStep === 0 && (
              <div className="mb-6 p-4 bg-muted rounded-lg">
                <h4 className="font-semibold mb-2">
                  {locale === 'ar' ? 'مزايا التثبيت:' : 'Installation Benefits:'}
                </h4>
                <ul className="text-sm space-y-1">
                  {l10n.benefits.map((benefit, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-copper" />
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Next Button */}
            <Button 
              onClick={nextStep} 
              className="w-full h-11 text-base bg-copper hover:bg-copper-dark text-ink"
              size="lg"
            >
              {currentStep < steps.length - 1 ? (
                <>
                  {l10n.next} <ArrowRight className="ml-2 h-4 w-4" />
                </>
              ) : (
                l10n.close
              )}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}