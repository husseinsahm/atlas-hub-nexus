import { QRCodeSVG } from "qrcode.react";
import { Smartphone } from "lucide-react";

interface Props {
  url: string;
  isArabic: boolean;
}

export function PortalQRCode({ url, isArabic }: Props) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 md:p-6 shadow-sm flex flex-col sm:flex-row items-center gap-5">
      <div className="bg-white p-3 rounded-xl shrink-0">
        <QRCodeSVG value={url} size={120} bgColor="#ffffff" fgColor="#000000" level="M" includeMargin={false} />
      </div>
      <div className="flex-1 text-center sm:text-start">
        <div className="flex items-center gap-2 justify-center sm:justify-start mb-1">
          <Smartphone className="w-4 h-4 text-primary" />
          <h3 className="font-bold font-display">
            {isArabic ? "احمله معك في رحلتك" : "Take it on your trip"}
          </h3>
        </div>
        <p className="text-sm text-muted-foreground">
          {isArabic
            ? "امسح الكود بكاميرا هاتفك لفتح برنامج رحلتك في أي وقت."
            : "Scan the code with your phone camera to open your itinerary anytime, anywhere."}
        </p>
      </div>
    </div>
  );
}
