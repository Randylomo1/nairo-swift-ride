import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-border bg-secondary/50">
      <div className="container-page py-12 grid gap-10 md:grid-cols-4">
        <div className="space-y-3">
          <Logo />
          <p className="text-sm text-muted-foreground max-w-xs">
            Fast, affordable motorbike delivery across Nairobi. Pay with M-Pesa, track in real time.
          </p>
        </div>
        <FooterCol title="Service">
          <li>Standard delivery</li>
          <li>Express delivery</li>
          <li>Same-day delivery</li>
          <li>Scheduled deliveries</li>
        </FooterCol>
        <FooterCol title="Company">
          <li>About us</li>
          <li>Contact</li>
          <li>Become a rider</li>
        </FooterCol>
        <FooterCol title="Legal">
          <li>Terms of service</li>
          <li>Privacy policy</li>
          <li>Insurance</li>
        </FooterCol>
      </div>
      <div className="border-t border-border">
        <div className="container-page py-5 text-xs text-muted-foreground flex justify-between">
          <span>© {new Date().getFullYear()} Urban Courier. Nairobi, Kenya.</span>
          <span>Powered by M-Pesa · Google Maps</span>
        </div>
      </div>
    </footer>
  );
}
function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="font-display font-semibold mb-3 text-sm">{title}</h4>
      <ul className="space-y-2 text-sm text-muted-foreground">{children}</ul>
    </div>
  );
}
