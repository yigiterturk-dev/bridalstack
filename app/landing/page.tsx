import Link from "next/link";
import { PACKS, ALL_PACK_IDS, SELLABLE_PACK_IDS, MODULES, isPackSellable, isModuleLive, formatPrice } from "@/config/modules";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#FDFCFB] overflow-hidden relative font-sans selection:bg-rose-200 selection:text-rose-900">
      {/* Exquisite Luxury Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[30%] -left-[10%] w-[70%] h-[70%] rounded-full bg-gradient-to-br from-rose-100/40 to-orange-50/40 blur-[120px] mix-blend-multiply animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute top-[20%] -right-[20%] w-[60%] h-[60%] rounded-full bg-gradient-to-bl from-amber-100/30 to-rose-50/30 blur-[150px] mix-blend-multiply animate-pulse" style={{ animationDuration: '12s' }} />
        <div className="absolute -bottom-[20%] left-[20%] w-[50%] h-[50%] rounded-full bg-gradient-to-tr from-stone-200/40 to-orange-100/20 blur-[130px] mix-blend-multiply" />
        
        {/* Subtle grid pattern for texture */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay" />
      </div>

      {/* Nav */}
      <nav className="fixed top-0 w-full bg-white/40 backdrop-blur-2xl border-b border-stone-200/50 z-50 transition-all">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <h1 className="text-2xl font-extrabold text-stone-900 tracking-tight flex items-center gap-2">
            Bridal<span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-amber-500">Stack</span>
          </h1>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-[14px] font-semibold text-stone-600 hover:text-rose-500 tracking-wide uppercase transition-colors">Features</a>
            <a href="#pricing" className="text-[14px] font-semibold text-stone-600 hover:text-rose-500 tracking-wide uppercase transition-colors">Pricing</a>
            <Link href="/dashboard" className="text-[15px] font-medium text-stone-900 hover:text-rose-600 transition-colors">Sign In</Link>
            <Link href="/dashboard" className="px-6 py-2.5 bg-stone-900 text-white rounded-full text-[14px] font-semibold hover:bg-stone-800 hover:shadow-xl hover:shadow-stone-900/20 transition-all duration-300">
              Start Free Trial
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-48 pb-32 px-6 relative z-10">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/60 backdrop-blur-md border border-stone-200/60 shadow-sm text-stone-800 text-xs font-bold tracking-widest uppercase mb-10 animate-fade-in-up">
            <span className="text-rose-500 animate-pulse">✦</span> The Operating System for Bridal Boutiques
          </div>
          <h1 className="text-6xl lg:text-[5rem] font-extrabold text-stone-900 tracking-tighter leading-[1.05] mb-8 drop-shadow-sm">
            Elevate your boutique with <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-500 via-amber-600 to-rose-500 bg-[length:200%_auto] animate-gradient">
              premium software.
            </span>
          </h1>
          <p className="text-xl lg:text-2xl text-stone-500 mt-6 max-w-3xl mx-auto leading-relaxed font-light">
            Manage brides, fittings, inventory, contracts, and payments from one breathtaking interface. Leave the spreadsheets behind.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-5 mt-14">
            <Link href="/dashboard" className="w-full sm:w-auto px-10 py-4 bg-stone-900 text-white rounded-full text-lg font-medium hover:bg-stone-800 shadow-[0_8px_30px_rgba(0,0,0,0.12)] hover:shadow-[0_8px_30px_rgba(28,25,23,0.3)] hover:-translate-y-0.5 transition-all duration-300">
              Start Free Trial →
            </Link>
            <a href="#features" className="w-full sm:w-auto px-10 py-4 bg-white/50 backdrop-blur-sm border border-stone-200 rounded-full text-lg font-medium text-stone-700 hover:bg-white hover:border-stone-300 hover:shadow-sm transition-all duration-300">
              Explore Features
            </a>
          </div>
          <p className="text-sm text-stone-400 mt-8 font-medium tracking-wide">NO CREDIT CARD REQUIRED · 14-DAY FREE TRIAL</p>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20 relative z-10 border-y border-stone-200/50 bg-white/40 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-12 text-center divide-y md:divide-y-0 md:divide-x divide-stone-200/50">
          {[
            { value: "10+", label: "Tailored Modules" },
            { value: "5 min", label: "Setup Time" },
            { value: "$0", label: "To Get Started" },
          ].map((s) => (
            <div key={s.label} className="pt-8 md:pt-0">
              <div className="text-5xl font-extrabold text-stone-900 tracking-tight drop-shadow-sm">{s.value}</div>
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-stone-400 mt-4">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-32 px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-24">
            <h2 className="text-4xl md:text-5xl font-extrabold text-stone-900 tracking-tight">Everything you need, beautifully crafted.</h2>
            <p className="text-stone-500 mt-6 text-xl max-w-2xl mx-auto font-light">Select the modules your boutique requires today. Seamlessly scale as your business grows.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: "groups", title: "Customer Management", desc: "Bride profiles, wedding dates, measurements, styling notes, and complete fitting history." },
              { icon: "event", title: "Appointments", desc: "Schedule initial consultations and fittings. Visual calendar flow tailored for bridal shops." },
              { icon: "receipt_long", title: "Sales & Contracts", desc: "Bespoke or ready-to-wear orders, digital contract signing, and production tracking." },
              { icon: "checkroom", title: "Gown Inventory", desc: "Manage gowns, veils, and accessories. Barcode scanning and real-time stock availability." },
              { icon: "calendar_month", title: "Online Booking", desc: "A public booking page your brides use themselves, with staff schedules and confirmations." },
              { icon: "favorite", title: "Try-On Tracking", desc: "Record how every bride reacted to every gown, so you know what she loved but did not buy." },
              { icon: "auto_awesome", title: "AI Stylist", desc: "Ask your AI assistant: 'What are the best-selling A-line gowns under $3,000 this month?'" },
              { icon: "draw", title: "Digital Contracts", desc: "Send a signing link, capture the signature, and keep the signed agreement on the order." },
              { icon: "analytics", title: "Advanced Analytics", desc: "Deep insights into monthly revenue, top-performing categories, and conversion rates." },
              { icon: "account_balance", title: "Finance & Ledger", desc: "Installment plans, cash register, and daily revenue collection.", soon: true },
              { icon: "payments", title: "Staff Commissions", desc: "Stylist performance tracking with automatic commission and bonus calculation.", soon: true },
            ].map((f) => (
              <div key={f.title} className={`bg-white/70 backdrop-blur-sm p-10 rounded-[2.5rem] border border-stone-100 transition-all duration-500 group ${f.soon ? "" : "hover:border-rose-200 hover:shadow-[0_20px_40px_-15px_rgba(225,29,72,0.1)] hover:-translate-y-1"}`}>
                <div className={`w-16 h-16 rounded-2xl bg-stone-50 flex items-center justify-center mb-8 transition-all duration-500 ${f.soon ? "" : "group-hover:bg-rose-500 group-hover:shadow-lg group-hover:shadow-rose-500/30"}`}>
                  <span className={`material-symbols-outlined text-3xl text-stone-800 transition-colors duration-300 ${f.soon ? "opacity-50" : "group-hover:text-white"}`}>{f.icon}</span>
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-xl font-bold text-stone-900">{f.title}</h3>
                  {f.soon && (
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full">
                      Coming soon
                    </span>
                  )}
                </div>
                <p className="text-[15px] text-stone-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-32 px-6 bg-stone-900 relative z-10 overflow-hidden text-white rounded-t-[4rem]">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-stone-700 to-transparent" />
        <div className="absolute -top-[50%] left-[50%] -translate-x-1/2 w-[100%] h-[100%] rounded-full bg-rose-500/10 blur-[120px] pointer-events-none" />
        
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight drop-shadow-md">Simple, modular pricing.</h2>
            <p className="text-stone-400 mt-6 text-xl max-w-2xl mx-auto font-light">
              Start free and stay free until you need more. Every price is on this page.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 mt-10 text-sm text-stone-400">
              {[
                "Client portal included, not an add-on",
                "Online booking page included",
                "No setup fee, no contract",
                "Cancel any time",
              ].map((line) => (
                <span key={line} className="inline-flex items-center gap-2">
                  <span className="material-symbols-outlined text-rose-400 text-[18px]">check_circle</span>
                  {line}
                </span>
              ))}
            </div>
            <p className="text-stone-500 mt-8 text-sm">
              Everything we sell today comes to{" "}
              <strong className="text-white">{formatPrice(SELLABLE_PACK_IDS.reduce((sum, id) => sum + PACKS[id].monthlyPrice, 0))}/mo</strong>{" "}
              for your whole shop.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {ALL_PACK_IDS.map((packId) => {
              const pack = PACKS[packId];
              const sellable = packId === "base" || isPackSellable(packId);
              return (
                <div key={packId} className={`bg-stone-800/50 backdrop-blur-xl rounded-[2.5rem] p-10 transition-all duration-500 hover:-translate-y-2 ${packId === "sales" ? "border border-rose-500/50 shadow-[0_0_50px_-12px_rgba(225,29,72,0.3)] relative" : "border border-stone-700/50"}`}>
                  {packId === "sales" && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-rose-400 to-amber-500 text-white px-5 py-1.5 rounded-full text-[11px] font-black tracking-widest uppercase shadow-lg">
                      Most Popular
                    </div>
                  )}
                  {!sellable && (
                    <div className="inline-block mb-4 text-[11px] font-black tracking-widest uppercase text-amber-300 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full">
                      In development
                    </div>
                  )}
                  <h3 className="text-2xl font-extrabold">{pack.name}</h3>
                  <p className="text-[15px] text-stone-400 mt-3 mb-8 h-10 leading-relaxed">{pack.description}</p>
                  <div className="mb-10 flex items-baseline gap-1">
                    <span className="text-6xl font-extrabold tracking-tighter">{formatPrice(pack.monthlyPrice)}</span>
                    <span className="text-stone-400 font-medium">/mo</span>
                  </div>
                  <ul className="space-y-5 mb-12">
                    {pack.modules.map((moduleId) => {
                      const live = isModuleLive(moduleId);
                      return (
                        <li key={moduleId} className={`flex items-start gap-4 text-[15px] font-medium ${live ? "text-stone-300" : "text-stone-500"}`}>
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-stone-700 flex items-center justify-center mt-0.5 border border-stone-600">
                            <span className={`text-xs font-bold ${live ? "text-rose-400" : "text-stone-500"}`}>{live ? "✓" : "•"}</span>
                          </span>
                          <span>
                            {MODULES[moduleId]?.name}
                            {!live && <span className="ml-2 text-[11px] uppercase tracking-wider text-amber-400/80">soon</span>}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  {sellable ? (
                    <Link
                      href="/dashboard"
                      className={`block text-center py-4 rounded-full text-[15px] font-bold transition-all duration-300 ${
                        packId === "sales"
                          ? "bg-white text-stone-900 hover:bg-stone-200 hover:shadow-xl"
                          : "bg-stone-700/50 text-white hover:bg-stone-700 border border-stone-600/50"
                      }`}
                    >
                      {pack.monthlyPrice === 0 ? "Start For Free" : "Choose Plan"}
                    </Link>
                  ) : (
                    <div className="block text-center py-4 rounded-full text-[15px] font-bold bg-stone-800/60 text-stone-500 border border-stone-700/50 cursor-not-allowed">
                      Not available yet
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 px-6 bg-[#FDFCFB] relative overflow-hidden z-10 border-b border-stone-200/50">
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="text-5xl font-extrabold text-stone-900 tracking-tight leading-tight">Ready to modernize your boutique?</h2>
          <p className="text-stone-500 mt-6 text-2xl font-light">Join hundreds of elite bridal boutiques using BridalStack.</p>
          <Link href="/dashboard" className="inline-block mt-12 px-12 py-5 bg-stone-900 text-white rounded-full text-lg font-bold hover:bg-rose-600 hover:scale-105 transition-all duration-300 shadow-[0_10px_40px_rgba(0,0,0,0.15)] hover:shadow-[0_10px_40px_rgba(225,29,72,0.3)]">
            Start Your Free Trial →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white py-16 px-6 relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-extrabold text-stone-900 tracking-tight">Bridal<span className="text-rose-500">Stack</span></h1>
            <span className="w-1 h-1 rounded-full bg-stone-300"></span>
            <span className="text-sm font-medium text-stone-400">© {new Date().getFullYear()} All rights reserved.</span>
          </div>
          <div className="flex items-center gap-10">
            <a href="#" className="text-[14px] font-semibold text-stone-400 hover:text-stone-900 uppercase tracking-wider transition-colors">Privacy</a>
            <a href="#" className="text-[14px] font-semibold text-stone-400 hover:text-stone-900 uppercase tracking-wider transition-colors">Terms</a>
            <a href="mailto:hello@bridalstack.com" className="text-[14px] font-semibold text-stone-400 hover:text-stone-900 uppercase tracking-wider transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
