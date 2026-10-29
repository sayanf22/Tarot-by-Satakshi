"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Clock, Mail, Menu, PhoneCall, X } from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Ornament } from "@/components/ui/ornament";
import { cn } from "@/lib/cn";
import { navigation, site } from "@/lib/site";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ href, label, pathname }: { href: string; label: string; pathname: string }) {
  const active = isActive(pathname, href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative py-2 text-[0.9rem] font-medium tracking-[0.03em] transition-colors hover:text-gold-800",
        "after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-center after:bg-gold-500 after:transition-transform after:duration-300",
        active ? "text-gold-800 after:scale-x-100" : "text-ink after:scale-x-0 hover:after:scale-x-100",
      )}
    >
      {label}
    </Link>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Keep the page behind the open menu from scrolling.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // A modal <dialog> traps focus and closes on Escape natively.
  function openMenu() {
    menuRef.current?.showModal();
    setOpen(true);
  }

  function closeMenu() {
    menuRef.current?.close();
  }

  const left = navigation.slice(0, 3);
  const right = navigation.slice(3);

  return (
    <header
      className={cn(
        // Solid white, no backdrop blur: a blur under a sticky bar is redrawn on every
        // scroll frame, which costs smoothness on phones.
        "sticky top-0 z-40 border-b bg-white transition-[border-color,box-shadow] duration-300",
        scrolled ? "border-line shadow-[0_10px_30px_-26px_rgb(30_26_20/0.35)]" : "border-transparent",
      )}
    >
      <Container className="flex h-20 items-center justify-between lg:grid lg:grid-cols-[1fr_auto_1fr]">
        <nav aria-label="Main" className="hidden items-center gap-10 lg:flex">
          {left.map((item) => (
            <NavLink key={item.href} {...item} pathname={pathname} />
          ))}
        </nav>

        <Wordmark />

        <div className="hidden items-center justify-end gap-10 lg:flex">
          {right.map((item) => (
            <NavLink key={item.href} {...item} pathname={pathname} />
          ))}
          <ButtonLink href="/book" size="sm">
            Book a session
          </ButtonLink>
        </div>

        <button
          type="button"
          onClick={openMenu}
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="mobile-menu"
          className="-mr-2 flex size-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-ivory lg:hidden"
        >
          <Menu className="size-6" strokeWidth={1.75} />
        </button>
      </Container>

      <dialog
        ref={menuRef}
        id="mobile-menu"
        aria-label="Menu"
        onClose={() => setOpen(false)}
        className="menu-dialog m-0 h-dvh max-h-none w-full max-w-none flex-col overflow-y-auto border-0 bg-white p-0 text-ink open:flex lg:hidden"
      >
        <Container className="flex h-20 shrink-0 items-center justify-between">
          <Wordmark onClick={closeMenu} />
          <button
            type="button"
            onClick={closeMenu}
            autoFocus
            aria-label="Close menu"
            className="-mr-2 flex size-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-champagne"
          >
            <X className="size-6" strokeWidth={1.75} />
          </button>
        </Container>

        <nav aria-label="Mobile" className="flex flex-1 flex-col items-center justify-center gap-7 py-10">
          {navigation.map((item, i) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMenu}
                aria-current={active ? "page" : undefined}
                style={{ "--i": i } as CSSProperties}
                className={cn("menu-item font-display text-4xl", active ? "text-gold-800" : "text-ink")}
              >
                {item.label}
              </Link>
            );
          })}
          <Ornament className="menu-item mt-2 [--i:4]" />
          <span className="menu-item mt-2 [--i:5]">
            <ButtonLink href="/book" onClick={closeMenu}>
              Book a session
            </ButtonLink>
          </span>
        </nav>

        <div className="menu-item flex shrink-0 flex-col items-center gap-4 pb-10 text-sm [--i:6]">
          <p className="flex items-center gap-2 font-semibold text-ink-muted">
            <Clock className="size-4 text-gold-700" strokeWidth={1.9} aria-hidden="true" />
            {site.hours.daysShort}, {site.hours.time} {site.hours.timeZone}
          </p>
          <div className="flex gap-3">
            <a href={site.phone.href} className={buttonClasses({ variant: "outline", size: "sm" })}>
              <PhoneCall className="size-4" strokeWidth={1.9} aria-hidden="true" />
              Call
            </a>
            <a href={`mailto:${site.email}`} className={buttonClasses({ variant: "outline", size: "sm" })}>
              <Mail className="size-4" strokeWidth={1.9} aria-hidden="true" />
              Email
            </a>
          </div>
        </div>
      </dialog>
    </header>
  );
}
